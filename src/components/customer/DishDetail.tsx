import { useState } from 'react';
import { analyzeDishSafety } from '../../lib/safetyAnalysis';
import { getDietaryIcon } from '../icons/DietaryIcons';
import { AlertCircle, CheckCircle, XCircle, Image as ImageIcon, Activity, ChevronDown, ChevronUp, Repeat, Trash2 } from 'lucide-react';
import { Database } from '../../lib/supabase';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

interface SubstituteInfo {
  id: string;
  name: string;
  allergens: string[];
}

interface IngredientWithModifications extends Ingredient {
  is_removable: boolean;
  is_substitutable: boolean;
  substitutes: SubstituteInfo[];
}

// Extended menu item with optional nutrition and photo fields
// Field names match the database schema
interface MenuItemWithExtras extends MenuItem {
  photo_url?: string | null;
}

interface DishDetailProps {
  dish: MenuItemWithExtras & { ingredients: IngredientWithModifications[]; cookingSteps: CookingStep[] };
  customerAllergens: string[];
  restaurantId: string;
}

export default function DishDetail({ dish, customerAllergens }: DishDetailProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showModifications, setShowModifications] = useState(false);
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(null);
  const analysis = analyzeDishSafety(dish, dish.ingredients, dish.cookingSteps, customerAllergens);

  // Get ingredients with modifications
  const removableIngredients = dish.ingredients.filter(ing => ing.is_removable);
  const substitutableIngredients = dish.ingredients.filter(ing => ing.is_substitutable);
  const hasModifications = removableIngredients.length > 0 || substitutableIngredients.length > 0;

  // Get allergens from ingredients
  const ingredientAllergenList = Array.from(
    new Set(dish.ingredients.flatMap((ing) => ing.contains_allergens))
  );

  // Get allergens from description (if available)
  const descriptionAllergenList = dish.description_allergens || [];

  // Combined allergen list
  const allergenList = Array.from(
    new Set([...ingredientAllergenList, ...descriptionAllergenList])
  );

  const safeFor = customerAllergens.length > 0
    ? customerAllergens.filter((allergen) =>
        !allergenList.some(a => a.toLowerCase().includes(allergen.toLowerCase()))
      )
    : [];

  const containsAllergens = customerAllergens.length > 0
    ? allergenList.filter((allergen) =>
        customerAllergens.some(ca => allergen.toLowerCase().includes(ca.toLowerCase()))
      )
    : allergenList;

  const getStatusConfig = () => {
    switch (analysis.status) {
      case 'safe':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-900',
          label: 'Safe for You',
          description: customerAllergens.length > 0
            ? 'This dish does not contain any of your listed allergens.'
            : 'No allergen restrictions detected in your profile.'
        };
      case 'safe-with-modifications':
        return {
          icon: <AlertCircle className="w-6 h-6 text-orange-600" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-900',
          label: 'Safe with Modifications',
          description: 'This dish can be made safe with some adjustments.'
        };
      case 'unsafe':
        return {
          icon: <XCircle className="w-6 h-6 text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-900',
          label: 'Contains Allergens',
          description: 'This dish contains ingredients that may cause an allergic reaction.'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const hasNutrition = dish.calories || dish.protein_g || dish.carbs_g || dish.fat_g || dish.sodium_mg || dish.cholesterol_mg;

  return (
    <div className="p-6 space-y-6">
      {dish.description && (
        <p className="text-slate-600 leading-relaxed">{dish.description}</p>
      )}

      {dish.price && (
        <div className="text-2xl font-bold text-slate-900">${Number(dish.price).toFixed(2)}</div>
      )}

      <div className={`${statusConfig.bgColor} ${statusConfig.borderColor} border-2 rounded-xl p-5`}>
        <div className="flex items-start gap-3 mb-3">
          {statusConfig.icon}
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${statusConfig.textColor}`}>{statusConfig.label}</h3>
            <p className={`text-sm ${statusConfig.textColor} mt-1`}>{statusConfig.description}</p>
          </div>
        </div>

        {safeFor.length > 0 && (
          <div className="mt-4 pt-4 border-t border-green-200">
            <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Safe For
            </h4>
            <div className="flex flex-wrap gap-2">
              {safeFor.map((restriction) => (
                <div
                  key={restriction}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                >
                  {getDietaryIcon(restriction, 16)}
                  {restriction}
                </div>
              ))}
            </div>
          </div>
        )}

        {containsAllergens.length > 0 && (
          <div className="mt-4 pt-4 border-t border-red-200">
            <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Contains
            </h4>
            <div className="flex flex-wrap gap-2">
              {containsAllergens.map((allergen) => {
                const isFromDescription = descriptionAllergenList.includes(allergen) && !ingredientAllergenList.includes(allergen);
                return (
                  <div
                    key={allergen}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      isFromDescription
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-red-100 text-red-800'
                    }`}
                    title={isFromDescription ? 'Detected from dish description' : undefined}
                  >
                    {getDietaryIcon(allergen, 16)}
                    {allergen}
                    {isFromDescription && (
                      <span className="text-xs text-amber-600">(desc)</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {analysis.modificationSuggestions && analysis.modificationSuggestions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-orange-200">
            <h4 className="text-sm font-semibold text-orange-800 mb-2">Suggested Modifications</h4>
            <ul className="space-y-1">
              {analysis.modificationSuggestions.map((suggestion, index) => (
                <li key={index} className="text-sm text-orange-900 flex items-start gap-2">
                  <span className="text-orange-600 mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.crossContactRisks && analysis.crossContactRisks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-red-300 bg-red-50 -mx-5 -mb-5 px-5 py-4 rounded-b-xl">
            <h4 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Cross-Contact Risks
            </h4>
            <ul className="space-y-1">
              {analysis.crossContactRisks.map((risk, index) => (
                <li key={index} className="text-sm text-red-800 flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">⚠</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Modification Options Section */}
      {hasModifications && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowModifications(!showModifications)}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Repeat className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-semibold text-purple-900">Modification Options</h3>
                <p className="text-sm text-purple-700 mt-0.5">
                  {removableIngredients.length > 0 && `${removableIngredients.length} removable`}
                  {removableIngredients.length > 0 && substitutableIngredients.length > 0 && ' • '}
                  {substitutableIngredients.length > 0 && `${substitutableIngredients.length} substitutable`}
                </p>
              </div>
            </div>
            {showModifications ? (
              <ChevronUp className="w-5 h-5 text-purple-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-purple-600" />
            )}
          </button>

          {showModifications && (
            <div className="px-5 pb-5 space-y-4">
              {/* Removable Ingredients */}
              {removableIngredients.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Can Be Removed
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {removableIngredients.map((ing) => (
                      <span
                        key={ing.id}
                        className="px-3 py-1.5 bg-green-100 text-green-800 text-sm font-medium rounded-full"
                      >
                        {ing.name}
                        {ing.contains_allergens.length > 0 && (
                          <span className="text-green-600 ml-1">
                            ({ing.contains_allergens.join(', ')})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    Ask your server to have these ingredients removed from your dish.
                  </p>
                </div>
              )}

              {/* Substitutable Ingredients */}
              {substitutableIngredients.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Can Be Substituted
                  </h4>
                  <div className="space-y-2">
                    {substitutableIngredients.map((ing) => (
                      <div key={ing.id} className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                        <button
                          onClick={() => setExpandedIngredient(expandedIngredient === ing.id ? null : ing.id)}
                          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-purple-50 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-purple-900">{ing.name}</span>
                            {ing.contains_allergens.length > 0 && (
                              <span className="text-purple-600 ml-2 text-sm">
                                ({ing.contains_allergens.join(', ')})
                              </span>
                            )}
                          </div>
                          {ing.substitutes.length > 0 && (
                            expandedIngredient === ing.id ? (
                              <ChevronUp className="w-4 h-4 text-purple-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-purple-600" />
                            )
                          )}
                        </button>

                        {expandedIngredient === ing.id && ing.substitutes.length > 0 && (
                          <div className="px-3 pb-3 pt-1 border-t border-purple-100 bg-purple-50/50">
                            <p className="text-xs text-purple-700 mb-2">Available substitutes:</p>
                            <div className="flex flex-wrap gap-2">
                              {ing.substitutes.map((sub) => {
                                // Check if substitute contains any of customer's allergens
                                const hasCustomerAllergen = customerAllergens.some(ca =>
                                  sub.allergens.some(sa => sa.toLowerCase().includes(ca.toLowerCase()))
                                );

                                return (
                                  <span
                                    key={sub.id}
                                    className={`px-2.5 py-1 text-sm rounded-full ${
                                      hasCustomerAllergen
                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                        : 'bg-slate-100 text-slate-800'
                                    }`}
                                  >
                                    {sub.name}
                                    {sub.allergens.length > 0 && (
                                      <span className={`ml-1 text-xs ${hasCustomerAllergen ? 'text-red-600' : 'text-slate-500'}`}>
                                        ({sub.allergens.join(', ')})
                                      </span>
                                    )}
                                    {hasCustomerAllergen && (
                                      <AlertCircle className="w-3 h-3 inline ml-1 text-red-600" />
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-purple-700 mt-2">
                    Tap an ingredient to see available substitutes. Ask your server for substitutions.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cooking Step Modifications */}
      {(() => {
        const modifiableSteps = (dish.cookingSteps || []).filter(s => s.is_modifiable);
        if (modifiableSteps.length === 0) return null;
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-blue-900 mb-3">Cooking Modifications Available</h3>
            <p className="text-sm text-blue-700 mb-3">These cooking steps can be adjusted to accommodate your dietary needs.</p>
            <div className="space-y-3">
              {modifiableSteps.map((step) => (
                <div key={step.id} className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-sm font-medium text-slate-900">Step {step.step_number}: {step.description}</p>
                  {step.modifiable_allergens.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {step.modifiable_allergens.map(a => {
                        const isRelevant = customerAllergens.some(ca => a.toLowerCase().includes(ca.toLowerCase()));
                        return (
                          <span key={a} className={`px-2 py-0.5 text-xs rounded-full ${isRelevant ? 'bg-green-100 text-green-800 font-medium' : 'bg-slate-100 text-slate-600'}`}>
                            Can avoid: {a}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {step.modification_notes && (
                    <p className="text-sm text-blue-700 mt-2 italic">{step.modification_notes}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-3">Ask your server about modifying these cooking steps.</p>
          </div>
        );
      })()}

      {hasNutrition && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Nutrition Information
          </h3>

          <div className="space-y-4">
            {dish.calories && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Calories</span>
                  <span className="text-2xl font-bold text-slate-900">{dish.calories}</span>
                </div>
              </div>
            )}

            {/* Macronutrients */}
            {(dish.protein_g || dish.carbs_g || dish.fat_g) && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Macronutrients</h4>

                {dish.protein_g !== null && dish.protein_g !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Protein</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.protein_g}g</span>
                  </div>
                )}

                {dish.carbs_g !== null && dish.carbs_g !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Total Carbohydrates</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.carbs_g}g</span>
                  </div>
                )}

                {dish.carbs_fiber_g !== null && dish.carbs_fiber_g !== undefined && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-500">Dietary Fiber</span>
                    <span className="text-sm font-medium text-slate-700">{dish.carbs_fiber_g}g</span>
                  </div>
                )}

                {dish.carbs_sugar_g !== null && dish.carbs_sugar_g !== undefined && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-500">Sugars</span>
                    <span className="text-sm font-medium text-slate-700">{dish.carbs_sugar_g}g</span>
                  </div>
                )}

                {dish.carbs_added_sugar_g !== null && dish.carbs_added_sugar_g !== undefined && (
                  <div className="flex items-center justify-between pl-8">
                    <span className="text-sm text-slate-400">Added Sugars</span>
                    <span className="text-sm font-medium text-slate-600">{dish.carbs_added_sugar_g}g</span>
                  </div>
                )}

                {dish.fat_g !== null && dish.fat_g !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Total Fat</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.fat_g}g</span>
                  </div>
                )}

                {dish.fat_saturated_g !== null && dish.fat_saturated_g !== undefined && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-500">Saturated Fat</span>
                    <span className="text-sm font-medium text-slate-700">{dish.fat_saturated_g}g</span>
                  </div>
                )}

                {dish.fat_trans_g !== null && dish.fat_trans_g !== undefined && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-500">Trans Fat</span>
                    <span className="text-sm font-medium text-slate-700">{dish.fat_trans_g}g</span>
                  </div>
                )}

                {dish.fat_polyunsaturated_g !== null && dish.fat_polyunsaturated_g !== undefined && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-500">Polyunsaturated Fat</span>
                    <span className="text-sm font-medium text-slate-700">{dish.fat_polyunsaturated_g}g</span>
                  </div>
                )}

                {dish.fat_monounsaturated_g !== null && dish.fat_monounsaturated_g !== undefined && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm text-slate-500">Monounsaturated Fat</span>
                    <span className="text-sm font-medium text-slate-700">{dish.fat_monounsaturated_g}g</span>
                  </div>
                )}
              </div>
            )}

            {/* Minerals */}
            {(dish.sodium_mg || dish.cholesterol_mg) && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Other</h4>

                {dish.cholesterol_mg !== null && dish.cholesterol_mg !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Cholesterol</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.cholesterol_mg}mg</span>
                  </div>
                )}

                {dish.sodium_mg !== null && dish.sodium_mg !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Sodium</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.sodium_mg}mg</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {dish.photo_url && (
        <button
          onClick={() => setShowPhotoModal(true)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl"
        >
          <ImageIcon className="w-5 h-5" />
          View Photo
        </button>
      )}

      {showPhotoModal && dish.photo_url && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-4xl w-full">
            <img
              src={dish.photo_url}
              alt={dish.name}
              className="w-full h-auto rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
