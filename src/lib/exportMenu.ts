import { supabase } from './supabase';

function escapeCSV(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export async function exportMenuToCSV(restaurantId: string, restaurantName: string): Promise<void> {
  // Fetch all active menu items
  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (itemsError) throw itemsError;
  if (!items || items.length === 0) throw new Error('No menu items to export');

  // For each item, fetch ingredients, substitutes, and cooking steps
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const { data: menuItemIngredients } = await supabase
        .from('menu_item_ingredients')
        .select('*, ingredient:ingredients(*)')
        .eq('menu_item_id', item.id);

      const miiIds = (menuItemIngredients || []).map((mii: any) => mii.id);

      const { data: substitutesData } = miiIds.length > 0
        ? await supabase
            .from('ingredient_substitutes')
            .select('*, substitute:ingredients(*)')
            .in('menu_item_ingredient_id', miiIds)
        : { data: [] };

      const { data: cookingSteps } = await supabase
        .from('cooking_steps')
        .select('*')
        .eq('menu_item_id', item.id)
        .order('step_number');

      // Collect all allergens from ingredients
      const ingredientAllergens = new Set<string>();
      const removable: string[] = [];
      const substitutable: string[] = [];

      for (const mii of menuItemIngredients || []) {
        const ing = (mii as any).ingredient;
        if (!ing) continue;

        for (const allergen of ing.contains_allergens || []) {
          ingredientAllergens.add(allergen);
        }

        if (mii.is_removable) {
          const allergenInfo = (ing.contains_allergens || []).length > 0
            ? ` (${(ing.contains_allergens || []).join(', ')})`
            : '';
          removable.push(`${ing.name}${allergenInfo}`);
        }

        if (mii.is_substitutable) {
          const subs = (substitutesData || [])
            .filter((s: any) => s.menu_item_ingredient_id === mii.id)
            .map((s: any) => s.substitute?.name || 'Unknown')
            .join(', ');
          const subInfo = subs ? ` -> ${subs}` : '';
          substitutable.push(`${ing.name}${subInfo}`);
        }
      }

      // Add description-level allergens
      for (const allergen of item.description_allergens || []) {
        ingredientAllergens.add(allergen);
      }

      // Collect cross-contact risks
      const crossContactRisks = new Set<string>();
      for (const step of cookingSteps || []) {
        for (const risk of step.cross_contact_risk || []) {
          crossContactRisks.add(risk);
        }
      }

      return {
        category: item.category || 'Other',
        name: item.name,
        description: item.description || '',
        price: item.price != null ? `$${Number(item.price).toFixed(2)}` : '',
        allergens: Array.from(ingredientAllergens).join(', '),
        crossContactRisks: Array.from(crossContactRisks).join(', '),
        removable: removable.join('; '),
        substitutable: substitutable.join('; '),
        calories: item.calories ?? '',
        protein: item.protein_g ?? '',
      };
    })
  );

  // Build CSV
  const headers = [
    'Category',
    'Dish Name',
    'Description',
    'Price',
    'Allergens',
    'Cross-Contact Risks',
    'Removable Ingredients',
    'Substitutable Ingredients',
    'Calories',
    'Protein (g)',
  ];

  const rows: string[][] = [];

  // Group by category
  const grouped: Record<string, typeof enrichedItems> = {};
  for (const item of enrichedItems) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  for (const [category, categoryItems] of Object.entries(grouped)) {
    // Category header row
    rows.push([category, '', '', '', '', '', '', '', '', '']);

    for (const item of categoryItems) {
      rows.push([
        '',
        item.name,
        item.description,
        item.price,
        item.allergens,
        item.crossContactRisks,
        item.removable,
        item.substitutable,
        String(item.calories),
        String(item.protein),
      ]);
    }

    // Blank separator row
    rows.push(['', '', '', '', '', '', '', '', '', '']);
  }

  // BOM for Excel UTF-8 support
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${restaurantName.replace(/\s+/g, '-')}-allergen-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
