import { useEffect, useState, useCallback } from 'react';
import { supabase, Database } from '../../lib/supabase';
import { analyzeDishSafety, getStatusIcon } from '../../lib/safetyAnalysis';
import {
  analyzeDietaryMenuPossibilities,
  DIETARY_MENU_CATEGORIES,
  DietaryMenuAnalysisResult,
  DishForDietaryAnalysis,
} from '../../lib/openai';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Utensils,
  Leaf,
  Heart,
  ShieldCheck,
} from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];
type CustomerProfile = Database['public']['Tables']['customer_profiles']['Row'];
type MenuItemIngredient = Database['public']['Tables']['menu_item_ingredients']['Row'];

interface MenuItemWithDetails extends MenuItem {
  ingredients: Ingredient[];
  ingredientLinks: (MenuItemIngredient & { substitutes: { id: string; name: string; allergens: string[] }[] })[];
  cookingSteps: CookingStep[];
}

interface AccessibilityDashboardProps {
  restaurantId: string;
}

interface AllergenStats {
  allergen: string;
  affectedCustomers: number;
  safeItems: number;
  unsafeItems: number;
  modifiableItems: number;
}

export default function AccessibilityDashboard({ restaurantId }: AccessibilityDashboardProps) {
  const [menuItems, setMenuItems] = useState<MenuItemWithDetails[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [allergenStats, setAllergenStats] = useState<AllergenStats[]>([]);
  const [dietaryAnalysis, setDietaryAnalysis] = useState<DietaryMenuAnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingDietary, setAnalyzingDietary] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [restaurantId]);

  const loadDashboardData = async () => {
    setLoading(true);

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);

    if (items) {
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          // Get menu item ingredients with their links
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*')
            .eq('menu_item_id', item.id);

          // Get all ingredient IDs
          const ingredientIds = (menuItemIngredients || []).map(mii => mii.ingredient_id);

          // Get ingredients
          const { data: ingredients } = ingredientIds.length > 0
            ? await supabase
                .from('ingredients')
                .select('*')
                .in('id', ingredientIds)
            : { data: [] };

          // Get substitutes for each menu item ingredient
          const ingredientLinksWithSubstitutes = await Promise.all(
            (menuItemIngredients || []).map(async (mii) => {
              const { data: substitutes } = await supabase
                .from('ingredient_substitutes')
                .select('substitute_ingredient_id')
                .eq('menu_item_ingredient_id', mii.id);

              const substituteIds = (substitutes || []).map(s => s.substitute_ingredient_id);
              const { data: substituteIngredients } = substituteIds.length > 0
                ? await supabase
                    .from('ingredients')
                    .select('id, name, contains_allergens')
                    .in('id', substituteIds)
                : { data: [] };

              return {
                ...mii,
                substitutes: (substituteIngredients || []).map(si => ({
                  id: si.id,
                  name: si.name,
                  allergens: si.contains_allergens,
                })),
              };
            })
          );

          // Get cooking steps
          const { data: cookingSteps } = await supabase
            .from('cooking_steps')
            .select('*')
            .eq('menu_item_id', item.id)
            .order('step_number', { ascending: true });

          return {
            ...item,
            ingredients: ingredients || [],
            ingredientLinks: ingredientLinksWithSubstitutes,
            cookingSteps: cookingSteps || [],
          };
        })
      );

      setMenuItems(itemsWithDetails);
    }

    const { data: requests } = await supabase
      .from('chef_requests')
      .select('customer_profile_id')
      .eq('restaurant_id', restaurantId);

    if (requests) {
      const uniqueProfileIds = Array.from(
        new Set(requests.map((r) => r.customer_profile_id))
      );

      if (uniqueProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('customer_profiles')
          .select('*')
          .in('id', uniqueProfileIds);

        if (profiles) {
          setCustomerProfiles(profiles);
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (menuItems.length > 0 && customerProfiles.length > 0) {
      calculateAllergenStats();
    }
  }, [menuItems, customerProfiles]);

  // Run dietary analysis when menu items are loaded
  useEffect(() => {
    if (menuItems.length > 0 && !lastAnalysisTime) {
      runDietaryAnalysis();
    }
  }, [menuItems]);

  const calculateAllergenStats = () => {
    const allergenMap = new Map<string, AllergenStats>();

    const allAllergens = new Set<string>();
    customerProfiles.forEach((profile) => {
      [...profile.dietary_restrictions, ...profile.custom_allergens].forEach(
        (allergen) => allAllergens.add(allergen)
      );
    });

    allAllergens.forEach((allergen) => {
      const affectedCustomers = customerProfiles.filter((profile) =>
        [...profile.dietary_restrictions, ...profile.custom_allergens].includes(
          allergen
        )
      ).length;

      let safeItems = 0;
      let unsafeItems = 0;
      let modifiableItems = 0;

      menuItems.forEach((item) => {
        // Map ingredients with modification flags
        const ingredientsWithMods = item.ingredients.map(ing => {
          const link = item.ingredientLinks.find(l => l.ingredient_id === ing.id);
          return {
            ...ing,
            is_removable: link?.is_removable || false,
            is_substitutable: link?.is_substitutable || false,
            substitutes: link?.substitutes || [],
          };
        });

        const analysis = analyzeDishSafety(
          item,
          ingredientsWithMods,
          item.cookingSteps,
          [allergen]
        );

        if (analysis.status === 'safe') {
          safeItems++;
        } else if (analysis.status === 'safe-with-modifications') {
          modifiableItems++;
        } else {
          unsafeItems++;
        }
      });

      allergenMap.set(allergen, {
        allergen,
        affectedCustomers,
        safeItems,
        unsafeItems,
        modifiableItems,
      });
    });

    const stats = Array.from(allergenMap.values()).sort(
      (a, b) => b.affectedCustomers - a.affectedCustomers
    );
    setAllergenStats(stats);
  };

  const prepareDishesForAnalysis = useCallback((): DishForDietaryAnalysis[] => {
    return menuItems.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      description_allergens: item.description_allergens || [],
      carbs_g: item.carbs_g,
      sodium_mg: item.sodium_mg,
      ingredients: item.ingredients.map(ing => {
        const link = item.ingredientLinks.find(l => l.ingredient_id === ing.id);
        return {
          name: ing.name,
          allergens: ing.contains_allergens,
          is_removable: link?.is_removable || false,
          is_substitutable: link?.is_substitutable || false,
          substitutes: link?.substitutes || [],
        };
      }),
      cookingSteps: item.cookingSteps.map(step => ({
        description: step.description,
        cross_contact_risk: step.cross_contact_risk,
      })),
    }));
  }, [menuItems]);

  const runDietaryAnalysis = async () => {
    if (menuItems.length === 0) return;

    setAnalyzingDietary(true);
    try {
      const dishes = prepareDishesForAnalysis();
      const results = await analyzeDietaryMenuPossibilities(dishes);
      setDietaryAnalysis(results);
      setLastAnalysisTime(new Date());
    } catch (error) {
      console.error('Error running dietary analysis:', error);
    }
    setAnalyzingDietary(false);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: 'available' | 'limited' | 'unavailable') => {
    switch (status) {
      case 'available':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Available
          </span>
        );
      case 'limited':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" />
            Limited
          </span>
        );
      case 'unavailable':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" />
            Unavailable
          </span>
        );
    }
  };

  const getCategoryIcon = (type: 'allergen-free' | 'dietary-style' | 'health-focused') => {
    switch (type) {
      case 'allergen-free':
        return <ShieldCheck className="w-5 h-5" />;
      case 'dietary-style':
        return <Leaf className="w-5 h-5" />;
      case 'health-focused':
        return <Heart className="w-5 h-5" />;
    }
  };

  const totalCustomers = customerProfiles.length;
  const totalMenuItems = menuItems.length;
  const averageAccessibility =
    allergenStats.length > 0
      ? Math.round(
          (allergenStats.reduce(
            (sum, stat) => sum + stat.safeItems + stat.modifiableItems,
            0
          ) /
            (allergenStats.length * totalMenuItems)) *
            100
        )
      : 0;

  // Calculate dietary menu stats
  const availableDiets = dietaryAnalysis.filter(d => d.status === 'available').length;
  const limitedDiets = dietaryAnalysis.filter(d => d.status === 'limited').length;
  const unavailableDiets = dietaryAnalysis.filter(d => d.status === 'unavailable').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Accessibility Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">
          Understand how accessible your menu is to customers with dietary restrictions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {totalCustomers}
              </div>
              <div className="text-sm text-slate-600">Unique Customers</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {averageAccessibility}%
              </div>
              <div className="text-sm text-slate-600">Avg Accessibility</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Utensils className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {totalMenuItems}
              </div>
              <div className="text-sm text-slate-600">Active Menu Items</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {availableDiets}/{DIETARY_MENU_CATEGORIES.length}
              </div>
              <div className="text-sm text-slate-600">Dietary Menus</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dietary Menu Analysis Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Dietary Menu Availability</h3>
            <p className="text-sm text-slate-500 mt-1">
              AI-powered analysis of what dietary menus your restaurant can serve
            </p>
          </div>
          <button
            onClick={runDietaryAnalysis}
            disabled={analyzingDietary || menuItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${analyzingDietary ? 'animate-spin' : ''}`} />
            {analyzingDietary ? 'Analyzing...' : 'Re-analyze'}
          </button>
        </div>

        {lastAnalysisTime && (
          <p className="text-xs text-slate-400 mb-4">
            Last analyzed: {lastAnalysisTime.toLocaleTimeString()}
          </p>
        )}

        {menuItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-600">Add menu items to see dietary analysis</p>
          </div>
        ) : analyzingDietary && dietaryAnalysis.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-600">Analyzing your menu...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-100">
              <span className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full">
                {availableDiets} fully available
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-full">
                {limitedDiets} limited (&lt;5 dishes)
              </span>
              <span className="px-3 py-1 bg-red-50 text-red-700 text-sm rounded-full">
                {unavailableDiets} unavailable
              </span>
            </div>

            {/* Category groups */}
            {['allergen-free', 'dietary-style', 'health-focused'].map(type => (
              <div key={type} className="mb-4">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  {getCategoryIcon(type as 'allergen-free' | 'dietary-style' | 'health-focused')}
                  {type === 'allergen-free' ? 'Allergen-Free Menus' :
                   type === 'dietary-style' ? 'Dietary Style Menus' :
                   'Health-Focused Menus'}
                </h4>
                <div className="space-y-2">
                  {dietaryAnalysis
                    .filter(result => {
                      const category = DIETARY_MENU_CATEGORIES.find(c => c.id === result.categoryId);
                      return category?.type === type;
                    })
                    .map(result => {
                      const category = DIETARY_MENU_CATEGORIES.find(c => c.id === result.categoryId);
                      if (!category) return null;
                      const isExpanded = expandedCategories.has(result.categoryId);

                      return (
                        <div
                          key={result.categoryId}
                          className={`border rounded-lg overflow-hidden ${
                            result.status === 'unavailable' ? 'border-red-200 bg-red-50/30' :
                            result.status === 'limited' ? 'border-amber-200 bg-amber-50/30' :
                            'border-slate-200'
                          }`}
                        >
                          <button
                            onClick={() => toggleCategory(result.categoryId)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="font-medium text-slate-900">{category.name}</div>
                              {getStatusBadge(result.status)}
                              <span className="text-sm text-slate-500">
                                {result.totalAvailable} dish{result.totalAvailable !== 1 ? 'es' : ''}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-100">
                              <p className="text-sm text-slate-500 mt-3 mb-3">{category.description}</p>

                              {result.status === 'unavailable' && result.reason && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm text-red-700">{result.reason}</p>
                                </div>
                              )}

                              {result.warning && (
                                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm text-amber-700">{result.warning}</p>
                                </div>
                              )}

                              {result.availableDishes.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium text-slate-700 mb-2">Available Dishes:</h5>
                                  <div className="space-y-2">
                                    {result.availableDishes.map(dish => (
                                      <div key={dish.id} className="flex items-start gap-2 text-sm">
                                        <span className="text-green-600">✓</span>
                                        <div>
                                          <span className="text-slate-900">{dish.name}</span>
                                          {dish.requiresModification && dish.modifications && (
                                            <span className="text-amber-600 ml-2">
                                              (with modifications: {dish.modifications.join(', ')})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Allergen Stats Section */}
      {allergenStats.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Customer Data Available Yet
          </h3>
          <p className="text-slate-600">
            Customer allergen data will appear here once customers with dietary restrictions
            interact with your menu.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Customer Allergen Breakdown
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Based on customers who have interacted with your menu
          </p>
          <div className="space-y-4">
            {allergenStats.map((stat) => {
              const totalAccessible = stat.safeItems + stat.modifiableItems;
              const accessibilityPercentage = Math.round(
                (totalAccessible / totalMenuItems) * 100
              );

              return (
                <div
                  key={stat.allergen}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-900">
                        {stat.allergen}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {stat.affectedCustomers} customer
                        {stat.affectedCustomers !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {accessibilityPercentage}%
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-3">
                    <div className="flex h-full">
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${(stat.safeItems / totalMenuItems) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-orange-400"
                        style={{
                          width: `${(stat.modifiableItems / totalMenuItems) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-400"
                        style={{
                          width: `${(stat.unsafeItems / totalMenuItems) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xl">{getStatusIcon('safe')}</span>
                        <span className="text-slate-600">
                          {stat.safeItems} Safe
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xl">
                          {getStatusIcon('safe-with-modifications')}
                        </span>
                        <span className="text-slate-600">
                          {stat.modifiableItems} Modifiable
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xl">{getStatusIcon('unsafe')}</span>
                        <span className="text-slate-600">
                          {stat.unsafeItems} Unsafe
                        </span>
                      </div>
                    </div>
                  </div>

                  {stat.unsafeItems > stat.safeItems + stat.modifiableItems && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-700">
                        Consider adding more {stat.allergen}-free options or modifications
                        to improve accessibility for affected customers.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
