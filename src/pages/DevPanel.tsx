import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { impersonateRestaurant } from '../lib/devAuth';
import { ArrowLeft, ChevronDown, ChevronRight, UserCheck, AlertTriangle, UtensilsCrossed, Loader2 } from 'lucide-react';

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  qr_code: string;
  restaurant_code: string;
};

type DishWithAllergens = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  is_active: boolean;
  allAllergens: string[];
};

interface DevPanelProps {
  onBack: () => void;
  onImpersonated: () => void;
}

export default function DevPanel({ onBack, onImpersonated }: DevPanelProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dishes, setDishes] = useState<Record<string, DishWithAllergens[]>>({});
  const [loadingDishes, setLoadingDishes] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const handleImpersonate = async (restaurantId: string) => {
    setImpersonatingId(restaurantId);
    setImpersonateError(null);

    const { error } = await impersonateRestaurant(restaurantId);

    if (error) {
      setImpersonateError(error);
      setImpersonatingId(null);
    } else {
      onImpersonated();
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setRestaurants(data);
    }
    setLoading(false);
  };

  const toggleExpand = async (restaurantId: string) => {
    if (expandedId === restaurantId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(restaurantId);

    if (!dishes[restaurantId]) {
      setLoadingDishes(restaurantId);

      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category', { ascending: true })
        .order('created_at', { ascending: true });

      if (menuItems) {
        const itemsWithAllergens = await Promise.all(
          menuItems.map(async (item) => {
            const allergenSet = new Set<string>();

            for (const allergen of item.description_allergens || []) {
              allergenSet.add(allergen.toLowerCase());
            }

            const { data: menuItemIngredients } = await supabase
              .from('menu_item_ingredients')
              .select('*, ingredient:ingredients(*)')
              .eq('menu_item_id', item.id);

            for (const mii of menuItemIngredients || []) {
              const ing = (mii as any).ingredient;
              if (ing?.contains_allergens) {
                for (const allergen of ing.contains_allergens) {
                  allergenSet.add(allergen.toLowerCase());
                }
              }
            }

            const { data: cookingSteps } = await supabase
              .from('cooking_steps')
              .select('cross_contact_risk')
              .eq('menu_item_id', item.id);

            for (const step of cookingSteps || []) {
              for (const risk of step.cross_contact_risk || []) {
                allergenSet.add(risk.toLowerCase());
              }
            }

            return {
              id: item.id,
              name: item.name,
              description: item.description,
              category: item.category,
              price: item.price,
              is_active: item.is_active,
              allAllergens: Array.from(allergenSet).sort(),
            };
          })
        );

        setDishes(prev => ({ ...prev, [restaurantId]: itemsWithAllergens }));
      }

      setLoadingDishes(null);
    }
  };

  const getCategorizedDishes = (restaurantId: string) => {
    const items = dishes[restaurantId] || [];
    return items.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, DishWithAllergens[]>);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading restaurants...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Dev Panel</h1>
                <p className="text-sm text-amber-400">Development Mode — All Restaurants</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium">
              {restaurants.length} restaurants
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {impersonateError && (
          <div className="mb-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            Impersonation failed: {impersonateError}
          </div>
        )}
        <div className="space-y-4">
          {restaurants.map((restaurant) => {
            const isExpanded = expandedId === restaurant.id;
            const restaurantDishes = dishes[restaurant.id];
            const dishCount = restaurantDishes?.length ?? null;
            const categorized = isExpanded ? getCategorizedDishes(restaurant.id) : {};

            return (
              <div
                key={restaurant.id}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Restaurant header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-750 transition-colors"
                  onClick={() => toggleExpand(restaurant.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700 rounded-lg">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-300" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{restaurant.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-sm text-slate-400 font-mono">
                          Code: {restaurant.restaurant_code}
                        </span>
                        {dishCount !== null && (
                          <span className="text-sm text-slate-500">
                            {dishCount} dish{dishCount !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImpersonate(restaurant.id);
                    }}
                    disabled={impersonatingId !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                  >
                    {impersonatingId === restaurant.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        Impersonate
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded dishes */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-4">
                    {loadingDishes === restaurant.id ? (
                      <div className="text-center py-8 text-slate-400">Loading dishes...</div>
                    ) : restaurantDishes && restaurantDishes.length === 0 ? (
                      <div className="text-center py-8">
                        <UtensilsCrossed className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500">No dishes yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(categorized).map(([category, items]) => (
                          <div key={category}>
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                              {category}
                            </h4>
                            <div className="space-y-2">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                                    item.is_active
                                      ? 'bg-slate-900/50 border-slate-700'
                                      : 'bg-slate-900/30 border-slate-700/50 opacity-50'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-white text-sm">{item.name}</span>
                                      {!item.is_active && (
                                        <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                                          Hidden
                                        </span>
                                      )}
                                      {item.price && (
                                        <span className="text-sm text-emerald-400 ml-auto">
                                          ${Number(item.price).toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                                    )}
                                    {item.allAllergens.length > 0 && (
                                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                        {item.allAllergens.map((allergen) => (
                                          <span
                                            key={allergen}
                                            className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded capitalize"
                                          >
                                            {allergen}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
