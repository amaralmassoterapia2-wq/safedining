import { Database } from './supabase';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

// Extended ingredient type with modification fields
interface IngredientWithModifications extends Ingredient {
  is_removable?: boolean;
  is_substitutable?: boolean;
  substitutes?: { id: string; name: string; allergens: string[] }[];
}

export type SafetyStatus = 'safe' | 'safe-with-modifications' | 'unsafe';

export interface SafetyAnalysis {
  status: SafetyStatus;
  reasons: string[];
  modificationSuggestions?: string[];
  crossContactRisks?: string[];
}

// Extended MenuItem type to include optional description_allergens
interface MenuItemWithDescriptionAllergens extends Omit<MenuItem, 'description_allergens'> {
  description_allergens?: string[];
}

export function analyzeDishSafety(
  menuItem: MenuItem | MenuItemWithDescriptionAllergens,
  ingredients: (Ingredient | IngredientWithModifications)[],
  cookingSteps: CookingStep[],
  customerAllergens: string[]
): SafetyAnalysis {
  const isDev = import.meta.env.VITE_ENV === 'development';
  const log = (...args: any[]) => { if (isDev) console.log('[SafetyAnalysis]', ...args); };

  const reasons: string[] = [];
  const modificationSuggestions: string[] = [];
  const crossContactRisks: string[] = [];

  log(`\n========== Analyzing: "${menuItem.name}" ==========`);
  log(`Customer allergens:`, customerAllergens);

  if (customerAllergens.length === 0) {
    log(`No customer allergens → SAFE`);
    return {
      status: 'safe',
      reasons: ['No dietary restrictions specified'],
    };
  }

  const allergenSet = new Set(customerAllergens.map(a => a.toLowerCase().trim()));
  const foundAllergens = new Set<string>();
  const removableAllergens = new Set<string>();
  const substitutableAllergens = new Set<string>();
  const descriptionAllergenMatches = new Set<string>();

  // Check description allergens first
  const itemWithDescAllergens = menuItem as MenuItemWithDescriptionAllergens;
  if (itemWithDescAllergens.description_allergens && itemWithDescAllergens.description_allergens.length > 0) {
    log(`Description allergens:`, itemWithDescAllergens.description_allergens);
    for (const descAllergen of itemWithDescAllergens.description_allergens) {
      const descAllergenLower = descAllergen.toLowerCase();
      for (const customerAllergen of allergenSet) {
        if (descAllergenLower.includes(customerAllergen) || customerAllergen.includes(descAllergenLower)) {
          log(`  ⛔ Description allergen MATCH: "${descAllergen}" ↔ customer "${customerAllergen}" → BLOCKER`);
          descriptionAllergenMatches.add(descAllergen);
          foundAllergens.add(descAllergen);
        }
      }
    }
  }

  log(`\nChecking ${ingredients.length} ingredients:`);
  for (const ingredient of ingredients) {
    const ingredientName = ingredient.name.toLowerCase();
    const ingredientAllergens = ingredient.contains_allergens.map(a => a.toLowerCase());
    const ingWithMods = ingredient as IngredientWithModifications;

    for (const allergen of allergenSet) {
      if (ingredientName.includes(allergen) || ingredientAllergens.includes(allergen)) {
        log(`  🔍 Ingredient "${ingredient.name}" matches allergen "${allergen}"`);
        log(`     contains_allergens: [${ingredient.contains_allergens.join(', ')}]`);
        log(`     is_removable: ${ingWithMods.is_removable}, is_substitutable: ${ingWithMods.is_substitutable}`);
        foundAllergens.add(ingredient.name);

        // Check structured modification flags first
        if (ingWithMods.is_removable) {
          log(`     ✅ Ingredient is REMOVABLE → added to removableAllergens as "${ingredient.name}"`);
          removableAllergens.add(ingredient.name);
          modificationSuggestions.push(`Remove ${ingredient.name}`);
        } else if (ingWithMods.is_substitutable) {
          // Check if any substitutes are safe for the customer
          const safeSubstitutes = (ingWithMods.substitutes || []).filter(sub => {
            const subAllergens = sub.allergens.map(a => a.toLowerCase());
            return !subAllergens.some(sa => allergenSet.has(sa));
          });

          if (safeSubstitutes.length > 0) {
            log(`     ✅ Ingredient is SUBSTITUTABLE with safe options: [${safeSubstitutes.map(s => s.name).join(', ')}]`);
            substitutableAllergens.add(ingredient.name);
            modificationSuggestions.push(
              `Substitute ${ingredient.name} with ${safeSubstitutes.map(s => s.name).join(' or ')}`
            );
          } else {
            log(`     ⚠️ Ingredient is substitutable but NO safe substitutes found`);
          }
        } else if (
          // Fallback to text-based modification_policy for backwards compatibility
          menuItem.modification_policy &&
          (menuItem.modification_policy.toLowerCase().includes('remove') ||
          menuItem.modification_policy.toLowerCase().includes('optional') ||
          menuItem.modification_policy.toLowerCase().includes('substitute'))
        ) {
          log(`     ✅ Matched via modification_policy text fallback → added to removableAllergens`);
          removableAllergens.add(ingredient.name);
          modificationSuggestions.push(`Remove ${ingredient.name}`);
        } else {
          log(`     ❌ NOT modifiable → stays as non-removable foundAllergen "${ingredient.name}"`);
        }
      }
    }
  }

  log(`\nChecking ${cookingSteps.length} cooking steps:`);
  for (const step of cookingSteps) {
    log(`  Step: "${step.description}"`);
    log(`    cross_contact_risk: [${step.cross_contact_risk.join(', ')}]`);
    log(`    is_modifiable: ${step.is_modifiable}, modifiable_allergens: [${(step.modifiable_allergens || []).join(', ')}]`);
    for (const risk of step.cross_contact_risk) {
      const riskLower = risk.toLowerCase();
      for (const allergen of allergenSet) {
        if (riskLower.includes(allergen)) {
          // Check if this cooking step can be modified to avoid this allergen
          if (step.is_modifiable && step.modifiable_allergens?.some(
            (ma: string) => ma.toLowerCase().includes(allergen)
          )) {
            log(`    ✅ Cross-contact "${risk}" is MODIFIABLE for "${allergen}" → added to removableAllergens as "${risk}"`);
            modificationSuggestions.push(
              `Modify cooking step "${step.description}": ${step.modification_notes || 'Ask chef for details'}`
            );
            removableAllergens.add(risk);
          } else {
            log(`    ❌ Cross-contact "${risk}" is NOT modifiable for "${allergen}" → added to crossContactRisks`);
            crossContactRisks.push(`${step.description} (risk: ${risk})`);
          }
          foundAllergens.add(risk);
        }
      }
    }
  }

  log(`\n--- DECISION INPUTS ---`);
  log(`foundAllergens:`, Array.from(foundAllergens));
  log(`removableAllergens:`, Array.from(removableAllergens));
  log(`substitutableAllergens:`, Array.from(substitutableAllergens));
  log(`descriptionAllergenMatches:`, Array.from(descriptionAllergenMatches));
  log(`crossContactRisks:`, crossContactRisks);

  if (foundAllergens.size === 0 && crossContactRisks.length === 0) {
    log(`→ No allergens found → SAFE`);
    return {
      status: 'safe',
      reasons: ['No allergens or cross-contact risks detected'],
    };
  }

  // Add description allergen warning
  if (descriptionAllergenMatches.size > 0) {
    reasons.push(`Mentioned in description: ${Array.from(descriptionAllergenMatches).join(', ')}`);
  }

  if (crossContactRisks.length > 0) {
    reasons.push(`Cross-contamination risk: ${Array.from(crossContactRisks).join(', ')}`);
  }

  // Combine removable and substitutable allergens for "safe with modifications" check
  const modifiableAllergens = new Set([...removableAllergens, ...substitutableAllergens]);

  log(`modifiableAllergens (removable ∪ substitutable):`, Array.from(modifiableAllergens));
  log(`\n--- YELLOW CHECK ---`);
  log(`foundAllergens.size (${foundAllergens.size}) === modifiableAllergens.size (${modifiableAllergens.size})? ${foundAllergens.size === modifiableAllergens.size}`);
  log(`crossContactRisks.length === 0? ${crossContactRisks.length === 0}`);
  log(`descriptionAllergenMatches.size === 0? ${descriptionAllergenMatches.size === 0}`);

  // Check if every foundAllergen is in modifiableAllergens
  const missingFromModifiable = Array.from(foundAllergens).filter(a => !modifiableAllergens.has(a));
  if (missingFromModifiable.length > 0) {
    log(`⚠️ foundAllergens NOT in modifiableAllergens: [${missingFromModifiable.join(', ')}]`);
    log(`   This is likely the reason for RED instead of YELLOW!`);
  }

  if (foundAllergens.size > 0 && modifiableAllergens.size === foundAllergens.size && crossContactRisks.length === 0 && descriptionAllergenMatches.size === 0) {
    log(`→ All allergens are modifiable → SAFE-WITH-MODIFICATIONS (YELLOW)`);
    reasons.push(`Contains: ${Array.from(foundAllergens).join(', ')}`);
    return {
      status: 'safe-with-modifications',
      reasons,
      modificationSuggestions,
    };
  }

  const nonModifiableAllergens = Array.from(foundAllergens).filter(a => !modifiableAllergens.has(a) && !descriptionAllergenMatches.has(a));

  if (nonModifiableAllergens.length > 0) {
    reasons.push(`Contains non-removable allergens: ${nonModifiableAllergens.join(', ')}`);
  }

  // Only show "Contains" for ingredient allergens not already mentioned
  const ingredientAllergens = Array.from(foundAllergens).filter(a => !descriptionAllergenMatches.has(a));
  if (ingredientAllergens.length > 0) {
    reasons.push(`Contains: ${ingredientAllergens.join(', ')}`);
  }

  log(`→ UNSAFE (RED) — reasons:`, reasons);
  return {
    status: 'unsafe',
    reasons,
    modificationSuggestions: modificationSuggestions.length > 0 ? modificationSuggestions : undefined,
    crossContactRisks: crossContactRisks.length > 0 ? crossContactRisks : undefined,
  };
}

export function getStatusColor(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'text-green-600 bg-green-50';
    case 'safe-with-modifications':
      return 'text-orange-600 bg-orange-50';
    case 'unsafe':
      return 'text-red-600 bg-red-50';
  }
}

export function getStatusIcon(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return '🟢';
    case 'safe-with-modifications':
      return '🟠';
    case 'unsafe':
      return '🔴';
  }
}

export function getStatusLabel(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'Safe';
    case 'safe-with-modifications':
      return 'Safe with modifications';
    case 'unsafe':
      return 'Unsafe';
  }
}
