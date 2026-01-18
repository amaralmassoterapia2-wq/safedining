import { useState, useEffect, useRef } from 'react';
import { supabase, Database, WeightUnit, WEIGHT_UNITS } from '../../lib/supabase';
import { ArrowLeft, Plus, X, AlertCircle, Search, Loader2, Edit3, ChevronDown, ChevronUp, Repeat, Trash2 } from 'lucide-react';
import { detectAllergens, detectCrossContactRisks, detectAllergensFromDescription, COMMON_ALLERGENS } from '../../lib/openai';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];

interface MenuItemFormProps {
  restaurantId: string;
  editingItem: MenuItem | null;
  onClose: () => void;
}

interface SubstituteInput {
  ingredientId?: string;
  name: string;
  allergens: string[];
  isNew: boolean;
}

interface IngredientInput {
  id?: string; // menu_item_ingredients.id
  ingredientId?: string; // ingredients.id
  name: string;
  amountValue: number | null;
  amountUnit: WeightUnit;
  allergens: string[];
  isNew: boolean;
  isRemovable: boolean;
  isSubstitutable: boolean;
  substitutes: SubstituteInput[];
}

interface CookingStepInput {
  id?: string;
  step_number: number;
  description: string;
  cross_contact_risk: string[];
}

export default function MenuItemForm({
  restaurantId,
  editingItem,
  onClose,
}: MenuItemFormProps) {
  // Basic info state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');

  // Ingredients state
  const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
  const [existingIngredients, setExistingIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientAmount, setNewIngredientAmount] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState<WeightUnit>('g');
  const [detectingAllergens, setDetectingAllergens] = useState(false);
  const [editingAllergenIndex, setEditingAllergenIndex] = useState<number | null>(null);
  const [customAllergenInput, setCustomAllergenInput] = useState('');
  const allergenEditorRef = useRef<HTMLDivElement>(null);

  // Substitute adding state
  const [addingSubstituteIndex, setAddingSubstituteIndex] = useState<number | null>(null);
  const [substituteSearchQuery, setSubstituteSearchQuery] = useState('');
  const [detectingSubstituteAllergens, setDetectingSubstituteAllergens] = useState(false);

  // Cooking steps state
  const [cookingSteps, setCookingSteps] = useState<CookingStepInput[]>([]);
  const [detectingCrossContact, setDetectingCrossContact] = useState<number | null>(null);
  const crossContactDebounceRef = useRef<{ [key: number]: NodeJS.Timeout }>({});

  // Description allergen detection state
  const [descriptionAllergens, setDescriptionAllergens] = useState<string[]>([]);
  const [detectingDescriptionAllergens, setDetectingDescriptionAllergens] = useState(false);
  const descriptionDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIngredients, setExpandedIngredients] = useState<Set<number>>(new Set());

  // Load existing ingredients on mount
  useEffect(() => {
    loadExistingIngredients();
  }, [restaurantId]);

  // Load item details when editing
  useEffect(() => {
    if (editingItem) {
      loadItemDetails();
    }
  }, [editingItem]);

  // Close allergen editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (allergenEditorRef.current && !allergenEditorRef.current.contains(event.target as Node)) {
        setEditingAllergenIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadExistingIngredients = async () => {
    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');

    if (data) {
      setExistingIngredients(data);
    }
  };

  const loadItemDetails = async () => {
    if (!editingItem) return;

    setName(editingItem.name);
    setDescription(editingItem.description || '');
    setDescriptionAllergens(editingItem.description_allergens || []);
    setPrice(editingItem.price ? editingItem.price.toString() : '');
    setCategory(editingItem.category || '');

    // Load ingredients with modification settings and substitutes
    const { data: menuItemIngredients } = await supabase
      .from('menu_item_ingredients')
      .select('*, ingredient:ingredients(*)')
      .eq('menu_item_id', editingItem.id);

    if (menuItemIngredients) {
      const ingredientsWithSubs = await Promise.all(
        menuItemIngredients.map(async (mii: any) => {
          // Load substitutes for this menu_item_ingredient
          const { data: subs } = await supabase
            .from('ingredient_substitutes')
            .select('*, substitute:ingredients(*)')
            .eq('menu_item_ingredient_id', mii.id);

          const substitutes: SubstituteInput[] = (subs || []).map((sub: any) => ({
            ingredientId: sub.substitute_ingredient_id,
            name: sub.substitute?.name || '',
            allergens: sub.substitute?.contains_allergens || [],
            isNew: false,
          }));

          return {
            id: mii.id,
            ingredientId: mii.ingredient_id,
            name: mii.ingredient?.name || '',
            amountValue: mii.amount_value,
            amountUnit: mii.amount_unit || 'g',
            allergens: mii.ingredient?.contains_allergens || [],
            isNew: false,
            isRemovable: mii.is_removable || false,
            isSubstitutable: mii.is_substitutable || false,
            substitutes,
          };
        })
      );

      setIngredients(ingredientsWithSubs);
    }

    // Load cooking steps
    const { data: stepsData } = await supabase
      .from('cooking_steps')
      .select('*')
      .eq('menu_item_id', editingItem.id)
      .order('step_number');

    if (stepsData) {
      setCookingSteps(
        stepsData.map((step) => ({
          id: step.id,
          step_number: step.step_number,
          description: step.description,
          cross_contact_risk: step.cross_contact_risk || [],
        }))
      );
    }
  };

  // Filter existing ingredients based on search
  const filteredExistingIngredients = existingIngredients.filter(
    (ing) =>
      ing.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !ingredients.some((i) => i.name.toLowerCase() === ing.name.toLowerCase())
  );

  // Filter for substitute search
  const filteredSubstituteIngredients = existingIngredients.filter(
    (ing) =>
      ing.name.toLowerCase().includes(substituteSearchQuery.toLowerCase()) &&
      addingSubstituteIndex !== null &&
      !ingredients[addingSubstituteIndex]?.substitutes.some(
        (s) => s.name.toLowerCase() === ing.name.toLowerCase()
      ) &&
      ing.name.toLowerCase() !== ingredients[addingSubstituteIndex]?.name.toLowerCase()
  );

  const handleAddExistingIngredient = (ingredient: Ingredient) => {
    setIngredients([
      ...ingredients,
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        amountValue: null,
        amountUnit: 'g',
        allergens: ingredient.contains_allergens,
        isNew: false,
        isRemovable: false,
        isSubstitutable: false,
        substitutes: [],
      },
    ]);
    setSearchQuery('');
  };

  const handleAddNewIngredient = async () => {
    if (!newIngredientName.trim()) return;

    const trimmedName = newIngredientName.trim();

    // Check if already exists (case-insensitive)
    const existing = existingIngredients.find(
      (ing) => ing.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      handleAddExistingIngredient(existing);
      setNewIngredientName('');
      setNewIngredientAmount('');
      return;
    }

    setDetectingAllergens(true);
    try {
      const allergens = await detectAllergens(trimmedName);
      const amountVal = newIngredientAmount ? parseFloat(newIngredientAmount) : null;

      setIngredients([
        ...ingredients,
        {
          name: trimmedName,
          amountValue: amountVal,
          amountUnit: newIngredientUnit,
          allergens,
          isNew: true,
          isRemovable: false,
          isSubstitutable: false,
          substitutes: [],
        },
      ]);

      setNewIngredientName('');
      setNewIngredientAmount('');
      setNewIngredientUnit('g');
    } catch (err) {
      console.error('Error detecting allergens:', err);
      // Add with empty allergens if detection fails
      const amountVal = newIngredientAmount ? parseFloat(newIngredientAmount) : null;
      setIngredients([
        ...ingredients,
        {
          name: trimmedName,
          amountValue: amountVal,
          amountUnit: newIngredientUnit,
          allergens: [],
          isNew: true,
          isRemovable: false,
          isSubstitutable: false,
          substitutes: [],
        },
      ]);
      setNewIngredientName('');
      setNewIngredientAmount('');
      setNewIngredientUnit('g');
    } finally {
      setDetectingAllergens(false);
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    setExpandedIngredients((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const updateIngredient = (index: number, updates: Partial<IngredientInput>) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
    );
  };

  const toggleAllergen = (index: number, allergen: string) => {
    const current = ingredients[index].allergens;
    const updated = current.includes(allergen)
      ? current.filter((a) => a !== allergen)
      : [...current, allergen];
    updateIngredient(index, { allergens: updated });
  };

  const addCustomAllergen = (index: number) => {
    if (!customAllergenInput.trim()) return;
    const allergen = customAllergenInput.trim();
    const current = ingredients[index].allergens;
    if (!current.includes(allergen)) {
      updateIngredient(index, { allergens: [...current, allergen] });
    }
    setCustomAllergenInput('');
  };

  const toggleExpandIngredient = (index: number) => {
    setExpandedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Substitute handling
  const handleAddExistingSubstitute = (ingredientIndex: number, substitute: Ingredient) => {
    const current = ingredients[ingredientIndex].substitutes;
    updateIngredient(ingredientIndex, {
      substitutes: [
        ...current,
        {
          ingredientId: substitute.id,
          name: substitute.name,
          allergens: substitute.contains_allergens,
          isNew: false,
        },
      ],
    });
    setSubstituteSearchQuery('');
    setAddingSubstituteIndex(null);
  };

  const handleAddNewSubstitute = async (ingredientIndex: number) => {
    if (!substituteSearchQuery.trim()) return;

    const trimmedName = substituteSearchQuery.trim();

    // Check if already exists
    const existing = existingIngredients.find(
      (ing) => ing.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      handleAddExistingSubstitute(ingredientIndex, existing);
      setSubstituteSearchQuery('');
      return;
    }

    setDetectingSubstituteAllergens(true);
    try {
      const allergens = await detectAllergens(trimmedName);
      const current = ingredients[ingredientIndex].substitutes;
      updateIngredient(ingredientIndex, {
        substitutes: [
          ...current,
          {
            name: trimmedName,
            allergens,
            isNew: true,
          },
        ],
      });
      setSubstituteSearchQuery('');
      setAddingSubstituteIndex(null);
    } catch (err) {
      console.error('Error detecting substitute allergens:', err);
      const current = ingredients[ingredientIndex].substitutes;
      updateIngredient(ingredientIndex, {
        substitutes: [
          ...current,
          {
            name: trimmedName,
            allergens: [],
            isNew: true,
          },
        ],
      });
      setSubstituteSearchQuery('');
      setAddingSubstituteIndex(null);
    } finally {
      setDetectingSubstituteAllergens(false);
    }
  };

  const removeSubstitute = (ingredientIndex: number, substituteIndex: number) => {
    const current = ingredients[ingredientIndex].substitutes;
    updateIngredient(ingredientIndex, {
      substitutes: current.filter((_, i) => i !== substituteIndex),
    });
  };

  // Cooking steps
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
    setCookingSteps(
      cookingSteps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, step_number: i + 1 }))
    );
  };

  const updateCookingStep = (index: number, field: keyof CookingStepInput, value: any) => {
    setCookingSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, [field]: value } : step))
    );

    // Auto-detect cross-contact risks when description changes (debounced 2 seconds)
    if (field === 'description' && typeof value === 'string' && value.trim()) {
      // Clear existing timeout for this step
      if (crossContactDebounceRef.current[index]) {
        clearTimeout(crossContactDebounceRef.current[index]);
      }

      // Set new timeout
      crossContactDebounceRef.current[index] = setTimeout(() => {
        analyzeCrossContactRisksForStep(index, value);
      }, 2000);
    }
  };

  const analyzeCrossContactRisksForStep = async (index: number, description: string) => {
    if (!description.trim()) return;

    setDetectingCrossContact(index);
    try {
      const detectedRisks = await detectCrossContactRisks(description);
      if (detectedRisks.length > 0) {
        // Merge with existing risks, avoiding duplicates
        setCookingSteps((prev) => {
          const step = prev[index];
          if (!step) return prev;
          const currentRisks = step.cross_contact_risk;
          const newRisks = [...new Set([...currentRisks, ...detectedRisks])];
          return prev.map((s, i) => (i === index ? { ...s, cross_contact_risk: newRisks } : s));
        });
      }
    } catch (err) {
      console.error('Error detecting cross-contact risks:', err);
    } finally {
      setDetectingCrossContact(null);
    }
  };

  const analyzeCrossContactRisks = async (index: number) => {
    const step = cookingSteps[index];
    if (!step.description.trim()) return;
    await analyzeCrossContactRisksForStep(index, step.description);
  };

  const removeCrossContactRisk = (stepIndex: number, allergen: string) => {
    const step = cookingSteps[stepIndex];
    updateCookingStep(stepIndex, 'cross_contact_risk', step.cross_contact_risk.filter(r => r !== allergen));
  };

  // Description allergen detection
  const handleDescriptionChange = (value: string) => {
    setDescription(value);

    // Clear existing timeout
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
    }

    // Auto-detect allergens after 2 seconds of inactivity
    if (value.trim()) {
      descriptionDebounceRef.current = setTimeout(() => {
        analyzeDescriptionAllergens(value);
      }, 2000);
    } else {
      setDescriptionAllergens([]);
    }
  };

  const analyzeDescriptionAllergens = async (desc: string) => {
    if (!desc.trim()) return;

    setDetectingDescriptionAllergens(true);
    try {
      const detected = await detectAllergensFromDescription(desc);
      setDescriptionAllergens(detected);
    } catch (err) {
      console.error('Error detecting description allergens:', err);
    } finally {
      setDetectingDescriptionAllergens(false);
    }
  };

  const removeDescriptionAllergen = (allergen: string) => {
    setDescriptionAllergens(prev => prev.filter(a => a !== allergen));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate ingredients have amounts
      const invalidIngredients = ingredients.filter(
        (ing) => ing.amountValue === null || ing.amountValue <= 0
      );
      if (invalidIngredients.length > 0) {
        setError(`Please enter amounts for: ${invalidIngredients.map((i) => i.name).join(', ')}`);
        setLoading(false);
        return;
      }

      const menuItemData = {
        restaurant_id: restaurantId,
        name: name.trim(),
        description: description.trim() || null,
        description_allergens: descriptionAllergens,
        price: price ? parseFloat(price) : null,
        category: category.trim() || null,
        modification_policy: 'See per-ingredient settings', // Deprecated field
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

        // Delete old associations
        await supabase.from('menu_item_ingredients').delete().eq('menu_item_id', menuItemId);
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

      // Save ingredients
      for (const ing of ingredients) {
        if (!ing.name.trim()) continue;

        let ingredientId = ing.ingredientId;

        // Create new ingredient if needed
        if (ing.isNew || !ingredientId) {
          // Check if exists by name first
          const { data: existingIng } = await supabase
            .from('ingredients')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .ilike('name', ing.name.trim())
            .maybeSingle();

          if (existingIng) {
            ingredientId = existingIng.id;
            // Update allergens if changed
            await supabase
              .from('ingredients')
              .update({ contains_allergens: ing.allergens })
              .eq('id', ingredientId);
          } else {
            const { data: newIng, error: ingError } = await supabase
              .from('ingredients')
              .insert({
                restaurant_id: restaurantId,
                name: ing.name.trim(),
                contains_allergens: ing.allergens,
              })
              .select('id')
              .single();

            if (ingError) throw ingError;
            ingredientId = newIng.id;
          }
        } else {
          // Update existing ingredient allergens
          await supabase
            .from('ingredients')
            .update({ contains_allergens: ing.allergens })
            .eq('id', ingredientId);
        }

        // Create menu_item_ingredient junction
        const { data: mii, error: miiError } = await supabase
          .from('menu_item_ingredients')
          .insert({
            menu_item_id: menuItemId,
            ingredient_id: ingredientId,
            amount_value: ing.amountValue,
            amount_unit: ing.amountUnit,
            is_removable: ing.isRemovable,
            is_substitutable: ing.isSubstitutable,
          })
          .select('id')
          .single();

        if (miiError) throw miiError;

        // Save substitutes
        if (ing.isSubstitutable && ing.substitutes.length > 0) {
          for (const sub of ing.substitutes) {
            let subIngredientId = sub.ingredientId;

            // Create new substitute ingredient if needed
            if (sub.isNew || !subIngredientId) {
              const { data: existingSub } = await supabase
                .from('ingredients')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .ilike('name', sub.name.trim())
                .maybeSingle();

              if (existingSub) {
                subIngredientId = existingSub.id;
              } else {
                const { data: newSub, error: subError } = await supabase
                  .from('ingredients')
                  .insert({
                    restaurant_id: restaurantId,
                    name: sub.name.trim(),
                    contains_allergens: sub.allergens,
                  })
                  .select('id')
                  .single();

                if (subError) throw subError;
                subIngredientId = newSub.id;
              }
            }

            // Create substitute link
            await supabase.from('ingredient_substitutes').insert({
              menu_item_ingredient_id: mii.id,
              substitute_ingredient_id: subIngredientId,
            });
          }
        }
      }

      // Save cooking steps
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
      console.error('Save error:', err);
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
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">
            {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Provide detailed information to help customers with dietary restrictions
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
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
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="Brief description of the dish (e.g., 'Grilled salmon with creamy dill sauce')"
                  rows={3}
                  disabled={detectingDescriptionAllergens}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-colors ${
                    detectingDescriptionAllergens
                      ? 'bg-amber-50 border-amber-300 text-slate-500'
                      : 'border-slate-300'
                  }`}
                />
                {detectingDescriptionAllergens && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-50/80 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Detecting allergens...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detected allergens from description */}
              {descriptionAllergens.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Allergens detected in description:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {descriptionAllergens.map((allergen) => (
                      <span
                        key={allergen}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
                      >
                        {allergen}
                        <button
                          type="button"
                          onClick={() => removeDescriptionAllergen(allergen)}
                          className="p-0.5 hover:bg-amber-200 rounded-full transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 mt-2">
                    These allergens were detected from the description text. They will be shown to customers.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1">
                AI will automatically detect allergens mentioned in the description
              </p>
            </div>
          </div>
        </div>

        {/* Ingredients Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Ingredients</h3>

          {/* Search existing ingredients */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search existing ingredients..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            {searchQuery && filteredExistingIngredients.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                {filteredExistingIngredients.map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => handleAddExistingIngredient(ing)}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-900">{ing.name}</span>
                    {ing.contains_allergens.length > 0 && (
                      <div className="flex gap-1">
                        {ing.contains_allergens.slice(0, 3).map((a) => (
                          <span key={a} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            {a}
                          </span>
                        ))}
                        {ing.contains_allergens.length > 3 && (
                          <span className="text-xs text-slate-500">+{ing.contains_allergens.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add new ingredient */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">New ingredient</label>
              <input
                type="text"
                value={newIngredientName}
                onChange={(e) => setNewIngredientName(e.target.value)}
                placeholder="Type ingredient name..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
              <input
                type="number"
                step="0.1"
                value={newIngredientAmount}
                onChange={(e) => setNewIngredientAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
              <select
                value={newIngredientUnit}
                onChange={(e) => setNewIngredientUnit(e.target.value as WeightUnit)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {WEIGHT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.value}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAddNewIngredient}
              disabled={!newIngredientName.trim() || detectingAllergens}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {detectingAllergens ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
          <p className="text-xs text-slate-500">AI will automatically detect common allergens for new ingredients</p>

          {/* Ingredients list */}
          <div className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <div
                key={index}
                className="border border-slate-200 rounded-lg"
                style={{ position: 'relative', zIndex: addingSubstituteIndex === index ? 50 : 1 }}
              >
                {/* Ingredient header */}
                <div className="p-4 bg-slate-50 rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpandIngredient(index)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                    >
                      {expandedIngredients.has(index) ? (
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-slate-900">{ingredient.name}</span>
                      {ingredient.isRemovable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          <Trash2 className="w-3 h-3" />
                          removable
                        </span>
                      )}
                      {ingredient.isSubstitutable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          <Repeat className="w-3 h-3" />
                          substitutable
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={ingredient.amountValue || ''}
                        onChange={(e) =>
                          updateIngredient(index, {
                            amountValue: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                        placeholder="0"
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <select
                        value={ingredient.amountUnit}
                        onChange={(e) =>
                          updateIngredient(index, { amountUnit: e.target.value as WeightUnit })
                        }
                        className="px-2 py-1 border border-slate-300 rounded text-sm"
                      >
                        {WEIGHT_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.value}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Allergen tags */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {ingredient.allergens.length > 0 ? (
                      ingredient.allergens.map((allergen) => (
                        <span
                          key={allergen}
                          className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
                        >
                          {allergen}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No allergens</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingAllergenIndex(index)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                    >
                      <Edit3 className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>

                  {/* Allergen editor */}
                  {editingAllergenIndex === index && (
                    <div ref={allergenEditorRef} className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {COMMON_ALLERGENS.map((allergen) => (
                          <button
                            key={allergen}
                            type="button"
                            onClick={() => toggleAllergen(index, allergen)}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              ingredient.allergens.includes(allergen)
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {allergen}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customAllergenInput}
                          onChange={(e) => setCustomAllergenInput(e.target.value)}
                          placeholder="Custom allergen..."
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomAllergen(index);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addCustomAllergen(index)}
                          className="px-2 py-1 bg-slate-900 text-white text-sm rounded"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded content - Modification settings */}
                {expandedIngredients.has(index) && (
                  <div className="p-4 border-t border-slate-200 space-y-4">
                    {/* Modification toggles */}
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ingredient.isRemovable}
                          onChange={(e) =>
                            updateIngredient(index, { isRemovable: e.target.checked })
                          }
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">Can be removed</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ingredient.isSubstitutable}
                          onChange={(e) =>
                            updateIngredient(index, { isSubstitutable: e.target.checked })
                          }
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">Can be substituted</span>
                      </label>
                    </div>

                    {/* Substitutes section */}
                    {ingredient.isSubstitutable && (
                      <div className="pl-4 border-l-2 border-purple-200">
                        <span className="text-sm font-medium text-slate-700 block mb-2">Substitutes</span>

                        {/* Current substitutes */}
                        {ingredient.substitutes.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {ingredient.substitutes.map((sub, subIndex) => (
                              <div
                                key={subIndex}
                                className="flex items-center justify-between p-2 bg-purple-50 rounded"
                              >
                                <div>
                                  <span className="text-sm font-medium text-slate-900">{sub.name}</span>
                                  {sub.allergens.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {sub.allergens.map((a) => (
                                        <span
                                          key={a}
                                          className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                                        >
                                          {a}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSubstitute(index, subIndex)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Combined search/add input */}
                        <div className="relative" style={{ zIndex: addingSubstituteIndex === index ? 100 : 1 }}>
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-0" />
                          <input
                            type="text"
                            value={addingSubstituteIndex === index ? substituteSearchQuery : ''}
                            onChange={(e) => {
                              setAddingSubstituteIndex(index);
                              setSubstituteSearchQuery(e.target.value);
                            }}
                            onFocus={() => setAddingSubstituteIndex(index)}
                            placeholder="Search or type to add substitute..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent relative z-0"
                          />
                          {detectingSubstituteAllergens && (
                            <Loader2 className="w-4 h-4 text-purple-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2 z-0" />
                          )}

                          {/* Dropdown with search results and add option */}
                          {addingSubstituteIndex === index && substituteSearchQuery.trim() && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto" style={{ zIndex: 9999 }}>
                              {/* Add new option - always at top if there's a search query */}
                              {!existingIngredients.some(
                                ing => ing.name.toLowerCase() === substituteSearchQuery.trim().toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => handleAddNewSubstitute(index)}
                                  disabled={detectingSubstituteAllergens}
                                  className="w-full px-3 py-2.5 text-left hover:bg-purple-50 text-sm flex items-center gap-2 border-b border-slate-100 bg-purple-50/50"
                                >
                                  <Plus className="w-4 h-4 text-purple-600" />
                                  <span className="text-purple-700 font-medium">
                                    Add "{substituteSearchQuery.trim()}"
                                  </span>
                                  <span className="text-xs text-slate-500 ml-auto">
                                    AI will detect allergens
                                  </span>
                                </button>
                              )}

                              {/* Existing ingredients that match */}
                              {filteredSubstituteIngredients.length > 0 ? (
                                filteredSubstituteIngredients.map((ing) => (
                                  <button
                                    key={ing.id}
                                    type="button"
                                    onClick={() => handleAddExistingSubstitute(index, ing)}
                                    className="w-full px-3 py-2 text-left hover:bg-slate-50 text-sm flex items-center justify-between"
                                  >
                                    <span className="font-medium text-slate-900">{ing.name}</span>
                                    {ing.contains_allergens.length > 0 && (
                                      <div className="flex gap-1">
                                        {ing.contains_allergens.slice(0, 2).map((a) => (
                                          <span key={a} className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                            {a}
                                          </span>
                                        ))}
                                        {ing.contains_allergens.length > 2 && (
                                          <span className="text-xs text-slate-500">+{ing.contains_allergens.length - 2}</span>
                                        )}
                                      </div>
                                    )}
                                  </button>
                                ))
                              ) : (
                                existingIngredients.some(
                                  ing => ing.name.toLowerCase() === substituteSearchQuery.trim().toLowerCase()
                                ) && (
                                  <div className="px-3 py-2 text-sm text-slate-500">
                                    No other matching ingredients
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Type an ingredient name to search or add new
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {ingredients.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No ingredients added yet. Search or add a new ingredient above.
              </p>
            )}
          </div>
        </div>

        {/* Cooking Steps */}
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
                  <div className="flex-1 relative">
                    <textarea
                      value={step.description}
                      onChange={(e) => updateCookingStep(index, 'description', e.target.value)}
                      placeholder="Describe this cooking step (e.g., 'Fried in shared oil with shrimp')"
                      rows={2}
                      disabled={detectingCrossContact === index}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-colors ${
                        detectingCrossContact === index
                          ? 'bg-amber-50 border-amber-300 text-slate-500'
                          : 'border-slate-300'
                      }`}
                    />
                    {detectingCrossContact === index && (
                      <div className="absolute inset-0 flex items-center justify-center bg-amber-50/80 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-700">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm font-medium">Analyzing cross-contact risks...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCookingStep(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Cross-Contact Risks:
                    </label>
                    <button
                      type="button"
                      onClick={() => analyzeCrossContactRisks(index)}
                      disabled={!step.description.trim() || detectingCrossContact === index}
                      className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {detectingCrossContact === index ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="w-3 h-3" />
                          AI Detect Risks
                        </>
                      )}
                    </button>
                  </div>

                  {/* Selected cross-contact risks as removable tags */}
                  {step.cross_contact_risk.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {step.cross_contact_risk.map((risk) => (
                        <span
                          key={risk}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
                        >
                          {risk}
                          <button
                            type="button"
                            onClick={() => removeCrossContactRisk(index, risk)}
                            className="p-0.5 hover:bg-amber-200 rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add more risks manually */}
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGENS.filter(a => !step.cross_contact_risk.includes(a)).map((allergen) => (
                      <button
                        key={allergen}
                        type="button"
                        onClick={() => {
                          updateCookingStep(index, 'cross_contact_risk', [...step.cross_contact_risk, allergen]);
                        }}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-amber-100 hover:text-amber-700 transition-colors"
                      >
                        + {allergen}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Click to add risks, or let AI detect them from the step description
                  </p>
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

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim()}
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
