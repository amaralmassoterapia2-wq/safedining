import { useState, useEffect, useRef } from 'react';
import { supabase, Database, WeightUnit, WEIGHT_UNITS } from '../../lib/supabase';
import { ScannedDish } from '../../pages/RestaurantOnboarding';
import { Check, Upload, X, ChevronRight, ChevronDown, Plus, Sparkles, Loader2, AlertTriangle, Edit3, Clock, Repeat, Trash2, Search } from 'lucide-react';
import { suggestIngredientsForDish, detectAllergens, detectCrossContactRisks, estimateNutrition, NutritionEstimate, SuggestedIngredient, COMMON_ALLERGENS } from '../../lib/openai';

// Helper to format relative time
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

type Ingredient = Database['public']['Tables']['ingredients']['Row'];

interface DishDetailsInputProps {
  restaurantId: string;
  dishes: ScannedDish[];
  onComplete: () => void;
}

interface ExistingDishData {
  menuItemId: string;
  preparation: string;
  photoUrl: string | null;
  ingredients: SelectedIngredient[];
  updatedAt: string;
}

interface SubstituteInput {
  ingredientId?: string;
  name: string;
  allergens: string[];
  isNew: boolean;
}

interface SelectedIngredient {
  ingredientId?: string; // If using existing ingredient
  name: string;
  amountValue: number | null;
  amountUnit: WeightUnit | null;
  allergens: string[];
  isNew: boolean; // True if this is a new ingredient to be created
  isRemovable: boolean;
  isSubstitutable: boolean;
  substitutes: SubstituteInput[];
}

interface CookingStepInput {
  id?: string;
  step_number: number;
  description: string;
  cross_contact_risk: string[];
  is_modifiable: boolean;
  modifiable_allergens: string[];
  modification_notes: string;
}

interface NutritionFields {
  calories: string;
  protein_g: string;
  carbs_g: string;
  carbs_fiber_g: string;
  carbs_sugar_g: string;
  carbs_added_sugar_g: string;
  fat_g: string;
  fat_saturated_g: string;
  fat_trans_g: string;
  fat_polyunsaturated_g: string;
  fat_monounsaturated_g: string;
  sodium_mg: string;
  cholesterol_mg: string;
}

const DEFAULT_NUTRITION_FIELDS: NutritionFields = {
  calories: '',
  protein_g: '',
  carbs_g: '',
  carbs_fiber_g: '',
  carbs_sugar_g: '',
  carbs_added_sugar_g: '',
  fat_g: '',
  fat_saturated_g: '',
  fat_trans_g: '',
  fat_polyunsaturated_g: '',
  fat_monounsaturated_g: '',
  sodium_mg: '',
  cholesterol_mg: '',
};

interface DishForm {
  ingredients: SelectedIngredient[];
  preparation: string;
  photoFile: File | null;
  photoUrl: string;
  cookingSteps: CookingStepInput[];
  nutrition: NutritionFields;
}

interface ConflictOption {
  label: string;
  action: 'mark_removable' | 'mark_substitutable' | 'add_modifiable_allergens' | 'mark_step_modifiable' | 'keep_as_is';
}

interface ConflictItem {
  id: string;
  type: 'select_modifiable_allergens' | 'generic';
  description: string;
  options: ConflictOption[];
  selectedOption: number | null;
  // For multi-select allergen conflicts
  availableAllergens?: string[];
  selectedAllergens?: Set<string>;
  stepIndex?: number;
  ingredientIndex?: number;
  allergen?: string;
}

export default function DishDetailsInput({ restaurantId, dishes, onComplete }: DishDetailsInputProps) {
  const [currentDishIndex, setCurrentDishIndex] = useState<number | null>(null);
  const [dishForms, setDishForms] = useState<Record<string, DishForm>>({});
  const [saving, setSaving] = useState(false);
  const [completedDishes, setCompletedDishes] = useState<Set<string>>(new Set());

  // Ingredient-related state
  const [existingIngredients, setExistingIngredients] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [suggestedIngredients, setSuggestedIngredients] = useState<SuggestedIngredient[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientAmountValue, setNewIngredientAmountValue] = useState<string>('');
  const [newIngredientAmountUnit, setNewIngredientAmountUnit] = useState<WeightUnit>('g');
  const [detectingAllergens, setDetectingAllergens] = useState(false);
  const [editingAllergenIndex, setEditingAllergenIndex] = useState<number | null>(null);
  const allergenEditorRef = useRef<HTMLDivElement>(null);
  const [existingDishData, setExistingDishData] = useState<Record<string, ExistingDishData>>({});
  const [loadingExistingDishes, setLoadingExistingDishes] = useState(true);
  const [customAllergenInput, setCustomAllergenInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedIngredientIndex, setExpandedIngredientIndex] = useState<number | null>(null);
  const [substituteSearchQuery, setSubstituteSearchQuery] = useState('');
  const [newSubstituteName, setNewSubstituteName] = useState('');
  const [detectingSubstituteAllergens, setDetectingSubstituteAllergens] = useState(false);

  // Cooking steps state
  const [detectingCrossContact, setDetectingCrossContact] = useState<number | null>(null);
  const crossContactDebounceRef = useRef<{ [key: number]: NodeJS.Timeout }>({});

  // Conflict resolution modal state
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Calorie estimation state
  const [estimatingCalories, setEstimatingCalories] = useState(false);
  const calorieDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const currentDish = currentDishIndex !== null ? dishes[currentDishIndex] : null;
  const DEFAULT_DISH_FORM: DishForm = { ingredients: [], preparation: '', photoFile: null, photoUrl: '', cookingSteps: [], nutrition: DEFAULT_NUTRITION_FIELDS };
  const currentForm = currentDish
    ? { ...DEFAULT_DISH_FORM, ...dishForms[currentDish.id] }
    : null;

  // Load existing ingredients and recently completed dishes on mount
  useEffect(() => {
    loadExistingIngredients();
    loadRecentlyCompletedDishes();
  }, [restaurantId]);

  // Mark dishes that were flagged as completed (e.g., "keep existing" from conflict resolution)
  useEffect(() => {
    const preCompleted = dishes.filter(d => d.completed);
    if (preCompleted.length > 0) {
      setCompletedDishes(prev => {
        const next = new Set(prev);
        preCompleted.forEach(d => next.add(d.id));
        return next;
      });
    }
  }, [dishes]);

  // Load AI suggestions when selecting a dish
  useEffect(() => {
    if (currentDish && existingIngredients.length >= 0) {
      loadSuggestions();
    }
  }, [currentDishIndex, existingIngredients]);

  // Close allergen editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (allergenEditorRef.current && !allergenEditorRef.current.contains(event.target as Node)) {
        setEditingAllergenIndex(null);
      }
    };

    if (editingAllergenIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingAllergenIndex]);

  // Auto-estimate nutrition when ingredients change
  useEffect(() => {
    if (!currentDish || !currentForm) return;

    const ingredients = currentForm.ingredients;
    const hasIngredientsWithAmounts = ingredients.some(
      ing => ing.amountValue && ing.amountValue > 0
    );

    if (!hasIngredientsWithAmounts) return;

    // Clear existing debounce
    if (calorieDebounceRef.current) {
      clearTimeout(calorieDebounceRef.current);
    }

    // Debounce the estimation
    calorieDebounceRef.current = setTimeout(async () => {
      setEstimatingCalories(true);
      try {
        const estimated = await estimateNutrition(
          currentDish.name,
          ingredients
            .filter(ing => ing.amountValue && ing.amountValue > 0)
            .map(ing => ({
              name: ing.name,
              amount: ing.amountValue,
              unit: ing.amountUnit,
            }))
        );

        setDishForms((prev) => ({
          ...prev,
          [currentDish.id]: {
            ...prev[currentDish.id],
            nutrition: {
              calories: estimated.calories?.toString() || '',
              protein_g: estimated.protein_g?.toString() || '',
              carbs_g: estimated.carbs_g?.toString() || '',
              carbs_fiber_g: estimated.carbs_fiber_g?.toString() || '',
              carbs_sugar_g: estimated.carbs_sugar_g?.toString() || '',
              carbs_added_sugar_g: estimated.carbs_added_sugar_g?.toString() || '',
              fat_g: estimated.fat_g?.toString() || '',
              fat_saturated_g: estimated.fat_saturated_g?.toString() || '',
              fat_trans_g: estimated.fat_trans_g?.toString() || '',
              fat_polyunsaturated_g: estimated.fat_polyunsaturated_g?.toString() || '',
              fat_monounsaturated_g: estimated.fat_monounsaturated_g?.toString() || '',
              sodium_mg: estimated.sodium_mg?.toString() || '',
              cholesterol_mg: estimated.cholesterol_mg?.toString() || '',
            },
          },
        }));
      } catch (err) {
        console.error('Error estimating nutrition:', err);
      } finally {
        setEstimatingCalories(false);
      }
    }, 1500); // Wait 1.5 seconds after last change

    return () => {
      if (calorieDebounceRef.current) {
        clearTimeout(calorieDebounceRef.current);
      }
    };
  }, [currentDish?.id, currentForm?.ingredients.length, currentForm?.ingredients.map(i => `${i.name}-${i.amountValue}-${i.amountUnit}`).join(',')]);

  const loadExistingIngredients = async () => {
    try {
      const { data } = await supabase
        .from('ingredients')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (data) {
        setExistingIngredients(data);
      }
    } catch (err) {
      console.error('Error loading ingredients:', err);
    } finally {
      setLoadingIngredients(false);
    }
  };

  const loadRecentlyCompletedDishes = async () => {
    try {
      // Get all existing menu items for this restaurant
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (!menuItems || menuItems.length === 0) {
        setLoadingExistingDishes(false);
        return;
      }

      const existingData: Record<string, ExistingDishData> = {};
      const completedIds = new Set<string>();

      // For each menu item, fetch its ingredients
      for (const item of menuItems) {
        // Find matching dish by name (case-insensitive) or by ID
        const matchingDish = dishes.find(
          d => d.id === item.id || d.name.toLowerCase() === item.name.toLowerCase()
        );

        if (matchingDish) {
          // Fetch ingredients for this menu item with substitutes
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*, ingredient:ingredients(*)')
            .eq('menu_item_id', item.id);

          // Fetch substitutes for all menu_item_ingredients
          const miiIds = (menuItemIngredients || []).map((mii: { id: string }) => mii.id);
          const { data: substitutesData } = miiIds.length > 0 ? await supabase
            .from('ingredient_substitutes')
            .select('*, substitute:ingredients(*)')
            .in('menu_item_ingredient_id', miiIds) : { data: [] };

          const ingredients: SelectedIngredient[] = await Promise.all(
            (menuItemIngredients || []).map(async (mii: {
              id: string;
              ingredient_id: string;
              amount_value: number | null;
              amount_unit: WeightUnit | null;
              is_removable: boolean;
              is_substitutable: boolean;
              ingredient: Ingredient;
            }) => {
              // Find substitutes for this menu_item_ingredient
              const subs = (substitutesData || [])
                .filter((s: { menu_item_ingredient_id: string }) => s.menu_item_ingredient_id === mii.id)
                .map((s: { substitute_ingredient_id: string; substitute: Ingredient }) => ({
                  ingredientId: s.substitute_ingredient_id,
                  name: s.substitute?.name || '',
                  allergens: s.substitute?.contains_allergens || [],
                  isNew: false,
                }));

              let allergens = mii.ingredient?.contains_allergens || [];

              // Re-detect allergens for ingredients with empty allergens
              if (allergens.length === 0 && mii.ingredient?.name) {
                console.log('[loadRecentlyCompleted] Re-detecting allergens for:', mii.ingredient.name);
                try {
                  const detected = await detectAllergens(mii.ingredient.name);
                  if (detected.length > 0) {
                    allergens = detected;
                    // Update the DB record
                    await supabase
                      .from('ingredients')
                      .update({ contains_allergens: detected })
                      .eq('id', mii.ingredient_id);
                    console.log('[loadRecentlyCompleted] Updated', mii.ingredient.name, 'with allergens:', detected);
                  }
                } catch (err) {
                  console.error('[loadRecentlyCompleted] Re-detection failed for', mii.ingredient.name, err);
                }
              }

              return {
                ingredientId: mii.ingredient_id,
                name: mii.ingredient?.name || '',
                amountValue: mii.amount_value,
                amountUnit: mii.amount_unit,
                allergens,
                isNew: false,
                isRemovable: mii.is_removable || false,
                isSubstitutable: mii.is_substitutable || false,
                substitutes: subs,
              };
            })
          );

          // Fetch cooking steps for this menu item
          const { data: cookingStepsData } = await supabase
            .from('cooking_steps')
            .select('*')
            .eq('menu_item_id', item.id)
            .order('step_number');

          const loadedCookingSteps: CookingStepInput[] = (cookingStepsData || []).map((cs: {
            id: string;
            step_number: number;
            description: string;
            cross_contact_risk: string[];
            is_modifiable: boolean;
            modifiable_allergens: string[];
            modification_notes: string | null;
          }) => ({
            id: cs.id,
            step_number: cs.step_number,
            description: cs.description,
            cross_contact_risk: cs.cross_contact_risk || [],
            is_modifiable: cs.is_modifiable || false,
            modifiable_allergens: cs.modifiable_allergens || [],
            modification_notes: cs.modification_notes || '',
          }));

          existingData[matchingDish.id] = {
            menuItemId: item.id,
            preparation: item.preparation || '',
            photoUrl: item.photo_url,
            ingredients,
            updatedAt: item.updated_at,
          };

          // If the dish has ingredients, it's considered complete
          if (ingredients.length > 0) {
            completedIds.add(matchingDish.id);

            // Pre-populate the form with existing data including cooking steps
            setDishForms(prev => ({
              ...prev,
              [matchingDish.id]: {
                ...DEFAULT_DISH_FORM,
                ...prev[matchingDish.id],
                ingredients,
                preparation: item.preparation || '',
                photoFile: null,
                photoUrl: item.photo_url || '',
                cookingSteps: loadedCookingSteps,
              },
            }));
          }
        }
      }

      setExistingDishData(existingData);
      setCompletedDishes(completedIds);
    } catch (err) {
      console.error('Error loading recently completed dishes:', err);
    } finally {
      setLoadingExistingDishes(false);
    }
  };

  const loadSuggestions = async () => {
    if (!currentDish) return;

    setLoadingSuggestions(true);
    try {
      const suggestions = await suggestIngredientsForDish(
        currentDish.name,
        currentDish.description || '',
        existingIngredients.map(i => ({
          id: i.id,
          name: i.name,
          allergens: i.contains_allergens,
        }))
      );
      console.log('[loadSuggestions] AI suggestions:', suggestions.map(s => ({ name: s.name, allergens: s.allergens, existingId: s.existingId })));
      setSuggestedIngredients(suggestions);
    } catch (err) {
      console.error('Error loading suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, dishId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setDishForms((prev) => ({
        ...prev,
        [dishId]: {
          ...DEFAULT_DISH_FORM,
          ...prev[dishId],
          photoFile: file,
          photoUrl: url
        },
      }));
    }
  };

  const addIngredient = (ingredient: SelectedIngredient) => {
    if (!currentDish) return;

    // Check if already added
    const alreadyAdded = currentForm?.ingredients.some(
      i => i.name.toLowerCase() === ingredient.name.toLowerCase()
    );
    if (alreadyAdded) return;

    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...DEFAULT_DISH_FORM,
        ...prev[currentDish.id],
        ingredients: [...(prev[currentDish.id]?.ingredients || []), ingredient],
      },
    }));
  };

  const removeIngredient = (index: number) => {
    if (!currentDish) return;

    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.filter((_, i) => i !== index) || [],
      },
    }));
  };

  const updateIngredientAmount = (index: number, value: number | null, unit: WeightUnit | null) => {
    if (!currentDish) return;

    // Clear validation error when user updates an amount
    if (validationError) {
      setValidationError(null);
    }

    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === index ? { ...ing, amountValue: value, amountUnit: unit } : ing
        ) || [],
      },
    }));
  };

  const toggleIngredientAllergen = async (index: number, allergen: string) => {
    if (!currentDish || !currentForm) return;

    const ingredient = currentForm.ingredients[index];
    const hasAllergen = ingredient.allergens.includes(allergen);
    const newAllergens = hasAllergen
      ? ingredient.allergens.filter(a => a !== allergen)
      : [...ingredient.allergens, allergen];

    // Update local state
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === index ? { ...ing, allergens: newAllergens } : ing
        ) || [],
      },
    }));

    // If ingredient exists in DB, update its allergens there too
    if (ingredient.ingredientId) {
      try {
        await supabase
          .from('ingredients')
          .update({ contains_allergens: newAllergens })
          .eq('id', ingredient.ingredientId);

        // Update local existing ingredients state
        setExistingIngredients(prev =>
          prev.map(ing =>
            ing.id === ingredient.ingredientId
              ? { ...ing, contains_allergens: newAllergens }
              : ing
          )
        );
      } catch (err) {
        console.error('Error updating ingredient allergens:', err);
      }
    }
  };

  const handleAddSuggestedIngredient = async (suggestion: SuggestedIngredient) => {
    console.log('[handleAddSuggested] Suggestion:', suggestion.name, 'AI allergens:', suggestion.allergens, 'existingId:', suggestion.existingId);
    // If suggestion has an existing ID, use the allergens from our local state
    // (which may have been updated with custom allergens)
    let allergens = suggestion.allergens;
    if (suggestion.existingId) {
      const existingIng = existingIngredients.find(ing => ing.id === suggestion.existingId);
      if (existingIng) {
        allergens = existingIng.contains_allergens;
        // If DB has empty allergens but AI suggestion has them, use AI's and update DB
        if (allergens.length === 0 && suggestion.allergens.length > 0) {
          console.log('[handleAddSuggested] DB allergens empty, using AI allergens:', suggestion.allergens);
          allergens = suggestion.allergens;
          await supabase
            .from('ingredients')
            .update({ contains_allergens: allergens })
            .eq('id', existingIng.id);
          setExistingIngredients(prev =>
            prev.map(ing => ing.id === existingIng.id
              ? { ...ing, contains_allergens: allergens }
              : ing
            )
          );
        } else if (allergens.length === 0) {
          // Both DB and suggestion have empty allergens — re-detect
          console.log('[handleAddSuggested] Both empty, re-detecting for:', suggestion.name);
          const detected = await detectAllergens(suggestion.name);
          if (detected.length > 0) {
            allergens = detected;
            await supabase
              .from('ingredients')
              .update({ contains_allergens: allergens })
              .eq('id', existingIng.id);
            setExistingIngredients(prev =>
              prev.map(ing => ing.id === existingIng.id
                ? { ...ing, contains_allergens: allergens }
                : ing
              )
            );
          }
        }
      }
    } else {
      // Check if ingredient exists by name (case-insensitive)
      const existingByName = existingIngredients.find(
        ing => ing.name.toLowerCase() === suggestion.name.toLowerCase()
      );
      if (existingByName) {
        let existingAllergens = existingByName.contains_allergens;
        // If DB has empty allergens but AI suggestion has them, prefer AI's
        if (existingAllergens.length === 0 && suggestion.allergens.length > 0) {
          console.log('[handleAddSuggested] DB allergens empty for', existingByName.name, ', using AI allergens:', suggestion.allergens);
          existingAllergens = suggestion.allergens;
          await supabase
            .from('ingredients')
            .update({ contains_allergens: existingAllergens })
            .eq('id', existingByName.id);
          setExistingIngredients(prev =>
            prev.map(ing => ing.id === existingByName.id
              ? { ...ing, contains_allergens: existingAllergens }
              : ing
            )
          );
        } else if (existingAllergens.length === 0) {
          console.log('[handleAddSuggested] Both empty, re-detecting for:', existingByName.name);
          const detected = await detectAllergens(existingByName.name);
          if (detected.length > 0) {
            existingAllergens = detected;
            await supabase
              .from('ingredients')
              .update({ contains_allergens: existingAllergens })
              .eq('id', existingByName.id);
            setExistingIngredients(prev =>
              prev.map(ing => ing.id === existingByName.id
                ? { ...ing, contains_allergens: existingAllergens }
                : ing
              )
            );
          }
        }
        addIngredient({
          ingredientId: existingByName.id,
          name: existingByName.name,
          amountValue: null,
          amountUnit: 'g',
          allergens: existingAllergens,
          isNew: false,
          isRemovable: false,
          isSubstitutable: false,
          substitutes: [],
        });
        return;
      }
    }

    console.log('[handleAddSuggested] Adding with allergens:', allergens);
    addIngredient({
      ingredientId: suggestion.existingId,
      name: suggestion.name,
      amountValue: null,
      amountUnit: 'g',
      allergens,
      isNew: !suggestion.existingId,
      isRemovable: false,
      isSubstitutable: false,
      substitutes: [],
    });
  };

  const handleAddNewIngredient = async () => {
    if (!newIngredientName.trim() || !currentDish) return;

    const trimmedName = newIngredientName.trim();

    // Check if this ingredient already exists in our database (case-insensitive)
    const existingIngredient = existingIngredients.find(
      ing => ing.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingIngredient) {
      console.log('[DishDetailsInput] Found existing ingredient:', existingIngredient.name, 'with allergens:', existingIngredient.contains_allergens);
      let allergens = existingIngredient.contains_allergens;

      // If existing ingredient has no allergens, re-detect them
      if (allergens.length === 0) {
        console.log('[DishDetailsInput] Existing ingredient has no allergens, re-detecting...');
        setDetectingAllergens(true);
        try {
          allergens = await detectAllergens(existingIngredient.name);
          console.log('[DishDetailsInput] Re-detected allergens:', allergens);
          // Update the DB record so future lookups have correct allergens
          if (allergens.length > 0) {
            await supabase
              .from('ingredients')
              .update({ contains_allergens: allergens })
              .eq('id', existingIngredient.id);
            // Update local state
            setExistingIngredients(prev =>
              prev.map(ing => ing.id === existingIngredient.id
                ? { ...ing, contains_allergens: allergens }
                : ing
              )
            );
          }
        } catch (err) {
          console.error('[DishDetailsInput] Re-detection failed:', err);
        } finally {
          setDetectingAllergens(false);
        }
      }

      const amountVal = newIngredientAmountValue ? parseFloat(newIngredientAmountValue) : null;
      addIngredient({
        ingredientId: existingIngredient.id,
        name: existingIngredient.name,
        amountValue: amountVal,
        amountUnit: newIngredientAmountUnit,
        allergens,
        isNew: false,
        isRemovable: false,
        isSubstitutable: false,
        substitutes: [],
      });
      setNewIngredientName('');
      setNewIngredientAmountValue('');
      setNewIngredientAmountUnit('g');
      return;
    }

    console.log('[DishDetailsInput] New ingredient, calling detectAllergens for:', trimmedName);
    setDetectingAllergens(true);
    try {
      // Detect allergens for the new ingredient
      const allergens = await detectAllergens(trimmedName);
      console.log('[DishDetailsInput] detectAllergens returned:', allergens);

      const amountVal = newIngredientAmountValue ? parseFloat(newIngredientAmountValue) : null;

      addIngredient({
        name: trimmedName,
        amountValue: amountVal,
        amountUnit: newIngredientAmountUnit,
        allergens,
        isNew: true,
        isRemovable: false,
        isSubstitutable: false,
        substitutes: [],
      });

      setNewIngredientName('');
      setNewIngredientAmountValue('');
      setNewIngredientAmountUnit('g');
    } catch (err) {
      console.error('Error detecting allergens:', err);
      // Add without allergens if detection fails
      const amountVal = newIngredientAmountValue ? parseFloat(newIngredientAmountValue) : null;
      addIngredient({
        name: trimmedName,
        amountValue: amountVal,
        amountUnit: newIngredientAmountUnit,
        allergens: [],
        isNew: true,
        isRemovable: false,
        isSubstitutable: false,
        substitutes: [],
      });
      setNewIngredientName('');
      setNewIngredientAmountValue('');
      setNewIngredientAmountUnit('g');
    } finally {
      setDetectingAllergens(false);
    }
  };

  const toggleIngredientRemovable = (index: number) => {
    if (!currentDish) return;
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === index ? { ...ing, isRemovable: !ing.isRemovable } : ing
        ) || [],
      },
    }));
  };

  const toggleIngredientSubstitutable = (index: number) => {
    if (!currentDish) return;
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === index ? { ...ing, isSubstitutable: !ing.isSubstitutable } : ing
        ) || [],
      },
    }));
  };

  const addSubstituteToIngredient = (ingredientIndex: number, substitute: SubstituteInput) => {
    if (!currentDish || !currentForm) return;

    const ingredient = currentForm.ingredients[ingredientIndex];
    // Check if already added
    if (ingredient.substitutes.some(s => s.name.toLowerCase() === substitute.name.toLowerCase())) {
      return;
    }

    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === ingredientIndex
            ? { ...ing, substitutes: [...ing.substitutes, substitute] }
            : ing
        ) || [],
      },
    }));
    setSubstituteSearchQuery('');
    setNewSubstituteName('');
  };

  const removeSubstituteFromIngredient = (ingredientIndex: number, substituteIndex: number) => {
    if (!currentDish) return;
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === ingredientIndex
            ? { ...ing, substitutes: ing.substitutes.filter((_, si) => si !== substituteIndex) }
            : ing
        ) || [],
      },
    }));
  };

  const handleAddExistingSubstitute = (ingredientIndex: number, ingredient: Ingredient) => {
    addSubstituteToIngredient(ingredientIndex, {
      ingredientId: ingredient.id,
      name: ingredient.name,
      allergens: ingredient.contains_allergens,
      isNew: false,
    });
  };

  const handleAddNewSubstitute = async (ingredientIndex: number) => {
    if (!newSubstituteName.trim()) return;

    const trimmedName = newSubstituteName.trim();

    // Check if this ingredient already exists
    const existingIngredient = existingIngredients.find(
      ing => ing.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingIngredient) {
      addSubstituteToIngredient(ingredientIndex, {
        ingredientId: existingIngredient.id,
        name: existingIngredient.name,
        allergens: existingIngredient.contains_allergens,
        isNew: false,
      });
      return;
    }

    setDetectingSubstituteAllergens(true);
    try {
      const allergens = await detectAllergens(trimmedName);
      addSubstituteToIngredient(ingredientIndex, {
        name: trimmedName,
        allergens,
        isNew: true,
      });
    } catch (err) {
      console.error('Error detecting allergens for substitute:', err);
      addSubstituteToIngredient(ingredientIndex, {
        name: trimmedName,
        allergens: [],
        isNew: true,
      });
    } finally {
      setDetectingSubstituteAllergens(false);
    }
  };

  // Cooking steps functions
  const addCookingStep = () => {
    if (!currentDish) return;
    const currentSteps = currentForm?.cookingSteps || [];
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...DEFAULT_DISH_FORM,
        ...prev[currentDish.id],
        cookingSteps: [
          ...currentSteps,
          {
            step_number: currentSteps.length + 1,
            description: '',
            cross_contact_risk: [],
            is_modifiable: false,
            modifiable_allergens: [],
            modification_notes: '',
          },
        ],
      },
    }));
  };

  const removeCookingStep = (index: number) => {
    if (!currentDish) return;
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        cookingSteps: (prev[currentDish.id]?.cookingSteps || [])
          .filter((_, i) => i !== index)
          .map((step, i) => ({ ...step, step_number: i + 1 })),
      },
    }));
  };

  const updateCookingStep = (index: number, field: keyof CookingStepInput, value: string | string[] | number | boolean) => {
    if (!currentDish) return;
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        cookingSteps: (prev[currentDish.id]?.cookingSteps || []).map((step, i) =>
          i === index ? { ...step, [field]: value } : step
        ),
      },
    }));

    // Auto-detect cross-contact risks when description changes
    if (field === 'description' && typeof value === 'string' && value.trim().length >= 10) {
      // Clear existing debounce
      if (crossContactDebounceRef.current[index]) {
        clearTimeout(crossContactDebounceRef.current[index]);
      }
      // Set new debounce - 3 seconds to avoid interrupting typing
      crossContactDebounceRef.current[index] = setTimeout(() => {
        analyzeCrossContactRisksForStep(index, value);
      }, 3000);
    }
  };

  const analyzeCrossContactRisksForStep = async (index: number, description: string) => {
    if (!description.trim() || !currentDish) return;

    setDetectingCrossContact(index);
    try {
      const analysis = await detectCrossContactRisks(description);
      if (analysis.cross_contact_risks.length > 0 || analysis.modifiable_allergens.length > 0) {
        // Merge with existing data, avoiding duplicates
        setDishForms((prev) => {
          const step = prev[currentDish.id]?.cookingSteps?.[index];
          if (!step) return prev;
          const newRisks = [...new Set([...(step.cross_contact_risk || []), ...analysis.cross_contact_risks])];
          const newModifiable = [...new Set([...(step.modifiable_allergens || []), ...analysis.modifiable_allergens])];
          const newNotes = analysis.modification_notes
            ? (step.modification_notes ? step.modification_notes + '; ' + analysis.modification_notes : analysis.modification_notes)
            : step.modification_notes;
          const isModifiable = step.is_modifiable || newModifiable.length > 0;
          return {
            ...prev,
            [currentDish.id]: {
              ...prev[currentDish.id],
              cookingSteps: prev[currentDish.id].cookingSteps.map((s, i) =>
                i === index ? {
                  ...s,
                  cross_contact_risk: newRisks,
                  modifiable_allergens: newModifiable,
                  modification_notes: newNotes,
                  is_modifiable: isModifiable,
                } : s
              ),
            },
          };
        });
      }
    } catch (err) {
      console.error('Error detecting cross-contact risks:', err);
    } finally {
      setDetectingCrossContact(null);
    }
  };

  const analyzeCrossContactRisks = async (index: number) => {
    const step = currentForm?.cookingSteps?.[index];
    if (!step?.description.trim()) return;
    await analyzeCrossContactRisksForStep(index, step.description);
  };

  const removeCrossContactRisk = (stepIndex: number, allergen: string) => {
    if (!currentDish || !currentForm) return;
    const step = currentForm.cookingSteps[stepIndex];
    updateCookingStep(stepIndex, 'cross_contact_risk', step.cross_contact_risk.filter(r => r !== allergen));
  };

  // Detect conflicts between cooking steps and ingredients before saving
  const detectConflicts = (form: DishForm): ConflictItem[] => {
    const found: ConflictItem[] = [];
    let conflictId = 0;

    for (let si = 0; si < form.cookingSteps.length; si++) {
      const step = form.cookingSteps[si];

      // Type 1: is_modifiable=true but modifiable_allergens is empty while cross_contact_risk has items
      if (step.is_modifiable && step.cross_contact_risk.length > 0 && step.modifiable_allergens.length === 0) {
        found.push({
          id: `conflict-${conflictId++}`,
          type: 'select_modifiable_allergens',
          description: `Step ${step.step_number} ("${step.description.slice(0, 60)}...") is marked as modifiable, but no specific allergens are listed as avoidable. Select which allergens can be avoided:`,
          options: [],
          selectedOption: null,
          availableAllergens: [...step.cross_contact_risk],
          selectedAllergens: new Set(step.cross_contact_risk), // default: all selected
          stepIndex: si,
        });
      }

      // Type 2: Step text mentions modifications but is_modifiable is false
      if (!step.is_modifiable && step.description.trim()) {
        const modKeywords = /can be (changed|removed|substituted|replaced|swapped)|optional|garnish.*(remov|optional)|gluten.free (option|alternative|bread|version)|substitute available|alternative available/i;
        if (modKeywords.test(step.description)) {
          found.push({
            id: `conflict-${conflictId++}`,
            type: 'generic',
            description: `Step ${step.step_number} mentions possible modifications ("${step.description.slice(0, 60)}...") but is not marked as modifiable. Should it be?`,
            options: [
              { label: 'Yes, mark this step as modifiable', action: 'mark_step_modifiable' },
              { label: 'No, keep as-is', action: 'keep_as_is' },
            ],
            selectedOption: null,
            stepIndex: si,
          });
        }
      }

      // Type 3: Cooking step says allergen is modifiable but ingredient with that allergen is not removable/substitutable
      for (const allergen of step.modifiable_allergens) {
        const allergenLower = allergen.toLowerCase();
        for (let ii = 0; ii < form.ingredients.length; ii++) {
          const ing = form.ingredients[ii];
          const ingAllergens = ing.allergens.map(a => a.toLowerCase());
          if (ingAllergens.includes(allergenLower) && !ing.isRemovable && !ing.isSubstitutable) {
            found.push({
              id: `conflict-${conflictId++}`,
              type: 'generic',
              description: `Cooking step says "${allergen}" can be avoided, but ingredient "${ing.name}" (contains ${allergen}) is not marked as removable or substitutable. How should this be handled?`,
              options: [
                { label: `Mark "${ing.name}" as removable`, action: 'mark_removable' },
                { label: `Mark "${ing.name}" as substitutable`, action: 'mark_substitutable' },
                { label: 'Keep as-is', action: 'keep_as_is' },
              ],
              selectedOption: null,
              stepIndex: si,
              ingredientIndex: ii,
              allergen,
            });
          }
        }
      }

      // Type 4: Ingredient is removable but cooking step has that allergen as non-modifiable cross-contact risk
      for (let ii = 0; ii < form.ingredients.length; ii++) {
        const ing = form.ingredients[ii];
        if (!ing.isRemovable && !ing.isSubstitutable) continue;
        for (const ingAllergen of ing.allergens) {
          const ingAllergenLower = ingAllergen.toLowerCase();
          const inCrossContact = step.cross_contact_risk.some(r => r.toLowerCase() === ingAllergenLower);
          const inModifiable = step.modifiable_allergens.some(m => m.toLowerCase() === ingAllergenLower);
          if (inCrossContact && !inModifiable && !step.is_modifiable) {
            found.push({
              id: `conflict-${conflictId++}`,
              type: 'generic',
              description: `Ingredient "${ing.name}" is marked as ${ing.isRemovable ? 'removable' : 'substitutable'}, but Step ${step.step_number} lists "${ingAllergen}" as a non-modifiable cross-contact risk. This contradicts the ingredient setting.`,
              options: [
                { label: `Mark Step ${step.step_number} as modifiable for "${ingAllergen}"`, action: 'mark_step_modifiable' },
                { label: 'Keep as-is (cross-contact risk remains)', action: 'keep_as_is' },
              ],
              selectedOption: null,
              stepIndex: si,
              ingredientIndex: ii,
              allergen: ingAllergen,
            });
          }
        }
      }
    }

    return found;
  };

  // Apply conflict resolutions and return the updated form
  const applyConflictResolutions = (form: DishForm, resolvedConflicts: ConflictItem[]): DishForm => {
    const updatedIngredients = [...form.ingredients.map(ing => ({ ...ing }))];
    const updatedSteps = [...form.cookingSteps.map(step => ({ ...step }))];

    for (const conflict of resolvedConflicts) {
      // Handle multi-select allergen conflicts
      if (conflict.type === 'select_modifiable_allergens') {
        if (conflict.stepIndex !== undefined && conflict.selectedAllergens && conflict.selectedAllergens.size > 0) {
          const step = updatedSteps[conflict.stepIndex];
          updatedSteps[conflict.stepIndex] = {
            ...step,
            modifiable_allergens: [...new Set([...step.modifiable_allergens, ...conflict.selectedAllergens])],
          };
        }
        continue;
      }

      if (conflict.selectedOption === null) continue;
      const action = conflict.options[conflict.selectedOption].action;

      switch (action) {
        case 'mark_removable':
          if (conflict.ingredientIndex !== undefined) {
            updatedIngredients[conflict.ingredientIndex] = {
              ...updatedIngredients[conflict.ingredientIndex],
              isRemovable: true,
            };
          }
          break;
        case 'mark_substitutable':
          if (conflict.ingredientIndex !== undefined) {
            updatedIngredients[conflict.ingredientIndex] = {
              ...updatedIngredients[conflict.ingredientIndex],
              isSubstitutable: true,
            };
          }
          break;
        case 'mark_step_modifiable':
          if (conflict.stepIndex !== undefined) {
            const step = updatedSteps[conflict.stepIndex];
            const newModifiable = conflict.allergen
              ? [...new Set([...step.modifiable_allergens, conflict.allergen])]
              : step.cross_contact_risk.length > 0
                ? [...new Set([...step.modifiable_allergens, ...step.cross_contact_risk])]
                : step.modifiable_allergens;
            updatedSteps[conflict.stepIndex] = {
              ...step,
              is_modifiable: true,
              modifiable_allergens: newModifiable,
            };
          }
          break;
        case 'keep_as_is':
          break;
      }
    }

    return { ...form, ingredients: updatedIngredients, cookingSteps: updatedSteps };
  };

  // Execute the actual save to Supabase
  const executeSave = async (formToSave?: DishForm) => {
    if (!currentDish) return;
    const form = formToSave || currentForm;
    if (!form) return;

    setSaving(true);

    try {
      let photoUrl = null;

      // Upload photo if provided
      if (form.photoFile) {
        const fileExt = form.photoFile.name.split('.').pop();
        const fileName = `${restaurantId}/${currentDish.id}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dish-photos')
          .upload(fileName, form.photoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('dish-photos')
          .getPublicUrl(uploadData.path);

        photoUrl = urlData.publicUrl;
      }

      // Check if menu item exists (for update case)
      let existingItem = await supabase
        .from('menu_items')
        .select('id')
        .eq('id', currentDish.id)
        .maybeSingle()
        .then(res => res.data);

      if (!existingItem) {
        existingItem = await supabase
          .from('menu_items')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('name', currentDish.name)
          .maybeSingle()
          .then(res => res.data);
      }

      let menuItemId: string;

      if (existingItem) {
        menuItemId = existingItem.id;

        const { error: updateError } = await supabase
          .from('menu_items')
          .update({
            name: currentDish.name,
            description: currentDish.description,
            preparation: form.preparation,
            category: currentDish.category,
            price: currentDish.price,
            calories: form.nutrition.calories ? parseInt(form.nutrition.calories, 10) : null,
            protein_g: form.nutrition.protein_g ? parseFloat(form.nutrition.protein_g) : null,
            carbs_g: form.nutrition.carbs_g ? parseFloat(form.nutrition.carbs_g) : null,
            carbs_fiber_g: form.nutrition.carbs_fiber_g ? parseFloat(form.nutrition.carbs_fiber_g) : null,
            carbs_sugar_g: form.nutrition.carbs_sugar_g ? parseFloat(form.nutrition.carbs_sugar_g) : null,
            carbs_added_sugar_g: form.nutrition.carbs_added_sugar_g ? parseFloat(form.nutrition.carbs_added_sugar_g) : null,
            fat_g: form.nutrition.fat_g ? parseFloat(form.nutrition.fat_g) : null,
            fat_saturated_g: form.nutrition.fat_saturated_g ? parseFloat(form.nutrition.fat_saturated_g) : null,
            fat_trans_g: form.nutrition.fat_trans_g ? parseFloat(form.nutrition.fat_trans_g) : null,
            fat_polyunsaturated_g: form.nutrition.fat_polyunsaturated_g ? parseFloat(form.nutrition.fat_polyunsaturated_g) : null,
            fat_monounsaturated_g: form.nutrition.fat_monounsaturated_g ? parseFloat(form.nutrition.fat_monounsaturated_g) : null,
            sodium_mg: form.nutrition.sodium_mg ? parseInt(form.nutrition.sodium_mg, 10) : null,
            cholesterol_mg: form.nutrition.cholesterol_mg ? parseInt(form.nutrition.cholesterol_mg, 10) : null,
            photo_url: photoUrl || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', menuItemId);

        if (updateError) throw updateError;

        await supabase
          .from('menu_item_ingredients')
          .delete()
          .eq('menu_item_id', menuItemId);

        await supabase
          .from('cooking_steps')
          .delete()
          .eq('menu_item_id', menuItemId);
      } else {
        const { data: newItem, error: insertError } = await supabase
          .from('menu_items')
          .insert({
            restaurant_id: restaurantId,
            name: currentDish.name,
            description: currentDish.description,
            preparation: form.preparation,
            category: currentDish.category,
            price: currentDish.price,
            calories: form.nutrition.calories ? parseInt(form.nutrition.calories, 10) : null,
            protein_g: form.nutrition.protein_g ? parseFloat(form.nutrition.protein_g) : null,
            carbs_g: form.nutrition.carbs_g ? parseFloat(form.nutrition.carbs_g) : null,
            carbs_fiber_g: form.nutrition.carbs_fiber_g ? parseFloat(form.nutrition.carbs_fiber_g) : null,
            carbs_sugar_g: form.nutrition.carbs_sugar_g ? parseFloat(form.nutrition.carbs_sugar_g) : null,
            carbs_added_sugar_g: form.nutrition.carbs_added_sugar_g ? parseFloat(form.nutrition.carbs_added_sugar_g) : null,
            fat_g: form.nutrition.fat_g ? parseFloat(form.nutrition.fat_g) : null,
            fat_saturated_g: form.nutrition.fat_saturated_g ? parseFloat(form.nutrition.fat_saturated_g) : null,
            fat_trans_g: form.nutrition.fat_trans_g ? parseFloat(form.nutrition.fat_trans_g) : null,
            fat_polyunsaturated_g: form.nutrition.fat_polyunsaturated_g ? parseFloat(form.nutrition.fat_polyunsaturated_g) : null,
            fat_monounsaturated_g: form.nutrition.fat_monounsaturated_g ? parseFloat(form.nutrition.fat_monounsaturated_g) : null,
            sodium_mg: form.nutrition.sodium_mg ? parseInt(form.nutrition.sodium_mg, 10) : null,
            cholesterol_mg: form.nutrition.cholesterol_mg ? parseInt(form.nutrition.cholesterol_mg, 10) : null,
            photo_url: photoUrl,
            modification_policy: 'Please inform your server of any dietary restrictions.',
            is_active: true,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        menuItemId = newItem.id;
      }

      // Process ingredients
      for (const ing of form.ingredients) {
        let ingredientId = ing.ingredientId;

        if (ing.isNew && !ingredientId) {
          const { data: newIng, error: ingError } = await supabase
            .from('ingredients')
            .insert({
              restaurant_id: restaurantId,
              name: ing.name,
              contains_allergens: ing.allergens,
            })
            .select('id')
            .single();

          if (ingError) {
            if (ingError.code === '23505') {
              const { data: existingIng } = await supabase
                .from('ingredients')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .eq('name', ing.name)
                .single();
              ingredientId = existingIng?.id;
            } else {
              throw ingError;
            }
          } else {
            ingredientId = newIng.id;
            setExistingIngredients(prev => [...prev, {
              id: newIng.id,
              restaurant_id: restaurantId,
              name: ing.name,
              contains_allergens: ing.allergens,
              created_at: new Date().toISOString(),
            }]);
          }
        }

        if (ingredientId) {
          const { data: miiData } = await supabase.from('menu_item_ingredients').insert({
            menu_item_id: menuItemId,
            ingredient_id: ingredientId,
            amount_value: ing.amountValue,
            amount_unit: ing.amountUnit,
            is_removable: ing.isRemovable,
            is_substitutable: ing.isSubstitutable,
          }).select('id').single();

          if (miiData && ing.isSubstitutable && ing.substitutes.length > 0) {
            for (const sub of ing.substitutes) {
              let subIngredientId = sub.ingredientId;

              if (sub.isNew && !subIngredientId) {
                const { data: newSubIng, error: subIngError } = await supabase
                  .from('ingredients')
                  .insert({
                    restaurant_id: restaurantId,
                    name: sub.name,
                    contains_allergens: sub.allergens,
                  })
                  .select('id')
                  .single();

                if (subIngError) {
                  if (subIngError.code === '23505') {
                    const { data: existingSubIng } = await supabase
                      .from('ingredients')
                      .select('id')
                      .eq('restaurant_id', restaurantId)
                      .eq('name', sub.name)
                      .single();
                    subIngredientId = existingSubIng?.id;
                  }
                } else {
                  subIngredientId = newSubIng.id;
                  setExistingIngredients(prev => [...prev, {
                    id: newSubIng.id,
                    restaurant_id: restaurantId,
                    name: sub.name,
                    contains_allergens: sub.allergens,
                    created_at: new Date().toISOString(),
                  }]);
                }
              }

              if (subIngredientId) {
                await supabase.from('ingredient_substitutes').insert({
                  menu_item_ingredient_id: miiData.id,
                  substitute_ingredient_id: subIngredientId,
                });
              }
            }
          }
        }
      }

      // Save cooking steps
      const cookingSteps = form.cookingSteps || [];
      if (cookingSteps.length > 0) {
        const stepsToInsert = cookingSteps
          .filter((step) => step.description.trim())
          .map((step) => ({
            menu_item_id: menuItemId,
            step_number: step.step_number,
            description: step.description,
            cross_contact_risk: step.cross_contact_risk,
            is_modifiable: step.is_modifiable,
            modifiable_allergens: step.modifiable_allergens,
            modification_notes: step.modification_notes || null,
          }));

        if (stepsToInsert.length > 0) {
          const { error: stepError } = await supabase
            .from('cooking_steps')
            .insert(stepsToInsert);

          if (stepError) {
            console.error('Error saving cooking steps:', stepError);
          }
        }
      }

      setCompletedDishes((prev) => new Set([...prev, currentDish.id]));
      setCurrentDishIndex(null);
      setSuggestedIngredients([]);
    } catch (err) {
      console.error('Error saving dish:', err);
      alert('Failed to save dish. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDish = async () => {
    if (!currentDish || !currentForm) return;

    // Validate that all ingredients have amounts
    const ingredientsWithoutAmount = currentForm.ingredients.filter(
      ing => ing.amountValue === null || ing.amountValue === undefined || ing.amountValue <= 0
    );

    if (ingredientsWithoutAmount.length > 0) {
      const names = ingredientsWithoutAmount.map(ing => ing.name).join(', ');
      setValidationError(`Please enter an amount for: ${names}`);
      return;
    }

    setValidationError(null);

    // Detect conflicts between cooking steps and ingredients
    const detectedConflicts = detectConflicts(currentForm);
    if (detectedConflicts.length > 0) {
      setConflicts(detectedConflicts);
      setShowConflictModal(true);
      return;
    }
    // No conflicts — save directly
    await executeSave();
  };

  const handleConflictResolutionSave = async () => {
    if (!currentDish || !currentForm) return;

    // Apply resolutions to get the updated form
    const resolvedForm = applyConflictResolutions(currentForm, conflicts);

    // Update the form state with resolved data
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: resolvedForm,
    }));

    setShowConflictModal(false);
    setConflicts([]);

    // Save with the resolved form data directly (avoids stale state)
    await executeSave(resolvedForm);
  };

  const handleFinish = () => {
    onComplete();
  };

  const handleMarkAsComplete = (dishId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the dish editor
    setCompletedDishes(prev => new Set([...prev, dishId]));
  };

  const handleAddCustomAllergen = async (index: number) => {
    const allergen = customAllergenInput.trim();
    if (!allergen || !currentDish || !currentForm) return;

    const ingredient = currentForm.ingredients[index];

    // Check if allergen already exists (case-insensitive)
    if (ingredient.allergens.some(a => a.toLowerCase() === allergen.toLowerCase())) {
      setCustomAllergenInput('');
      return;
    }

    const newAllergens = [...ingredient.allergens, allergen];

    // Update local state
    setDishForms((prev) => ({
      ...prev,
      [currentDish.id]: {
        ...prev[currentDish.id],
        ingredients: prev[currentDish.id]?.ingredients.map((ing, i) =>
          i === index ? { ...ing, allergens: newAllergens } : ing
        ) || [],
      },
    }));

    // If ingredient exists in DB, update its allergens there too
    if (ingredient.ingredientId) {
      try {
        await supabase
          .from('ingredients')
          .update({ contains_allergens: newAllergens })
          .eq('id', ingredient.ingredientId);

        // Update local existing ingredients state
        setExistingIngredients(prev =>
          prev.map(ing =>
            ing.id === ingredient.ingredientId
              ? { ...ing, contains_allergens: newAllergens }
              : ing
          )
        );
      } catch (err) {
        console.error('Error updating ingredient allergens:', err);
      }
    }

    setCustomAllergenInput('');
  };

  const completedCount = completedDishes.size;
  const progress = (completedCount / dishes.length) * 100;

  // Filter suggestions to exclude already added
  const filteredSuggestions = suggestedIngredients.filter(
    s => !currentForm?.ingredients.some(i => i.name.toLowerCase() === s.name.toLowerCase())
  );

  if (loadingIngredients || loadingExistingDishes) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-slate-600 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading dishes...
        </div>
      </div>
    );
  }

  if (currentDishIndex === null) {
    return (
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Add Dish Details
            </h1>
            <p className="text-slate-600 mb-6">
              Add ingredients and preparation information for each dish
            </p>

            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Progress</span>
                <span>
                  {completedCount} of {dishes.length} dishes completed
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-slate-900 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {dishes.map((dish, index) => {
                const isCompleted = completedDishes.has(dish.id);
                const existingData = existingDishData[dish.id];
                const hasExistingData = existingData && existingData.ingredients.length > 0;

                return (
                  <div
                    key={dish.id}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-50 border-green-200'
                        : hasExistingData
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setCurrentDishIndex(index)}
                        className="flex-1 text-left flex items-center gap-3"
                      >
                        {isCompleted ? (
                          <div className="bg-green-500 text-white rounded-full p-1 flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                        ) : hasExistingData ? (
                          <div className="bg-blue-500 text-white rounded-full p-1 flex-shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900">{dish.name}</h3>
                          <p className="text-sm text-slate-600">
                            {dish.category} • ${dish.price}
                          </p>
                          {hasExistingData && !isCompleted && (
                            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <span>Saved {formatTimeAgo(existingData.updatedAt)}</span>
                              <span>•</span>
                              <span>{existingData.ingredients.length} ingredients</span>
                            </p>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {hasExistingData && !isCompleted && (
                          <button
                            onClick={(e) => handleMarkAsComplete(dish.id, e)}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Keep Complete
                          </button>
                        )}
                        <button
                          onClick={() => setCurrentDishIndex(index)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {completedCount === dishes.length ? (
              <button
                onClick={handleFinish}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl"
              >
                All Dishes Complete - Continue
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
              >
                Continue ({completedCount}/{dishes.length} completed)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <button
            onClick={() => {
              setCurrentDishIndex(null);
              setSuggestedIngredients([]);
            }}
            className="text-slate-600 hover:text-slate-900 mb-6 flex items-center gap-2 text-sm"
          >
            ← Back to All Dishes
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{currentDish?.name}</h1>
            <p className="text-slate-600">
              {currentDish?.category} • ${currentDish?.price}
            </p>
          </div>

          {/* Nutrition Information */}
          <div className="mb-6 bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Nutrition Information (Optional)</h3>
              {estimatingCalories && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Estimating from ingredients...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              AI estimates nutrition based on ingredients. You can adjust any values manually.
            </p>

            {/* Main Macros Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Calories</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={currentForm?.nutrition.calories || ''}
                    onChange={(e) => setDishForms((prev) => ({
                      ...prev,
                      [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, calories: e.target.value } },
                    }))}
                    placeholder="0"
                    min="0"
                    disabled={estimatingCalories}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                  />
                  <span className="text-xs text-slate-400">kcal</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Protein</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={currentForm?.nutrition.protein_g || ''}
                    onChange={(e) => setDishForms((prev) => ({
                      ...prev,
                      [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, protein_g: e.target.value } },
                    }))}
                    placeholder="0"
                    min="0"
                    disabled={estimatingCalories}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                  />
                  <span className="text-xs text-slate-400">g</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Carbs</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={currentForm?.nutrition.carbs_g || ''}
                    onChange={(e) => setDishForms((prev) => ({
                      ...prev,
                      [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, carbs_g: e.target.value } },
                    }))}
                    placeholder="0"
                    min="0"
                    disabled={estimatingCalories}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                  />
                  <span className="text-xs text-slate-400">g</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Fat</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={currentForm?.nutrition.fat_g || ''}
                    onChange={(e) => setDishForms((prev) => ({
                      ...prev,
                      [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, fat_g: e.target.value } },
                    }))}
                    placeholder="0"
                    min="0"
                    disabled={estimatingCalories}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                  />
                  <span className="text-xs text-slate-400">g</span>
                </div>
              </div>
            </div>

            {/* Carb Details */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-2">Carbohydrate Details</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fiber</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.carbs_fiber_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, carbs_fiber_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Sugars</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.carbs_sugar_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, carbs_sugar_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Added Sugars</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.carbs_added_sugar_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, carbs_added_sugar_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fat Details */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-2">Fat Details</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Saturated</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.fat_saturated_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, fat_saturated_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Trans Fat</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.fat_trans_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, fat_trans_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Polyunsaturated</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.fat_polyunsaturated_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, fat_polyunsaturated_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Monounsaturated</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={currentForm?.nutrition.fat_monounsaturated_g || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, fat_monounsaturated_g: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Nutrients */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Other</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Sodium</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={currentForm?.nutrition.sodium_mg || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, sodium_mg: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">mg</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cholesterol</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={currentForm?.nutrition.cholesterol_mg || ''}
                      onChange={(e) => setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, nutrition: { ...currentForm!.nutrition, cholesterol_mg: e.target.value } },
                      }))}
                      placeholder="0"
                      min="0"
                      disabled={estimatingCalories}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-400">mg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Ingredients Section */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Ingredients
              </label>

              {/* AI Suggestions */}
              {(loadingSuggestions || filteredSuggestions.length > 0) && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-900">AI Suggestions</span>
                    {loadingSuggestions && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredSuggestions.slice(0, 10).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAddSuggestedIngredient(suggestion)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          suggestion.existingId
                            ? 'bg-purple-200 text-purple-900 hover:bg-purple-300'
                            : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        {suggestion.name}
                        {suggestion.existingId && (
                          <span className="text-xs opacity-70">(saved)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Ingredients */}
              {currentForm && currentForm.ingredients.length > 0 && (
                <div className="space-y-3 mb-4">
                  {currentForm.ingredients.map((ing, index) => {
                    const isExpanded = expandedIngredientIndex === index;
                    const filteredSubstituteIngredients = existingIngredients.filter(
                      existIng =>
                        existIng.name.toLowerCase().includes(substituteSearchQuery.toLowerCase()) &&
                        existIng.name.toLowerCase() !== ing.name.toLowerCase() &&
                        !ing.substitutes.some(s => s.name.toLowerCase() === existIng.name.toLowerCase())
                    );

                    return (
                      <div
                        key={index}
                        className="bg-slate-50 rounded-xl border border-slate-200 relative"
                      >
                        {/* Main ingredient row */}
                        <div className="p-3 flex items-center gap-3">
                          <button
                            onClick={() => setExpandedIngredientIndex(isExpanded ? null : index)}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 truncate">{ing.name}</span>
                              {ing.isNew && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">new</span>
                              )}
                              {ing.isRemovable && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0">removable</span>
                              )}
                              {ing.isSubstitutable && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded flex-shrink-0">substitutable</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {ing.allergens.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                  <span className="text-xs text-amber-700 truncate">
                                    {ing.allergens.join(', ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">No allergens</span>
                              )}
                              <button
                                onClick={() => setEditingAllergenIndex(editingAllergenIndex === index ? null : index)}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                                title="Edit allergens"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input
                              type="number"
                              value={ing.amountValue ?? ''}
                              onChange={(e) => updateIngredientAmount(
                                index,
                                e.target.value ? parseFloat(e.target.value) : null,
                                ing.amountUnit
                              )}
                              placeholder="0"
                              min="0"
                              step="0.1"
                              className="w-20 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                            />
                            <select
                              value={ing.amountUnit || 'g'}
                              onChange={(e) => updateIngredientAmount(
                                index,
                                ing.amountValue,
                                e.target.value as WeightUnit
                              )}
                              className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                            >
                              <optgroup label="Weight">
                                {WEIGHT_UNITS.filter(u => u.category === 'weight').map(u => (
                                  <option key={u.value} value={u.value}>{u.value}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Volume">
                                {WEIGHT_UNITS.filter(u => u.category === 'volume').map(u => (
                                  <option key={u.value} value={u.value}>{u.value}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Count">
                                {WEIGHT_UNITS.filter(u => u.category === 'count').map(u => (
                                  <option key={u.value} value={u.value}>{u.value}</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                          <button
                            onClick={() => removeIngredient(index)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                      {/* Allergen Editor Dropdown */}
                      {editingAllergenIndex === index && (
                        <div
                          ref={allergenEditorRef}
                          className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-80"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-900">Edit Allergens</span>
                            <button
                              onClick={() => setEditingAllergenIndex(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mb-3">
                            Select allergens for "{ing.name}". Changes are saved automatically.
                          </p>

                          {/* Common Allergens */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {COMMON_ALLERGENS.map((allergen) => {
                              const isSelected = ing.allergens.includes(allergen);
                              return (
                                <button
                                  key={allergen}
                                  onClick={() => toggleIngredientAllergen(index, allergen)}
                                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                                    isSelected
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                                  {allergen}
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom Allergens (not in COMMON_ALLERGENS) */}
                          {ing.allergens.filter(a => !COMMON_ALLERGENS.includes(a as typeof COMMON_ALLERGENS[number])).length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-slate-500 mb-1.5">Custom allergens:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ing.allergens
                                  .filter(a => !COMMON_ALLERGENS.includes(a as typeof COMMON_ALLERGENS[number]))
                                  .map((allergen) => (
                                    <button
                                      key={allergen}
                                      onClick={() => toggleIngredientAllergen(index, allergen)}
                                      className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-500 text-white transition-colors hover:bg-purple-600"
                                    >
                                      <Check className="w-3 h-3 inline mr-1" />
                                      {allergen}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Add Custom Allergen */}
                          <div className="border-t border-slate-200 pt-3">
                            <p className="text-xs text-slate-500 mb-2">Add custom allergen:</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customAllergenInput}
                                onChange={(e) => setCustomAllergenInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomAllergen(index);
                                  }
                                }}
                                placeholder="e.g., Corn, Nightshades"
                                className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                              />
                              <button
                                onClick={() => handleAddCustomAllergen(index)}
                                disabled={!customAllergenInput.trim()}
                                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                        {/* Expanded Modification Settings */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-white p-4 space-y-4">
                            {/* Modification Toggles */}
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ing.isRemovable}
                                  onChange={() => toggleIngredientRemovable(index)}
                                  className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-slate-700">Can be removed</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ing.isSubstitutable}
                                  onChange={() => toggleIngredientSubstitutable(index)}
                                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-slate-700">Can be substituted</span>
                              </label>
                            </div>

                            {/* Substitutes Section (only if substitutable) */}
                            {ing.isSubstitutable && (
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <Repeat className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm font-semibold text-purple-900">Substitutes</span>
                                </div>

                                {/* Existing Substitutes */}
                                {ing.substitutes.length > 0 && (
                                  <div className="space-y-2 mb-3">
                                    {ing.substitutes.map((sub, subIdx) => (
                                      <div
                                        key={subIdx}
                                        className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-purple-200"
                                      >
                                        <div>
                                          <span className="text-sm font-medium text-slate-900">{sub.name}</span>
                                          {sub.isNew && (
                                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">new</span>
                                          )}
                                          {sub.allergens.length > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                                              <span className="text-xs text-amber-700">{sub.allergens.join(', ')}</span>
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => removeSubstituteFromIngredient(index, subIdx)}
                                          className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Search existing ingredients for substitutes */}
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    value={substituteSearchQuery}
                                    onChange={(e) => setSubstituteSearchQuery(e.target.value)}
                                    placeholder="Search ingredients..."
                                    className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  />
                                  {substituteSearchQuery && filteredSubstituteIngredients.length > 0 && (
                                    <div className="mt-1 max-h-32 overflow-y-auto border border-purple-200 rounded-lg bg-white">
                                      {filteredSubstituteIngredients.slice(0, 5).map((subIng) => (
                                        <button
                                          key={subIng.id}
                                          onClick={() => handleAddExistingSubstitute(index, subIng)}
                                          className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center justify-between border-b border-purple-100 last:border-0"
                                        >
                                          <span className="font-medium text-slate-900">{subIng.name}</span>
                                          {subIng.contains_allergens.length > 0 && (
                                            <span className="text-xs text-amber-600">{subIng.contains_allergens.join(', ')}</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Add new substitute */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newSubstituteName}
                                    onChange={(e) => setNewSubstituteName(e.target.value)}
                                    placeholder="Or add new substitute..."
                                    className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  />
                                  <button
                                    onClick={() => handleAddNewSubstitute(index)}
                                    disabled={!newSubstituteName.trim() || detectingSubstituteAllergens}
                                    className="px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {detectingSubstituteAllergens ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Plus className="w-4 h-4" />
                                    )}
                                    Add
                                  </button>
                                </div>
                                <p className="text-xs text-purple-600 mt-2">
                                  AI will detect allergens for new substitutes
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add New Ingredient */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-600 mb-3">Add a new ingredient:</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    placeholder="Ingredient name"
                    className="flex-1 min-w-[150px] px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={newIngredientAmountValue}
                      onChange={(e) => setNewIngredientAmountValue(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.1"
                      className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                    <select
                      value={newIngredientAmountUnit}
                      onChange={(e) => setNewIngredientAmountUnit(e.target.value as WeightUnit)}
                      className="px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                    >
                      <optgroup label="Weight">
                        {WEIGHT_UNITS.filter(u => u.category === 'weight').map(u => (
                          <option key={u.value} value={u.value}>{u.value}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Volume">
                        {WEIGHT_UNITS.filter(u => u.category === 'volume').map(u => (
                          <option key={u.value} value={u.value}>{u.value}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Count">
                        {WEIGHT_UNITS.filter(u => u.category === 'count').map(u => (
                          <option key={u.value} value={u.value}>{u.value}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <button
                    onClick={handleAddNewIngredient}
                    disabled={!newIngredientName.trim() || detectingAllergens}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {detectingAllergens ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  AI will automatically detect common allergens for new ingredients
                </p>
              </div>
            </div>

            {/* Cooking Steps Section */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Cooking Steps
              </label>
              <p className="text-xs text-slate-600 mb-2">
                Describe the cooking process. Note any shared surfaces, fryers, or equipment used for allergens.
              </p>
              <textarea
                value={currentForm?.preparation || ''}
                onChange={(e) =>
                  setDishForms((prev) => ({
                    ...prev,
                    [currentDish!.id]: { ...currentForm!, preparation: e.target.value },
                  }))
                }
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-y min-h-[150px]"
                placeholder="Describe how this dish is prepared..."
              />
            </div>

            {/* Cross-Contact Risk Steps Section (Optional) */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Cross-Contact Risk Steps (Optional)</h3>
                  <p className="text-xs text-slate-500 mt-1">Add step-by-step details for cross-contact risk tracking</p>
                </div>
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
                {(currentForm?.cookingSteps || []).map((step, index) => (
                  <div key={index} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                        {step.step_number}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={step.description}
                          onChange={(e) => updateCookingStep(index, 'description', e.target.value)}
                          placeholder="Describe this cooking step (e.g., 'Fried in shared oil with shrimp')"
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                        />
                        {detectingCrossContact === index && (
                          <div className="flex items-center gap-2 text-amber-700 mt-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-xs">Analyzing cross-contact risks...</span>
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

                    {/* Modification Settings */}
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={step.is_modifiable}
                          onChange={(e) => updateCookingStep(index, 'is_modifiable', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-700">This step can be modified to avoid allergens</span>
                      </label>

                      {step.is_modifiable && (
                        <div className="pl-6 space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Which allergens can be avoided by modifying this step?
                            </label>
                            {step.modifiable_allergens.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {step.modifiable_allergens.map((allergen) => (
                                  <span key={allergen} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                    {allergen}
                                    <button
                                      type="button"
                                      onClick={() => updateCookingStep(index, 'modifiable_allergens', step.modifiable_allergens.filter((a: string) => a !== allergen))}
                                      className="p-0.5 hover:bg-green-200 rounded-full transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {COMMON_ALLERGENS.filter(a => !step.modifiable_allergens.includes(a)).map((allergen) => (
                                <button
                                  key={allergen}
                                  type="button"
                                  onClick={() => updateCookingStep(index, 'modifiable_allergens', [...step.modifiable_allergens, allergen])}
                                  className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-green-100 hover:text-green-700 transition-colors"
                                >
                                  + {allergen}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">How can this step be modified?</label>
                            <textarea
                              value={step.modification_notes}
                              onChange={(e) => updateCookingStep(index, 'modification_notes', e.target.value)}
                              placeholder="e.g., Can use separate fryer, can substitute oil..."
                              rows={2}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {(!currentForm?.cookingSteps || currentForm.cookingSteps.length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No cooking steps added yet. Click "Add Step" to start.
                  </p>
                )}
              </div>
            </div>

            {/* Photo Section */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Dish Photo (Optional)
              </label>
              <p className="text-xs text-slate-600 mb-2">
                Upload or take a photo of this dish to help customers visualize it
              </p>

              {currentForm?.photoUrl ? (
                <div className="relative">
                  <img
                    src={currentForm.photoUrl}
                    alt={currentDish!.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() =>
                      setDishForms((prev) => ({
                        ...prev,
                        [currentDish!.id]: { ...currentForm!, photoFile: null, photoUrl: '' },
                      }))
                    }
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block w-full p-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="text-sm text-slate-600">
                    Click to upload or drag and drop
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, currentDish!.id)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {validationError && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{validationError}</p>
              </div>
            )}

            <button
              onClick={handleSaveDish}
              disabled={saving || !currentForm || currentForm.ingredients.length === 0}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Dish'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Conflict Resolution Modal */}
    {showConflictModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Review before saving</h3>
            <button
              onClick={() => { setShowConflictModal(false); setConflicts([]); }}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 space-y-3">
            {conflicts.map((conflict, ci) => (
              <div key={conflict.id} className="space-y-2.5">
                <p className="text-xs text-slate-600 leading-relaxed">{conflict.description}</p>

                {conflict.type === 'select_modifiable_allergens' && conflict.availableAllergens ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {conflict.availableAllergens.map((allergen) => {
                        const isSelected = conflict.selectedAllergens?.has(allergen) ?? false;
                        return (
                          <button
                            key={allergen}
                            type="button"
                            onClick={() => {
                              setConflicts(prev => prev.map((c, i) => {
                                if (i !== ci) return c;
                                const newSet = new Set(c.selectedAllergens);
                                if (newSet.has(allergen)) newSet.delete(allergen);
                                else newSet.add(allergen);
                                return { ...c, selectedAllergens: newSet };
                              }));
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                              isSelected
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {allergen}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setConflicts(prev => prev.map((c, i) =>
                            i === ci ? { ...c, selectedAllergens: new Set(c.availableAllergens) } : c
                          ));
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConflicts(prev => prev.map((c, i) =>
                            i === ci ? { ...c, selectedAllergens: new Set<string>() } : c
                          ));
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        None
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {conflict.options.map((option, oi) => (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => {
                          setConflicts(prev => prev.map((c, i) =>
                            i === ci ? { ...c, selectedOption: oi } : c
                          ));
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                          conflict.selectedOption === oi
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-50 text-slate-600 border border-transparent hover:border-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                {ci < conflicts.length - 1 && <div className="border-t border-slate-100" />}
              </div>
            ))}
          </div>

          <div className="flex gap-2 px-5 py-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => { setShowConflictModal(false); setConflicts([]); }}
              className="flex-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConflictResolutionSave}
              disabled={conflicts.some(c =>
                c.type === 'select_modifiable_allergens'
                  ? (!c.selectedAllergens || c.selectedAllergens.size === 0)
                  : c.selectedOption === null
              )}
              className="flex-1 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
