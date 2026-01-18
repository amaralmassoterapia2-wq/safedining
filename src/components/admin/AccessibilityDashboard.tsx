import { useEffect, useState } from 'react';
import { supabase, Database } from '../../lib/supabase';
import { analyzeDishSafety, getStatusIcon } from '../../lib/safetyAnalysis';
import { Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];
type CustomerProfile = Database['public']['Tables']['customer_profiles']['Row'];

interface MenuItemWithDetails extends MenuItem {
  ingredients: Ingredient[];
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
  const [loading, setLoading] = useState(true);

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
          const [{ data: ingredients }, { data: cookingSteps }] = await Promise.all([
            supabase
              .from('ingredients')
              .select('*')
              .eq('menu_item_id', item.id),
            supabase
              .from('cooking_steps')
              .select('*')
              .eq('menu_item_id', item.id)
              .order('step_number', { ascending: true }),
          ]);

          return {
            ...item,
            ingredients: ingredients || [],
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

      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('*')
        .in('id', uniqueProfileIds);

      if (profiles) {
        setCustomerProfiles(profiles);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (menuItems.length > 0 && customerProfiles.length > 0) {
      calculateAllergenStats();
    }
  }, [menuItems, customerProfiles]);

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
        const analysis = analyzeDishSafety(
          item,
          item.ingredients,
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {totalMenuItems}
              </div>
              <div className="text-sm text-slate-600">Active Menu Items</div>
            </div>
          </div>
        </div>
      </div>

      {allergenStats.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Data Available Yet
          </h3>
          <p className="text-slate-600">
            Customer data will appear here once customers with dietary restrictions
            interact with your menu.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Allergen Accessibility Breakdown
          </h3>
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
