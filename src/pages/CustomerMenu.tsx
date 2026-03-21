import { useEffect, useState } from 'react';
import { supabase, Database } from '../lib/supabase';
import { getOrCreateSessionId } from '../lib/customerSession';
import { Settings, ChevronRight, AlertCircle, CheckCircle, XCircle, LogOut } from 'lucide-react';
import ShieldWithForkKnife from '../components/ShieldWithForkKnife';
import BottomSheet from '../components/common/BottomSheet';
import DishDetail from '../components/customer/DishDetail';
import { analyzeDishSafety } from '../lib/safetyAnalysis';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];
type Restaurant = Database['public']['Tables']['restaurants']['Row'];

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

interface MenuItemWithData extends MenuItem {
  ingredients: IngredientWithModifications[];
  cookingSteps: CookingStep[];
}

interface CustomerMenuProps {
  qrCode: string;
  onEditProfile: () => void;
  onExit?: () => void;
}

export default function CustomerMenu({ qrCode, onEditProfile, onExit }: CustomerMenuProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemWithData[]>([]);
  const [customerAllergens, setCustomerAllergens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDish, setSelectedDish] = useState<MenuItemWithData | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [qrCode]);

  const loadData = async () => {
    setLoading(true);

    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('*')
      .eq('qr_code', qrCode)
      .maybeSingle();

    if (!restaurantData) {
      alert('Restaurant not found');
      setLoading(false);
      return;
    }

    setRestaurant(restaurantData);

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantData.id)
      .eq('is_active', true)
      .order('category')
      .order('created_at');

    if (items) {
      const itemsWithData = await Promise.all(
        items.map(async (item) => {
          // Load ingredients via junction table
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*, ingredient:ingredients(*)')
            .eq('menu_item_id', item.id);

          // Get all menu_item_ingredient IDs to fetch substitutes
          const miiIds = (menuItemIngredients || []).map((mii: any) => mii.id);

          // Fetch substitutes for all menu_item_ingredients
          const { data: substitutesData } = miiIds.length > 0 ? await supabase
            .from('ingredient_substitutes')
            .select('*, substitute:ingredients(*)')
            .in('menu_item_ingredient_id', miiIds) : { data: [] };

          const ingredients: IngredientWithModifications[] = (menuItemIngredients || []).map((mii: any) => {
            // Find substitutes for this menu_item_ingredient
            const subs = (substitutesData || [])
              .filter((s: any) => s.menu_item_ingredient_id === mii.id)
              .map((s: any) => ({
                id: s.substitute_ingredient_id,
                name: s.substitute?.name || '',
                allergens: s.substitute?.contains_allergens || [],
              }));

            return {
              ...mii.ingredient,
              is_removable: mii.is_removable || false,
              is_substitutable: mii.is_substitutable || false,
              substitutes: subs,
            };
          });

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

      setMenuItems(itemsWithData);
    }

    const sessionId = getOrCreateSessionId();
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (profile) {
      const { data: restrictions } = await supabase
        .from('dietary_restrictions')
        .select('allergens')
        .in('name', profile.dietary_restrictions);

      const allAllergens = [
        ...profile.custom_allergens,
        ...(restrictions?.flatMap((r) => r.allergens) || []),
      ];

      setCustomerAllergens(allAllergens);
    }

    setLoading(false);
  };

  const getDishSafetyStatus = (item: MenuItemWithData) => {
    const analysis = analyzeDishSafety(item, item.ingredients, item.cookingSteps, customerAllergens);
    return analysis.status;
  };

  const getSafetyBadge = (status: 'safe' | 'safe-with-modifications' | 'unsafe') => {
    switch (status) {
      case 'safe':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Safe
          </span>
        );
      case 'safe-with-modifications':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" />
            Modifiable
          </span>
        );
      case 'unsafe':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" />
            Contains Allergens
          </span>
        );
    }
  };

  const guestBg = { background: 'linear-gradient(160deg, #e0f2f1 0%, #e8f4f8 40%, #fce8d8 100%)' } as const;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={guestBg}>
        <div className="text-slate-500">Loading menu...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={guestBg}>
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <p className="text-slate-600">Restaurant not found</p>
        </div>
      </div>
    );
  }

  const categories = ['all', ...Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean)))];
  const filteredItems = filterCategory === 'all'
    ? menuItems
    : menuItems.filter((item) => item.category === filterCategory);

  return (
    <div className="min-h-screen" style={guestBg}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldWithForkKnife size={36} />
              <div>
                <h1 className="text-xl font-bold text-slate-800">{restaurant.name}</h1>
                {restaurant.description && (
                  <p className="text-sm text-slate-500">{restaurant.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEditProfile}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                title="Dietary Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Exit Menu"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Exit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Menu Content */}
      <>
        {/* Allergen Alert Banner */}
          {customerAllergens.length > 0 && (
            <div className="max-w-4xl mx-auto px-4 pt-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <ShieldWithForkKnife size={28} />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">
                      Filtering for: <span className="font-medium text-slate-800">{customerAllergens.join(', ')}</span>
                    </p>
                  </div>
                  <button
                    onClick={onEditProfile}
                    className="text-teal-600 text-sm font-medium hover:text-teal-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Category Filter */}
          {categories.length > 2 && (
            <div className="bg-white/60 border-b border-slate-200">
              <div className="max-w-4xl mx-auto px-4 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {categories.map((category) => (
                    <button
                      key={category ?? 'null'}
                      onClick={() => setFilterCategory(category ?? 'all')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                        filterCategory === category
                          ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {category === 'all' ? 'All Items' : category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <main className="max-w-4xl mx-auto px-4 py-6">
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xl">
                <p className="text-slate-600">No menu items available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  filteredItems.reduce((acc, item) => {
                    const cat = item.category || 'Other';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {} as Record<string, typeof filteredItems>)
                ).map(([category, items]) => (
                  <div key={category} className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-teal-500 px-5 py-3">
                      <h2 className="font-bold text-white uppercase text-sm tracking-wide">{category}</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const safetyStatus = customerAllergens.length > 0 ? getDishSafetyStatus(item) : null;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedDish(item)}
                            className="w-full p-5 hover:bg-slate-50 transition-colors text-left group"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                                  {safetyStatus && getSafetyBadge(safetyStatus)}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{item.description}</p>
                                )}
                                {item.calories && (
                                  <p className="text-xs text-slate-400 mt-1">{item.calories} cal</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.price && (
                                  <span className="text-lg font-bold text-slate-900">
                                    ${Number(item.price).toFixed(2)}
                                  </span>
                                )}
                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
      </>

      <BottomSheet
        isOpen={!!selectedDish}
        onClose={() => setSelectedDish(null)}
        title={selectedDish?.name}
      >
        {selectedDish && (
          <DishDetail
            dish={selectedDish}
            customerAllergens={customerAllergens}
            restaurantId={restaurant.id}
          />
        )}
      </BottomSheet>
    </div>
  );
}
