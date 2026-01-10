import { useState, useEffect } from 'react';
import { supabase, Database } from '../../lib/supabase';
import { ArrowLeft, Plus, X, AlertCircle } from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

interface MenuItemFormProps {
  restaurantId: string;
  editingItem: MenuItem | null;
  onClose: () => void;
}

interface IngredientInput {
  id?: string;
  name: string;
  amount: string;
  contains_allergens: string[];
}

interface CookingStepInput {
  id?: string;
  step_number: number;
  description: string;
  cross_contact_risk: string[];
}

const COMMON_ALLERGENS = [
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soybeans',
  'Sesame',
];

export default function MenuItemForm({
  restaurantId,
  editingItem,
  onClose,
}: MenuItemFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [modificationPolicy, setModificationPolicy] = useState('');
  const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
  const [cookingSteps, setCookingSteps] = useState<CookingStepInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) {
      loadItemDetails();
    }
  }, [editingItem]);

  const loadItemDetails = async () => {
    if (!editingItem) return;

    setName(editingItem.name);
    setDescription(editingItem.description || '');
    setPrice(editingItem.price ? editingItem.price.toString() : '');
    setCategory(editingItem.category || '');
    setModificationPolicy(editingItem.modification_policy);

    const [{ data: ingredientsData }, { data: stepsData }] = await Promise.all([
      supabase
        .from('ingredients')
        .select('*')
        .eq('menu_item_id', editingItem.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('cooking_steps')
        .select('*')
        .eq('menu_item_id', editingItem.id)
        .order('step_number', { ascending: true }),
    ]);

    if (ingredientsData) {
      setIngredients(
        ingredientsData.map((ing) => ({
          id: ing.id,
          name: ing.name,
          amount: ing.amount,
          contains_allergens: ing.contains_allergens,
        }))
      );
    }

    if (stepsData) {
      setCookingSteps(
        stepsData.map((step) => ({
          id: step.id,
          step_number: step.step_number,
          description: step.description,
          cross_contact_risk: step.cross_contact_risk,
        }))
      );
    }
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      { name: '', amount: '', contains_allergens: [] },
    ]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientInput, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addCookingStep = () => {
    setCookingSteps([
      ...cookingSteps,
      {
        step_number: cookingSteps.length + 1,
        description: '',
        cross_contact_risk: [],
      },
    ]);
  };

  const removeCookingStep = (index: number) => {
    const updated = cookingSteps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, step_number: i + 1 }));
    setCookingSteps(updated);
  };

  const updateCookingStep = (
    index: number,
    field: keyof CookingStepInput,
    value: any
  ) => {
    const updated = [...cookingSteps];
    updated[index] = { ...updated[index], [field]: value };
    setCookingSteps(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const menuItemData = {
        restaurant_id: restaurantId,
        name: name.trim(),
        description: description.trim() || null,
        price: price ? parseFloat(price) : null,
        category: category.trim() || null,
        modification_policy: modificationPolicy.trim(),
        is_active: true,
      };

      let menuItemId: string;

      if (editingItem) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update(menuItemData)
          .eq('id', editingItem.id);

        if (updateError) throw updateError;
        menuItemId = editingItem.id;

        await supabase.from('ingredients').delete().eq('menu_item_id', menuItemId);
        await supabase.from('cooking_steps').delete().eq('menu_item_id', menuItemId);
      } else {
        const { data, error: insertError } = await supabase
          .from('menu_items')
          .insert(menuItemData)
          .select()
          .single();

        if (insertError || !data) throw insertError || new Error('Failed to create menu item');
        menuItemId = data.id;
      }

      if (ingredients.length > 0) {
        const ingredientsToInsert = ingredients
          .filter((ing) => ing.name.trim())
          .map((ing) => ({
            menu_item_id: menuItemId,
            name: ing.name.trim(),
            amount: ing.amount.trim(),
            contains_allergens: ing.contains_allergens,
          }));

        if (ingredientsToInsert.length > 0) {
          const { error: ingError } = await supabase
            .from('ingredients')
            .insert(ingredientsToInsert);

          if (ingError) throw ingError;
        }
      }

      if (cookingSteps.length > 0) {
        const stepsToInsert = cookingSteps
          .filter((step) => step.description.trim())
          .map((step) => ({
            menu_item_id: menuItemId,
            step_number: step.step_number,
            description: step.description.trim(),
            cross_contact_risk: step.cross_contact_risk,
          }));

        if (stepsToInsert.length > 0) {
          const { error: stepError } = await supabase
            .from('cooking_steps')
            .insert(stepsToInsert);

          if (stepError) throw stepError;
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save menu item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Provide detailed information to help customers with dietary restrictions
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Basic Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Dish Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Caesar Salad"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Appetizers, Entrees"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the dish"
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modification Policy *
              </label>
              <textarea
                value={modificationPolicy}
                onChange={(e) => setModificationPolicy(e.target.value)}
                required
                placeholder="e.g., Most ingredients can be removed or substituted upon request. Please ask your server."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Ingredients</h3>
            <button
              type="button"
              onClick={addIngredient}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Ingredient
            </button>
          </div>

          <div className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-lg space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ingredient.name}
                    onChange={(e) =>
                      updateIngredient(index, 'name', e.target.value)
                    }
                    placeholder="Ingredient name"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={ingredient.amount}
                    onChange={(e) =>
                      updateIngredient(index, 'amount', e.target.value)
                    }
                    placeholder="Amount"
                    className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Contains Allergens:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGENS.map((allergen) => (
                      <label
                        key={allergen}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={ingredient.contains_allergens.includes(
                            allergen
                          )}
                          onChange={(e) => {
                            const allergens = e.target.checked
                              ? [...ingredient.contains_allergens, allergen]
                              : ingredient.contains_allergens.filter(
                                  (a) => a !== allergen
                                );
                            updateIngredient(
                              index,
                              'contains_allergens',
                              allergens
                            );
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-700">{allergen}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {ingredients.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No ingredients added yet. Click "Add Ingredient" to start.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Cooking Steps</h3>
            <button
              type="button"
              onClick={addCookingStep}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>

          <div className="space-y-3">
            {cookingSteps.map((step, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    {step.step_number}
                  </div>
                  <textarea
                    value={step.description}
                    onChange={(e) =>
                      updateCookingStep(index, 'description', e.target.value)
                    }
                    placeholder="Describe this cooking step"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeCookingStep(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Cross-Contact Risks:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGENS.map((allergen) => (
                      <label
                        key={allergen}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={step.cross_contact_risk.includes(allergen)}
                          onChange={(e) => {
                            const risks = e.target.checked
                              ? [...step.cross_contact_risk, allergen]
                              : step.cross_contact_risk.filter(
                                  (r) => r !== allergen
                                );
                            updateCookingStep(index, 'cross_contact_risk', risks);
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-700">{allergen}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {cookingSteps.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No cooking steps added yet. Click "Add Step" to start.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim() || !modificationPolicy.trim()}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : editingItem ? 'Update Menu Item' : 'Create Menu Item'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
