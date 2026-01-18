import { useEffect, useState } from 'react';
import { supabase, Database } from '../lib/supabase';
import { getOrCreateSessionId } from '../lib/customerSession';
import { Settings } from 'lucide-react';
import BottomSheet from '../components/common/BottomSheet';
import DishDetail from '../components/customer/DishDetail';

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
}

export default function CustomerMenu({ qrCode, onEditProfile }: CustomerMenuProps) {
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
      .order('name');

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading menu...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center">
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-sm text-slate-600 mt-1">{restaurant.description}</p>
              )}
            </div>
            <button
              onClick={onEditProfile}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Dietary Settings"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      {categories.length > 1 && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                    filterCategory === category
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {category === 'all' ? 'All Items' : category}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-600">No menu items available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              filteredItems.reduce((acc, item) => {
                const cat = item.category || 'Other';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
              }, {} as Record<string, typeof filteredItems>)
            ).map(([category, items]) => (
              <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <h2 className="font-bold text-slate-900 uppercase text-sm tracking-wide">{category}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedDish(item)}
                      className="w-full p-5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                        {item.price && (
                          <span className="text-lg font-semibold text-slate-900 flex-shrink-0">
                            ${Number(item.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
