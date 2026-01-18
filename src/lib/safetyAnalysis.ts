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

// Extended MenuItem type to include description_allergens
interface MenuItemWithDescriptionAllergens extends MenuItem {
  description_allergens?: string[];
}

export function analyzeDishSafety(
  menuItem: MenuItem | MenuItemWithDescriptionAllergens,
  ingredients: (Ingredient | IngredientWithModifications)[],
  cookingSteps: CookingStep[],
  customerAllergens: string[]
): SafetyAnalysis {
  const reasons: string[] = [];
  const modificationSuggestions: string[] = [];
  const crossContactRisks: string[] = [];

  if (customerAllergens.length === 0) {
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
    for (const descAllergen of itemWithDescAllergens.description_allergens) {
      const descAllergenLower = descAllergen.toLowerCase();
      for (const customerAllergen of allergenSet) {
        if (descAllergenLower.includes(customerAllergen) || customerAllergen.includes(descAllergenLower)) {
          descriptionAllergenMatches.add(descAllergen);
          foundAllergens.add(descAllergen);
        }
      }
    }
  }

  for (const ingredient of ingredients) {
    const ingredientName = ingredient.name.toLowerCase();
    const ingredientAllergens = ingredient.contains_allergens.map(a => a.toLowerCase());
    const ingWithMods = ingredient as IngredientWithModifications;

    for (const allergen of allergenSet) {
      if (ingredientName.includes(allergen) || ingredientAllergens.includes(allergen)) {
        foundAllergens.add(ingredient.name);

        // Check structured modification flags first
        if (ingWithMods.is_removable) {
          removableAllergens.add(ingredient.name);
          modificationSuggestions.push(`Remove ${ingredient.name}`);
        } else if (ingWithMods.is_substitutable) {
          // Check if any substitutes are safe for the customer
          const safeSubstitutes = (ingWithMods.substitutes || []).filter(sub => {
            const subAllergens = sub.allergens.map(a => a.toLowerCase());
            return !subAllergens.some(sa => allergenSet.has(sa));
          });

          if (safeSubstitutes.length > 0) {
            substitutableAllergens.add(ingredient.name);
            modificationSuggestions.push(
              `Substitute ${ingredient.name} with ${safeSubstitutes.map(s => s.name).join(' or ')}`
            );
          }
        } else if (
          // Fallback to text-based modification_policy for backwards compatibility
          menuItem.modification_policy &&
          (menuItem.modification_policy.toLowerCase().includes('remove') ||
          menuItem.modification_policy.toLowerCase().includes('optional') ||
          menuItem.modification_policy.toLowerCase().includes('substitute'))
        ) {
          removableAllergens.add(ingredient.name);
          modificationSuggestions.push(`Remove ${ingredient.name}`);
        }
      }
    }
  }

  for (const step of cookingSteps) {
    for (const risk of step.cross_contact_risk) {
      const riskLower = risk.toLowerCase();
      for (const allergen of allergenSet) {
        if (riskLower.includes(allergen)) {
          crossContactRisks.push(`${step.description} (risk: ${risk})`);
          foundAllergens.add(risk);
        }
      }
    }
  }

  if (foundAllergens.size === 0 && crossContactRisks.length === 0) {
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

  // Description allergens are not modifiable (can't remove what's described in the dish)
  const allNonModifiable = new Set([
    ...Array.from(foundAllergens).filter(a => !modifiableAllergens.has(a)),
    ...descriptionAllergenMatches
  ]);

  if (foundAllergens.size > 0 && modifiableAllergens.size === foundAllergens.size && crossContactRisks.length === 0 && descriptionAllergenMatches.size === 0) {
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
