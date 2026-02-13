import { useState, useEffect } from 'react';
import { supabase, Database, WeightUnit } from '../../lib/supabase';
import { ArrowLeft, ChevronDown, ChevronUp, Trash2, Repeat, Check, Loader2, X, Settings } from 'lucide-react';
import { COMMON_ALLERGENS } from '../../lib/openai';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

interface IngredientWithMods extends Ingredient {
  menuItemIngredientId: string;
  amount_value: number | null;
  amount_unit: WeightUnit | null;
  is_removable: boolean;
  is_substitutable: boolean;
}

interface MenuItemWithDetails extends MenuItem {
  ingredients: IngredientWithMods[];
  cookingSteps: CookingStep[];
}

interface ChefModificationsProps {
  restaurantId: string;
  onBack?: () => void;
  onComplete?: () => void;
}

export default function ChefModifications({ restaurantId, onBack, onComplete }: ChefModificationsProps) {
  const [menuItems, setMenuItems] = useState<MenuItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllDishes();
  }, [restaurantId]);

  const loadAllDishes = async () => {
    try {
      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (!items || items.length === 0) {
        setLoading(false);
        return;
      }

      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          // Load ingredients
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*, ingredient:ingredients(*)')
            .eq('menu_item_id', item.id);

          const ingredients: IngredientWithMods[] = (menuItemIngredients || []).map((mii: {
            id: string;
            ingredient_id: string;
            amount_value: number | null;
            amount_unit: WeightUnit | null;
            is_removable: boolean;
            is_substitutable: boolean;
            ingredient: Ingredient;
          }) => ({
            ...mii.ingredient,
            menuItemIngredientId: mii.id,
            amount_value: mii.amount_value,
            amount_unit: mii.amount_unit,
            is_removable: mii.is_removable || false,
            is_substitutable: mii.is_substitutable || false,
          }));

          // Load cooking steps
          const { data: cookingSteps } = await supabase
            .from('cooking_steps')
            .select('*')
            .eq('menu_item_id', item.id)
            .order('step_number');

          return {
            ...item,
            ingredients,
            cookingSteps: cookingSteps || [],
          };
        })
      );

      setMenuItems(itemsWithDetails);
    } catch (err) {
      console.error('Error loading dishes:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleIngredientRemovable = async (menuItemIngredientId: string, itemId: string) => {
    const item = menuItems.find(i => i.id === itemId);
    const ing = item?.ingredients.find(i => i.menuItemIngredientId === menuItemIngredientId);
    if (!ing) return;

    setSaving(menuItemIngredientId);
    await supabase.from('menu_item_ingredients')
      .update({ is_removable: !ing.is_removable })
      .eq('id', menuItemIngredientId);

    setMenuItems(prev => prev.map(mi =>
      mi.id === itemId ? {
        ...mi,
        ingredients: mi.ingredients.map(i =>
          i.menuItemIngredientId === menuItemIngredientId
            ? { ...i, is_removable: !i.is_removable }
            : i
        ),
      } : mi
    ));
    setSaving(null);
  };

  const toggleIngredientSubstitutable = async (menuItemIngredientId: string, itemId: string) => {
    const item = menuItems.find(i => i.id === itemId);
    const ing = item?.ingredients.find(i => i.menuItemIngredientId === menuItemIngredientId);
    if (!ing) return;

    setSaving(menuItemIngredientId);
    await supabase.from('menu_item_ingredients')
      .update({ is_substitutable: !ing.is_substitutable })
      .eq('id', menuItemIngredientId);

    setMenuItems(prev => prev.map(mi =>
      mi.id === itemId ? {
        ...mi,
        ingredients: mi.ingredients.map(i =>
          i.menuItemIngredientId === menuItemIngredientId
            ? { ...i, is_substitutable: !i.is_substitutable }
            : i
        ),
      } : mi
    ));
    setSaving(null);
  };

  const toggleStepModifiable = async (stepId: string, itemId: string) => {
    const item = menuItems.find(i => i.id === itemId);
    const step = item?.cookingSteps.find(s => s.id === stepId);
    if (!step) return;

    setSaving(stepId);
    await supabase.from('cooking_steps')
      .update({ is_modifiable: !step.is_modifiable })
      .eq('id', stepId);

    setMenuItems(prev => prev.map(mi =>
      mi.id === itemId ? {
        ...mi,
        cookingSteps: mi.cookingSteps.map(s =>
          s.id === stepId ? { ...s, is_modifiable: !s.is_modifiable } : s
        ),
      } : mi
    ));
    setSaving(null);
  };

  const updateStepModifiableAllergens = async (stepId: string, itemId: string, allergens: string[]) => {
    await supabase.from('cooking_steps')
      .update({ modifiable_allergens: allergens })
      .eq('id', stepId);

    setMenuItems(prev => prev.map(mi =>
      mi.id === itemId ? {
        ...mi,
        cookingSteps: mi.cookingSteps.map(s =>
          s.id === stepId ? { ...s, modifiable_allergens: allergens } : s
        ),
      } : mi
    ));
  };

  const updateStepModificationNotes = async (stepId: string, itemId: string, notes: string) => {
    await supabase.from('cooking_steps')
      .update({ modification_notes: notes || null })
      .eq('id', stepId);

    setMenuItems(prev => prev.map(mi =>
      mi.id === itemId ? {
        ...mi,
        cookingSteps: mi.cookingSteps.map(s =>
          s.id === stepId ? { ...s, modification_notes: notes } : s
        ),
      } : mi
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-white text-sm">Loading your dishes...</p>
        </div>
      </div>
    );
  }

  const totalModifiable = menuItems.reduce((acc, item) => {
    const modIngredients = item.ingredients.filter(i => i.is_removable || i.is_substitutable).length;
    const modSteps = item.cookingSteps.filter(s => s.is_modifiable).length;
    return acc + modIngredients + modSteps;
  }, 0);

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dish Details</span>
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Review Modifications</h1>
              <p className="text-slate-400 text-sm">Step 4 of 5</p>
            </div>
          </div>
          <p className="text-slate-300 mt-3">
            Review each dish and mark which ingredients can be removed or substituted, and which cooking steps
            can be adjusted to accommodate guests with allergies — without changing the integrity of your dish.
          </p>
          {totalModifiable > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-900/50 border border-emerald-700/50 rounded-full">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">{totalModifiable} modification{totalModifiable !== 1 ? 's' : ''} set</span>
            </div>
          )}
        </div>

        {/* Dish List */}
        {menuItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No dishes found. Go back and add some dishes first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {menuItems.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const modCount = item.ingredients.filter(i => i.is_removable || i.is_substitutable).length
                + item.cookingSteps.filter(s => s.is_modifiable).length;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Dish Header */}
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        {item.category && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{item.category}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{item.ingredients.length} ingredient{item.ingredients.length !== 1 ? 's' : ''}</span>
                        <span>{item.cookingSteps.length} cooking step{item.cookingSteps.length !== 1 ? 's' : ''}</span>
                        {modCount > 0 && (
                          <span className="text-emerald-600 font-medium">{modCount} modification{modCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-6 border-t border-slate-100">
                      {/* Ingredients Section */}
                      {item.ingredients.length > 0 && (
                        <div className="pt-4">
                          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            Ingredients
                            <span className="text-xs font-normal text-slate-400">— mark what can be modified</span>
                          </h4>
                          <div className="space-y-2">
                            {item.ingredients.map((ing) => (
                              <div key={ing.menuItemIngredientId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-900">{ing.name}</span>
                                    {ing.contains_allergens?.length > 0 && (
                                      <div className="flex gap-1">
                                        {ing.contains_allergens.map((a: string) => (
                                          <span key={a} className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{a}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={ing.is_removable}
                                      onChange={() => toggleIngredientRemovable(ing.menuItemIngredientId, item.id)}
                                      disabled={saving === ing.menuItemIngredientId}
                                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                    />
                                    <Trash2 className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-xs text-slate-600">Remove</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={ing.is_substitutable}
                                      onChange={() => toggleIngredientSubstitutable(ing.menuItemIngredientId, item.id)}
                                      disabled={saving === ing.menuItemIngredientId}
                                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <Repeat className="w-3.5 h-3.5 text-purple-600" />
                                    <span className="text-xs text-slate-600">Substitute</span>
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cooking Steps Section */}
                      {item.cookingSteps.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            Cooking Steps
                            <span className="text-xs font-normal text-slate-400">— mark steps that can be adjusted</span>
                          </h4>
                          <div className="space-y-3">
                            {item.cookingSteps.map((step) => (
                              <div key={step.id} className="p-3 bg-slate-50 rounded-lg space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-7 h-7 bg-slate-900 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                                    {step.step_number}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-slate-800">{step.description}</p>
                                    {step.cross_contact_risk?.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {step.cross_contact_risk.map((risk: string) => (
                                          <span key={risk} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                                            Risk: {risk}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="ml-10">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={step.is_modifiable}
                                      onChange={() => toggleStepModifiable(step.id, item.id)}
                                      disabled={saving === step.id}
                                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-slate-700">This step can be modified to avoid allergens</span>
                                  </label>

                                  {step.is_modifiable && (
                                    <div className="mt-3 pl-6 space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                          Which allergens can be avoided?
                                        </label>
                                        {(step.modifiable_allergens || []).length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mb-2">
                                            {step.modifiable_allergens.map((allergen: string) => (
                                              <span key={allergen} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                                {allergen}
                                                <button
                                                  type="button"
                                                  onClick={() => updateStepModifiableAllergens(
                                                    step.id, item.id,
                                                    step.modifiable_allergens.filter((a: string) => a !== allergen)
                                                  )}
                                                  className="p-0.5 hover:bg-green-200 rounded-full"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap gap-1.5">
                                          {COMMON_ALLERGENS.filter(a => !(step.modifiable_allergens || []).includes(a)).map((allergen) => (
                                            <button
                                              key={allergen}
                                              type="button"
                                              onClick={() => updateStepModifiableAllergens(
                                                step.id, item.id,
                                                [...(step.modifiable_allergens || []), allergen]
                                              )}
                                              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full hover:bg-green-100 hover:text-green-700 transition-colors"
                                            >
                                              + {allergen}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                          How can this step be modified?
                                        </label>
                                        <textarea
                                          value={step.modification_notes || ''}
                                          onChange={(e) => updateStepModificationNotes(step.id, item.id, e.target.value)}
                                          placeholder="e.g., Can use separate fryer, can substitute oil, can skip this step..."
                                          rows={2}
                                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {item.ingredients.length === 0 && item.cookingSteps.length === 0 && (
                        <div className="pt-4 text-center">
                          <p className="text-sm text-slate-400">No ingredients or cooking steps to modify. Go back and add details first.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {totalModifiable > 0 ? (
              <span className="text-emerald-600 font-medium">{totalModifiable} modification{totalModifiable !== 1 ? 's' : ''} configured</span>
            ) : (
              <span>No modifications set yet</span>
            )}
          </div>
          <button
            onClick={onComplete}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg"
          >
            Continue to Review
          </button>
        </div>
      </div>
    </div>
  );
}
