import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Standard FDA top 9 allergens
const ALLERGENS = [
  { key: 'milk', label: 'Milk', aliases: ['dairy', 'lactose', 'milk'] },
  { key: 'eggs', label: 'Eggs', aliases: ['egg', 'eggs'] },
  { key: 'fish', label: 'Fish', aliases: ['fish'] },
  { key: 'shellfish', label: 'Shellfish', aliases: ['shellfish', 'crustacean', 'shrimp', 'crab', 'lobster'] },
  { key: 'tree_nuts', label: 'Tree Nuts', aliases: ['tree nut', 'tree nuts', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'brazil nut'] },
  { key: 'peanuts', label: 'Peanuts', aliases: ['peanut', 'peanuts'] },
  { key: 'wheat', label: 'Wheat', aliases: ['wheat', 'gluten'] },
  { key: 'soy', label: 'Soy', aliases: ['soy', 'soybean', 'soya'] },
  { key: 'sesame', label: 'Sesame', aliases: ['sesame'] },
];

// Allergen icons as SVG components
const AllergenIcons: Record<string, React.FC<{ size?: number }>> = {
  milk: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 2h8l1 4H7l1-4z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
      <path d="M7 6h10v2c0 1-1 2-2 2H9c-1 0-2-1-2-2V6z" fill="#BBDEFB" stroke="#1565C0" strokeWidth="1.5"/>
      <path d="M9 10h6v10c0 1-1 2-2 2h-2c-1 0-2-1-2-2V10z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
    </svg>
  ),
  eggs: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="14" rx="6" ry="7" fill="#FFF8E1" stroke="#F57C00" strokeWidth="1.5"/>
      <ellipse cx="12" cy="14" rx="3" ry="3.5" fill="#FFD54F"/>
    </svg>
  ),
  fish: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12c3-4 7-5 11-5 2 0 4 1 6 2l3 3-3 3c-2 1-4 2-6 2-4 0-8-1-11-5z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
      <circle cx="17" cy="12" r="1.5" fill="#1565C0"/>
      <path d="M7 9c1 1.5 1 4.5 0 6" stroke="#1565C0" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  shellfish: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 4c-3 0-6 2-7 5l-1 4 3 4c1 2 3 3 5 3s4-1 5-3l3-4-1-4c-1-3-4-5-7-5z" fill="#FFEBEE" stroke="#C62828" strokeWidth="1.5"/>
      <path d="M8 10c0 2 2 4 4 4s4-2 4-4" stroke="#C62828" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 8l-2-3M18 8l2-3" stroke="#C62828" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  tree_nuts: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="13" rx="5" ry="6" fill="#EFEBE9" stroke="#5D4037" strokeWidth="1.5"/>
      <path d="M12 7c-1-2-1-4 0-5 1 1 1 3 0 5z" fill="#8D6E63" stroke="#5D4037" strokeWidth="1"/>
      <path d="M10 10c0 1 1 2 2 2s2-1 2-2" stroke="#5D4037" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  peanuts: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="9" cy="10" rx="4" ry="5" fill="#FFF3E0" stroke="#E65100" strokeWidth="1.5"/>
      <ellipse cx="15" cy="14" rx="4" ry="5" fill="#FFF3E0" stroke="#E65100" strokeWidth="1.5"/>
      <path d="M11 12c1 0 2 1 2 2" stroke="#E65100" strokeWidth="1.5"/>
    </svg>
  ),
  wheat: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22V8" stroke="#F9A825" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 8c-2-1-3-3-3-5 0 2 1 4 3 5zM12 8c2-1 3-3 3-5 0 2-1 4-3 5z" fill="#FFF8E1" stroke="#F9A825" strokeWidth="1.5"/>
      <path d="M12 12c-2-1-3-3-3-5 0 2 1 4 3 5zM12 12c2-1 3-3 3-5 0 2-1 4-3 5z" fill="#FFF8E1" stroke="#F9A825" strokeWidth="1.5"/>
      <path d="M12 16c-2-1-3-3-3-5 0 2 1 4 3 5zM12 16c2-1 3-3 3-5 0 2-1 4-3 5z" fill="#FFF8E1" stroke="#F9A825" strokeWidth="1.5"/>
    </svg>
  ),
  soy: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="8" cy="12" rx="3" ry="4" fill="#C5E1A5" stroke="#33691E" strokeWidth="1.5"/>
      <ellipse cx="14" cy="10" rx="3" ry="4" fill="#C5E1A5" stroke="#33691E" strokeWidth="1.5"/>
      <ellipse cx="14" cy="16" rx="3" ry="4" fill="#C5E1A5" stroke="#33691E" strokeWidth="1.5"/>
      <path d="M6 6c2 0 3 2 3 4M16 4c0 2 1 3 2 4" stroke="#33691E" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  sesame: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="12" rx="3" ry="5" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="7" cy="10" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="17" cy="10" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="8" cy="16" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="16" cy="16" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
    </svg>
  ),
};

type AllergenStatus = 'not_present' | 'can_modify' | 'cannot_modify';

interface DishAllergenData {
  id: string;
  name: string;
  category: string;
  allergens: Record<string, AllergenStatus>;
}

interface AllergenMatrixPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
}

// Print content component
function PrintContent({
  dishes,
  restaurantName,
  groupedDishes,
}: {
  dishes: DishAllergenData[];
  restaurantName: string;
  groupedDishes: Record<string, DishAllergenData[]>;
}) {
  const getStatusDot = (status: AllergenStatus) => {
    const colors = {
      not_present: '#10B981',
      can_modify: '#FBBF24',
      cannot_modify: '#EF4444',
    };
    return (
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: colors[status],
          margin: '0 auto',
        }}
      />
    );
  };

  return (
    <div
      id="allergen-print-content"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '100%',
        background: 'white',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
          {restaurantName} - Allergen Matrix
        </h1>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
          Generated on {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Legend */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          background: '#f8fafc',
        }}
      >
        <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
          Color Legend
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              <strong>Red</strong> = Contains allergen – CANNOT be modified
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#FBBF24' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              <strong>Yellow</strong> = Contains allergen – CAN be modified
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              <strong>Green</strong> = Does NOT contain allergen
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '11px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                border: '1px solid #cbd5e1',
                fontWeight: '600',
                color: '#475569',
                minWidth: '140px',
              }}
            >
              Dish Name
            </th>
            {ALLERGENS.map((allergen) => (
              <th
                key={allergen.key}
                style={{
                  padding: '6px 4px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#475569',
                  minWidth: '55px',
                }}
              >
                {allergen.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedDishes).map(([category, categoryDishes]) => (
            <>
              <tr key={`cat-${category}`} style={{ backgroundColor: '#f8fafc' }}>
                <td
                  colSpan={ALLERGENS.length + 1}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #cbd5e1',
                    fontWeight: 'bold',
                    color: '#1e293b',
                  }}
                >
                  {category}
                </td>
              </tr>
              {categoryDishes.map((dish, idx) => (
                <tr
                  key={dish.id}
                  style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}
                >
                  <td
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #cbd5e1',
                      fontWeight: '500',
                      color: '#1e293b',
                    }}
                  >
                    {dish.name}
                  </td>
                  {ALLERGENS.map((allergen) => (
                    <td
                      key={`${dish.id}-${allergen.key}`}
                      style={{
                        padding: '6px',
                        border: '1px solid #cbd5e1',
                        textAlign: 'center',
                      }}
                    >
                      {getStatusDot(dish.allergens[allergen.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
          This allergen matrix is provided for informational purposes. Please inform your server of any allergies before ordering.
          Cross-contamination may occur during food preparation.
        </p>
      </div>
    </div>
  );
}

export default function AllergenMatrixPreview({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
}: AllergenMatrixPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [dishes, setDishes] = useState<DishAllergenData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAllergenData();
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, restaurantId]);

  const loadAllergenData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) {
        setError('No menu items found');
        setLoading(false);
        return;
      }

      const dishData: DishAllergenData[] = await Promise.all(
        items.map(async (item) => {
          // Fetch ingredients
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*, ingredient:ingredients(*)')
            .eq('menu_item_id', item.id);

          // Fetch cooking steps for cross-contact risks
          const { data: cookingSteps } = await supabase
            .from('cooking_steps')
            .select('cross_contact_risk')
            .eq('menu_item_id', item.id);

          const allergenInfo: Record<string, { present: boolean; canModify: boolean }> = {};

          ALLERGENS.forEach((a) => {
            allergenInfo[a.key] = { present: false, canModify: false };
          });

          // 1. Description allergens (cannot be modified)
          for (const descAllergen of item.description_allergens || []) {
            const lowerAllergen = descAllergen.toLowerCase();
            for (const allergen of ALLERGENS) {
              if (allergen.aliases.some((alias) => lowerAllergen.includes(alias))) {
                allergenInfo[allergen.key] = { present: true, canModify: false };
              }
            }
          }

          // 2. Cooking steps cross-contact risks (cannot be modified)
          for (const step of cookingSteps || []) {
            for (const risk of step.cross_contact_risk || []) {
              const lowerRisk = risk.toLowerCase();
              for (const allergen of ALLERGENS) {
                if (allergen.aliases.some((alias) => lowerRisk.includes(alias))) {
                  allergenInfo[allergen.key] = { present: true, canModify: false };
                }
              }
            }
          }

          // 3. Ingredient allergens (may be modifiable)
          // If any ingredient with this allergen is removable/substitutable,
          // the allergen can be modified — chef explicitly marked it as such
          for (const mii of menuItemIngredients || []) {
            const ing = (mii as any).ingredient;
            if (!ing) continue;

            for (const ingAllergen of ing.contains_allergens || []) {
              const lowerAllergen = ingAllergen.toLowerCase();
              for (const allergen of ALLERGENS) {
                if (allergen.aliases.some((alias) => lowerAllergen.includes(alias))) {
                  const canModify = mii.is_removable || mii.is_substitutable;
                  if (canModify) {
                    // Chef explicitly marked this ingredient as modifiable — upgrade to can_modify
                    allergenInfo[allergen.key] = { present: true, canModify: true };
                  } else if (!allergenInfo[allergen.key].present) {
                    // First time seeing this allergen from a non-modifiable ingredient
                    allergenInfo[allergen.key] = { present: true, canModify: false };
                  }
                }
              }
            }
          }

          const allergens: Record<string, AllergenStatus> = {};
          ALLERGENS.forEach((a) => {
            const info = allergenInfo[a.key];
            if (!info.present) {
              allergens[a.key] = 'not_present';
            } else if (info.canModify) {
              allergens[a.key] = 'can_modify';
            } else {
              allergens[a.key] = 'cannot_modify';
            }
          });

          return {
            id: item.id,
            name: item.name,
            category: item.category || 'Other',
            allergens,
          };
        })
      );

      setDishes(dishData);
    } catch (err: any) {
      setError(err.message || 'Failed to load allergen data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const printContent = document.getElementById('allergen-print-content');
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('Please allow popups to download PDF');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${restaurantName} - Allergen Matrix</title>
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            @page {
              size: landscape;
              margin: 0.4in;
            }
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusDot = (status: AllergenStatus) => {
    switch (status) {
      case 'not_present':
        return (
          <div
            className="w-5 h-5 rounded-full mx-auto"
            style={{ backgroundColor: '#10B981' }}
          />
        );
      case 'can_modify':
        return (
          <div
            className="w-5 h-5 rounded-full mx-auto"
            style={{ backgroundColor: '#FBBF24' }}
          />
        );
      case 'cannot_modify':
        return (
          <div
            className="w-5 h-5 rounded-full mx-auto"
            style={{ backgroundColor: '#EF4444' }}
          />
        );
    }
  };

  const groupedDishes = dishes.reduce((acc, dish) => {
    if (!acc[dish.category]) acc[dish.category] = [];
    acc[dish.category].push(dish);
    return acc;
  }, {} as Record<string, DishAllergenData[]>);

  if (!isOpen) return null;

  return (
    <>
      {/* Hidden print content rendered via portal to body */}
      {!loading && !error && dishes.length > 0 &&
        createPortal(
          <PrintContent
            dishes={dishes}
            restaurantName={restaurantName}
            groupedDishes={groupedDishes}
          />,
          document.body
        )
      }

      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-2xl z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Allergen Matrix Preview</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={loading || !!error}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-6">
          <div ref={printRef} className="max-w-[1200px] mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="ml-3 text-slate-600">Loading allergen data...</span>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {restaurantName} - Allergen Matrix
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>

                {/* Color Legend */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="text-lg">🔑</span> Color Legend
                  </h3>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                      <span className="text-sm text-slate-700">
                        <strong>Red</strong> = Contains allergen – CANNOT be modified
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#FBBF24' }} />
                      <span className="text-sm text-slate-700">
                        <strong>Yellow</strong> = Contains allergen – CAN be modified
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                      <span className="text-sm text-slate-700">
                        <strong>Green</strong> = Does NOT contain allergen
                      </span>
                    </div>
                  </div>
                </div>

                {/* Allergen Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 border border-slate-300 min-w-[180px]">
                          Dish Name
                        </th>
                        {ALLERGENS.map((allergen) => {
                          const Icon = AllergenIcons[allergen.key];
                          return (
                            <th
                              key={allergen.key}
                              className="py-3 px-2 text-center border border-slate-300 min-w-[70px]"
                            >
                              <div className="flex flex-col items-center gap-1">
                                {Icon && <Icon size={24} />}
                                <span className="text-xs font-medium text-slate-600">
                                  {allergen.label}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedDishes).map(([category, categoryDishes]) => (
                        <>
                          <tr key={`cat-${category}`} className="bg-slate-50">
                            <td
                              colSpan={ALLERGENS.length + 1}
                              className="py-2 px-4 font-bold text-slate-800 border border-slate-300"
                            >
                              {category}
                            </td>
                          </tr>
                          {categoryDishes.map((dish, idx) => (
                            <tr
                              key={dish.id}
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                            >
                              <td className="py-3 px-4 font-medium text-slate-800 border border-slate-300">
                                {dish.name}
                              </td>
                              {ALLERGENS.map((allergen) => (
                                <td
                                  key={`${dish.id}-${allergen.key}`}
                                  className="py-3 px-2 text-center border border-slate-300"
                                >
                                  {getStatusDot(dish.allergens[allergen.key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    This allergen matrix is provided for informational purposes. Please inform your server of any allergies before ordering.
                    Cross-contamination may occur during food preparation.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
