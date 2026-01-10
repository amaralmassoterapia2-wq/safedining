import { Database } from './supabase';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

export type SafetyStatus = 'safe' | 'safe-with-modifications' | 'unsafe';

export interface SafetyAnalysis {
  status: SafetyStatus;
  reasons: string[];
  modificationSuggestions?: string[];
  crossContactRisks?: string[];
}

export function analyzeDishSafety(
  menuItem: MenuItem,
  ingredients: Ingredient[],
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

  for (const ingredient of ingredients) {
    const ingredientName = ingredient.name.toLowerCase();
    const ingredientAllergens = ingredient.contains_allergens.map(a => a.toLowerCase());

    for (const allergen of allergenSet) {
      if (ingredientName.includes(allergen) || ingredientAllergens.includes(allergen)) {
        foundAllergens.add(ingredient.name);

        if (
          menuItem.modification_policy.toLowerCase().includes('remove') ||
          menuItem.modification_policy.toLowerCase().includes('optional') ||
          menuItem.modification_policy.toLowerCase().includes('substitute')
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

  if (crossContactRisks.length > 0) {
    reasons.push(`Cross-contamination risk: ${Array.from(crossContactRisks).join(', ')}`);
  }

  if (foundAllergens.size > 0 && removableAllergens.size === foundAllergens.size && crossContactRisks.length === 0) {
    reasons.push(`Contains: ${Array.from(foundAllergens).join(', ')}`);
    return {
      status: 'safe-with-modifications',
      reasons,
      modificationSuggestions,
    };
  }

  const nonRemovableAllergens = Array.from(foundAllergens).filter(a => !removableAllergens.has(a));

  if (nonRemovableAllergens.length > 0) {
    reasons.push(`Contains non-removable allergens: ${nonRemovableAllergens.join(', ')}`);
  }

  if (foundAllergens.size > 0) {
    reasons.push(`Contains: ${Array.from(foundAllergens).join(', ')}`);
  }

  return {
    status: 'unsafe',
    reasons,
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
