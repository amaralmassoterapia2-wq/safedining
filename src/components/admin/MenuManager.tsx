import { useEffect, useState } from 'react';
import { supabase, Database } from '../../lib/supabase';
import MenuItemForm from './MenuItemForm';
import MenuDigitization from '../onboarding/MenuDigitization';
import DishDetailsInput from '../onboarding/DishDetailsInput';
import { Plus, Edit2, Trash2, Eye, EyeOff, Camera, ArrowLeft, AlertTriangle } from 'lucide-react';
import { ScannedDish } from '../../pages/RestaurantOnboarding';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

type ViewMode = 'list' | 'form' | 'scan' | 'details';

interface MenuItemWithAllergens extends MenuItem {
  allAllergens: string[];
}

interface MenuManagerProps {
  restaurantId: string;
}

export default function MenuManager({ restaurantId }: MenuManagerProps) {
  const [menuItems, setMenuItems] = useState<MenuItemWithAllergens[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [scannedDishes, setScannedDishes] = useState<ScannedDish[]>([]);

  useEffect(() => {
    loadMenuItems();
  }, [restaurantId]);

  const loadMenuItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Load allergens for each item from all sources
      const itemsWithAllergens = await Promise.all(
        data.map(async (item) => {
          const allergenSet = new Set<string>();

          // 1. Description allergens
          for (const allergen of item.description_allergens || []) {
            allergenSet.add(allergen.toLowerCase());
          }

          // 2. Ingredient allergens
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

          // 3. Cooking steps cross-contact risks
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
            ...item,
            allAllergens: Array.from(allergenSet).sort(),
          };
        })
      );

      setMenuItems(itemsWithAllergens);
    }
    setLoading(false);
  };

  const handleToggleActive = async (item: MenuItem) => {
    // Optimistically update the UI
    setMenuItems(prev => prev.map(m =>
      m.id === item.id ? { ...m, is_active: !m.is_active } : m
    ));

    const { error } = await supabase
      .from('menu_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (error) {
      console.error('Error toggling item visibility:', error);
      // Revert the optimistic update on error
      setMenuItems(prev => prev.map(m =>
        m.id === item.id ? { ...m, is_active: item.is_active } : m
      ));
      alert('Failed to update item visibility. Please try again.');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item? This will also delete all associated ingredients and cooking steps.')) {
      return;
    }

    await supabase.from('ingredients').delete().eq('menu_item_id', itemId);
    await supabase.from('cooking_steps').delete().eq('menu_item_id', itemId);

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId);

    if (!error) {
      loadMenuItems();
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setViewMode('form');
  };

  const handleFormClose = () => {
    setViewMode('list');
    setEditingItem(null);
    loadMenuItems();
  };

  const handleScanComplete = (dishes: ScannedDish[]) => {
    setScannedDishes(dishes);
    setViewMode('details');
  };

  const handleDetailsComplete = () => {
    setScannedDishes([]);
    setViewMode('list');
    loadMenuItems();
  };

  const handleBackFromScan = () => {
    setViewMode('list');
  };

  const categorizedItems = menuItems.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItemWithAllergens[]>);

  // Scan menu view
  if (viewMode === 'scan') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackFromScan}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Scan Menu Image</h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload or capture a menu image to add new items
            </p>
          </div>
        </div>
        <MenuDigitization
          restaurantId={restaurantId}
          onComplete={handleScanComplete}
        />
      </div>
    );
  }

  // Dish details editing view (after scan)
  if (viewMode === 'details' && scannedDishes.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode('scan')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Edit Scanned Items</h2>
            <p className="text-sm text-slate-400 mt-1">
              Review and add details to the scanned menu items
            </p>
          </div>
        </div>
        <DishDetailsInput
          restaurantId={restaurantId}
          dishes={scannedDishes}
          onComplete={handleDetailsComplete}
        />
      </div>
    );
  }

  // Manual form view
  if (viewMode === 'form') {
    return (
      <MenuItemForm
        restaurantId={restaurantId}
        editingItem={editingItem}
        onClose={handleFormClose}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading menu items...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Menu Items</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage your restaurant's menu with detailed allergen information
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('scan')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Scan Menu
          </button>
          <button
            onClick={() => setViewMode('form')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Manually
          </button>
        </div>
      </div>

      {menuItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Menu Items Yet
            </h3>
            <p className="text-slate-600 mb-6">
              Start building your menu by scanning an image of your menu or adding items manually.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setViewMode('scan')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Scan Menu Image
              </button>
              <button
                onClick={() => setViewMode('form')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Manually
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(categorizedItems).map(([category, items]) => (
            <div key={category} className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                {category}
              </h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      item.is_active
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-300 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <h4 className="font-semibold text-slate-900">{item.name}</h4>
                        {!item.is_active && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                            Hidden
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                      )}
                      {item.allAllergens && item.allAllergens.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {item.allAllergens.map((allergen) => (
                              <span
                                key={allergen}
                                className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full capitalize"
                              >
                                {allergen}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.price && (
                        <p className="text-sm font-medium text-emerald-600 mt-2">
                          ${Number(item.price).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title={item.is_active ? 'Hide from menu' : 'Show in menu'}
                      >
                        {item.is_active ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
