import { useState } from 'react';
import { analyzeDishSafety } from '../../lib/safetyAnalysis';
import { getDietaryIcon } from '../icons/DietaryIcons';
import { AlertCircle, CheckCircle, XCircle, Image as ImageIcon, Activity } from 'lucide-react';
import { Database } from '../../lib/supabase';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

interface DishDetailProps {
  dish: MenuItem & { ingredients: Ingredient[]; cookingSteps: CookingStep[] };
  customerAllergens: string[];
  restaurantId: string;
}

export default function DishDetail({ dish, customerAllergens }: DishDetailProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const analysis = analyzeDishSafety(dish, dish.ingredients, dish.cookingSteps, customerAllergens);

  const allergenList = Array.from(
    new Set(dish.ingredients.flatMap((ing) => ing.contains_allergens))
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
  const hasNutrition = dish.calories || dish.protein_grams || dish.carbs_grams || dish.fat_grams;

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
              {containsAllergens.map((allergen) => (
                <div
                  key={allergen}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                >
                  {getDietaryIcon(allergen, 16)}
                  {allergen}
                </div>
              ))}
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

            {(dish.protein_grams || dish.carbs_grams || dish.fat_grams) && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Macronutrients</h4>

                {dish.protein_grams && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Protein</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.protein_grams}g</span>
                  </div>
                )}

                {dish.carbs_grams && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Carbohydrates</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.carbs_grams}g</span>
                  </div>
                )}

                {dish.fat_grams && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Fat</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.fat_grams}g</span>
                  </div>
                )}

                {dish.fiber_grams && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Fiber</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.fiber_grams}g</span>
                  </div>
                )}

                {dish.sugar_grams && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Sugar</span>
                    <span className="text-sm font-semibold text-slate-900">{dish.sugar_grams}g</span>
                  </div>
                )}

                {dish.sodium_mg && (
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
