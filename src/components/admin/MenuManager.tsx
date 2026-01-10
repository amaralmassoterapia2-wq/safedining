import { useEffect, useState } from 'react';
import { supabase, Database } from '../../lib/supabase';
import MenuItemForm from './MenuItemForm';
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

interface MenuManagerProps {
  restaurantId: string;
}

export default function MenuManager({ restaurantId }: MenuManagerProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

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
      .order('name', { ascending: true });

    if (!error && data) {
      setMenuItems(data);
    }
    setLoading(false);
  };

  const handleToggleActive = async (item: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (!error) {
      loadMenuItems();
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
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
    loadMenuItems();
  };

  const categorizedItems = menuItems.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (showForm) {
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
          <h2 className="text-2xl font-bold text-slate-900">Menu Items</h2>
          <p className="text-sm text-slate-600 mt-1">
            Manage your restaurant's menu with detailed allergen information
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Menu Item
        </button>
      </div>

      {menuItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="max-w-sm mx-auto">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Menu Items Yet
            </h3>
            <p className="text-slate-600 mb-6">
              Start building your menu by adding your first dish with detailed ingredients and allergen information.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Item
            </button>
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
