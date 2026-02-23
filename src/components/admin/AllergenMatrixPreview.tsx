import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Dietary categories matching the Accessibility Dashboard
const CATEGORIES = [
  { key: 'shellfish', label: 'Shellfish', type: 'allergen' as const, allergenAliases: ['shellfish', 'crustacean', 'shrimp', 'crab', 'lobster', 'crayfish', 'langoustine', 'prawn'] },
  { key: 'nuts', label: 'Nuts', type: 'allergen' as const, allergenAliases: ['tree nut', 'tree nuts', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'brazil nut', 'pine nut'] },
  { key: 'peanuts', label: 'Peanuts', type: 'allergen' as const, allergenAliases: ['peanut', 'peanuts'] },
  { key: 'dairy', label: 'Dairy', type: 'allergen' as const, allergenAliases: ['dairy', 'lactose', 'milk', 'cream', 'butter', 'cheese', 'whey', 'casein'] },
  { key: 'gluten', label: 'Gluten', type: 'allergen' as const, allergenAliases: ['gluten', 'wheat', 'barley', 'rye', 'oat'] },
  { key: 'eggs', label: 'Eggs', type: 'allergen' as const, allergenAliases: ['egg', 'eggs'] },
  { key: 'soy', label: 'Soy', type: 'allergen' as const, allergenAliases: ['soy', 'soybean', 'soya', 'tofu', 'edamame'] },
  { key: 'fish', label: 'Fish', type: 'allergen' as const, allergenAliases: ['fish', 'salmon', 'tuna', 'cod', 'halibut', 'anchovy', 'sardine', 'trout', 'tilapia'] },
  { key: 'sesame', label: 'Sesame', type: 'allergen' as const, allergenAliases: ['sesame', 'tahini'] },
  { key: 'vegetarian', label: 'Vegetarian', type: 'dietary-style' as const },
  { key: 'vegan', label: 'Vegan', type: 'dietary-style' as const },
  { key: 'pescatarian', label: 'Pescatarian', type: 'dietary-style' as const },
  { key: 'kosher', label: 'Kosher', type: 'dietary-style' as const },
  { key: 'halal', label: 'Halal', type: 'dietary-style' as const },
  { key: 'low-carb', label: 'Low-Carb', type: 'health-focused' as const },
  { key: 'low-sodium', label: 'Low-Sodium', type: 'health-focused' as const },
];

// Keyword lists for dietary-style ingredient detection
const MEAT_KEYWORDS = ['beef', 'steak', 'lamb', 'pork', 'bacon', 'ham', 'sausage', 'salami', 'pepperoni', 'prosciutto', 'chicken', 'turkey', 'duck', 'veal', 'venison', 'bison', 'rabbit', 'goat', 'meat', 'chorizo', 'pancetta'];
const FISH_KEYWORDS = ['fish', 'salmon', 'tuna', 'cod', 'halibut', 'anchovy', 'sardine', 'mackerel', 'bass', 'trout', 'tilapia', 'swordfish', 'mahi'];
const SEAFOOD_KEYWORDS = [...FISH_KEYWORDS, 'shrimp', 'crab', 'lobster', 'crayfish', 'prawn', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus'];
const DAIRY_ING_KEYWORDS = ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'whey', 'casein', 'ghee'];
const EGG_ING_KEYWORDS = ['egg', 'eggs', 'mayonnaise', 'mayo', 'aioli'];
const PORK_KEYWORDS = ['pork', 'bacon', 'ham', 'salami', 'pepperoni', 'prosciutto', 'lard', 'pancetta', 'chorizo'];
const ALCOHOL_KEYWORDS = ['wine', 'beer', 'rum', 'vodka', 'whiskey', 'bourbon', 'brandy', 'liqueur', 'alcohol', 'sake', 'mirin'];
const GELATIN_KEYWORDS = ['gelatin', 'gelatine'];

function ingredientMatchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

// Category icons as SVG components
const CategoryIcons: Record<string, React.FC<{ size?: number }>> = {
  'shellfish': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 4c-3 0-6 2-7 5l-1 4 3 4c1 2 3 3 5 3s4-1 5-3l3-4-1-4c-1-3-4-5-7-5z" fill="#FFEBEE" stroke="#C62828" strokeWidth="1.5"/>
      <path d="M8 10c0 2 2 4 4 4s4-2 4-4" stroke="#C62828" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 8l-2-3M18 8l2-3" stroke="#C62828" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'nuts': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="13" rx="5" ry="6" fill="#EFEBE9" stroke="#5D4037" strokeWidth="1.5"/>
      <path d="M12 7c-1-2-1-4 0-5 1 1 1 3 0 5z" fill="#8D6E63" stroke="#5D4037" strokeWidth="1"/>
      <path d="M10 10c0 1 1 2 2 2s2-1 2-2" stroke="#5D4037" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  'peanuts': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="9" cy="10" rx="4" ry="5" fill="#FFF3E0" stroke="#E65100" strokeWidth="1.5"/>
      <ellipse cx="15" cy="14" rx="4" ry="5" fill="#FFF3E0" stroke="#E65100" strokeWidth="1.5"/>
      <path d="M11 12c1 0 2 1 2 2" stroke="#E65100" strokeWidth="1.5"/>
    </svg>
  ),
  'dairy': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 2h8l1 4H7l1-4z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
      <path d="M7 6h10v2c0 1-1 2-2 2H9c-1 0-2-1-2-2V6z" fill="#BBDEFB" stroke="#1565C0" strokeWidth="1.5"/>
      <path d="M9 10h6v10c0 1-1 2-2 2h-2c-1 0-2-1-2-2V10z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
    </svg>
  ),
  'gluten': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22V10" stroke="#8D6E63" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 10c-3-1-5-4-5-7 0 3 2 6 5 7z" fill="#D7CCC8" stroke="#8D6E63" strokeWidth="1.5"/>
      <path d="M12 10c3-1 5-4 5-7 0 3-2 6-5 7z" fill="#D7CCC8" stroke="#8D6E63" strokeWidth="1.5"/>
      <path d="M12 14c-2-1-4-3-4-5 0 2 2 4 4 5z" fill="#D7CCC8" stroke="#8D6E63" strokeWidth="1.5"/>
      <path d="M12 14c2-1 4-3 4-5 0 2-2 4-4 5z" fill="#D7CCC8" stroke="#8D6E63" strokeWidth="1.5"/>
    </svg>
  ),
  'eggs': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="14" rx="6" ry="7" fill="#FFF8E1" stroke="#F57C00" strokeWidth="1.5"/>
      <ellipse cx="12" cy="14" rx="3" ry="3.5" fill="#FFD54F"/>
    </svg>
  ),
  'soy': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="8" cy="12" rx="3" ry="4" fill="#C5E1A5" stroke="#33691E" strokeWidth="1.5"/>
      <ellipse cx="14" cy="10" rx="3" ry="4" fill="#C5E1A5" stroke="#33691E" strokeWidth="1.5"/>
      <ellipse cx="14" cy="16" rx="3" ry="4" fill="#C5E1A5" stroke="#33691E" strokeWidth="1.5"/>
      <path d="M6 6c2 0 3 2 3 4M16 4c0 2 1 3 2 4" stroke="#33691E" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'fish': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12c3-4 7-5 11-5 2 0 4 1 6 2l3 3-3 3c-2 1-4 2-6 2-4 0-8-1-11-5z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
      <circle cx="17" cy="12" r="1.5" fill="#1565C0"/>
      <path d="M7 9c1 1.5 1 4.5 0 6" stroke="#1565C0" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'sesame': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="12" rx="3" ry="5" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="7" cy="10" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="17" cy="10" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="8" cy="16" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
      <ellipse cx="16" cy="16" rx="2" ry="3" fill="#FFF8E1" stroke="#FF8F00" strokeWidth="1.5"/>
    </svg>
  ),
  'vegetarian': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22c0-6 4-12 9-14-2 0-5 1-7 3 0-3-1-6-2-8-1 2-2 5-2 8-2-2-5-3-7-3 5 2 9 8 9 14z" fill="#C8E6C9" stroke="#2E7D32" strokeWidth="1.5"/>
    </svg>
  ),
  'vegan': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22c0-6 4-12 9-14-2 0-5 1-7 3 0-3-1-6-2-8-1 2-2 5-2 8-2-2-5-3-7-3 5 2 9 8 9 14z" fill="#A5D6A7" stroke="#1B5E20" strokeWidth="1.5"/>
      <circle cx="12" cy="14" r="3" fill="#1B5E20" opacity="0.3"/>
    </svg>
  ),
  'pescatarian': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M1 12c2-3 5-4 8-4 2 0 3 1 5 2l2 2-2 2c-2 1-3 2-5 2-3 0-6-1-8-4z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5"/>
      <circle cx="13" cy="12" r="1" fill="#1565C0"/>
      <path d="M18 6c-1 2-1 4 0 6" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 4c-2 2-3 5-2 8" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M22 5c-2 1-4 4-4 7" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'kosher': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.5 7h7.5l-6 4.5 2.3 7L12 16l-6.3 4.5 2.3-7-6-4.5h7.5z" fill="#E3F2FD" stroke="#1565C0" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  'halal': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 4c-4 0-8 4-8 9s4 9 8 9c-6 0-11-4-11-9s5-9 11-9z" fill="#E8F5E9" stroke="#2E7D32" strokeWidth="1.5"/>
      <circle cx="17" cy="7" r="2" fill="#E8F5E9" stroke="#2E7D32" strokeWidth="1.5"/>
    </svg>
  ),
  'low-carb': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 16h16v4H4z" fill="#FFF3E0" stroke="#E65100" strokeWidth="1.5" rx="1"/>
      <path d="M6 12h12v4H6z" fill="#FFE0B2" stroke="#E65100" strokeWidth="1.5" rx="1"/>
      <path d="M4 4l16 16" stroke="#E65100" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  'low-sodium': ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 3h6v4l2 2v10c0 1-1 2-2 2H9c-1 0-2-1-2-2V9l2-2V3z" fill="#F5F5F5" stroke="#757575" strokeWidth="1.5"/>
      <circle cx="11" cy="15" r="1" fill="#757575"/>
      <circle cx="14" cy="13" r="1" fill="#757575"/>
      <circle cx="12" cy="17" r="1" fill="#757575"/>
      <path d="M4 4l16 16" stroke="#757575" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

type CategoryStatus = 'compatible' | 'can_modify' | 'not_compatible';

interface DishCategoryData {
  id: string;
  name: string;
  category: string;
  statuses: Record<string, CategoryStatus>;
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
  dishes: DishCategoryData[];
  restaurantName: string;
  groupedDishes: Record<string, DishCategoryData[]>;
}) {
  const getStatusDot = (status: CategoryStatus) => {
    const colors = {
      compatible: '#10B981',
      can_modify: '#FBBF24',
      not_compatible: '#EF4444',
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
        padding: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
          {restaurantName} - Dietary Compatibility Matrix
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
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              <strong>Green</strong> = Not present / Compatible
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#FBBF24' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              <strong>Yellow</strong> = Present but can be modified
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ fontSize: '12px', color: '#475569' }}>
              <strong>Red</strong> = Present, no modifications possible
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '9px',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '6px',
                border: '1px solid #cbd5e1',
                fontWeight: '600',
                color: '#475569',
                width: '120px',
              }}
            >
              Dish Name
            </th>
            {CATEGORIES.map((cat) => (
              <th
                key={cat.key}
                style={{
                  padding: '4px 2px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#475569',
                  fontSize: '7px',
                  lineHeight: '1.2',
                  wordBreak: 'break-word',
                }}
              >
                {cat.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedDishes).map(([category, categoryDishes]) => (
            <>
              <tr key={`cat-${category}`} style={{ backgroundColor: '#f8fafc' }}>
                <td
                  colSpan={CATEGORIES.length + 1}
                  style={{
                    padding: '4px 6px',
                    border: '1px solid #cbd5e1',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    fontSize: '10px',
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
                      padding: '4px 6px',
                      border: '1px solid #cbd5e1',
                      fontWeight: '500',
                      color: '#1e293b',
                      fontSize: '9px',
                    }}
                  >
                    {dish.name}
                  </td>
                  {CATEGORIES.map((cat) => (
                    <td
                      key={`${dish.id}-${cat.key}`}
                      style={{
                        padding: '3px',
                        border: '1px solid #cbd5e1',
                        textAlign: 'center',
                      }}
                    >
                      {getStatusDot(dish.statuses[cat.key])}
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
          This dietary compatibility matrix is provided for informational purposes. Please inform your server of any allergies or dietary needs before ordering.
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
  const [dishes, setDishes] = useState<DishCategoryData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategoryData();
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, restaurantId]);

  const loadCategoryData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('category')
        .order('created_at');

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) {
        setError('No menu items found');
        setLoading(false);
        return;
      }

      const dishData: DishCategoryData[] = await Promise.all(
        items.map(async (item) => {
          // Fetch ingredients
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*, ingredient:ingredients(*)')
            .eq('menu_item_id', item.id);

          // Fetch cooking steps for cross-contact risks (including modifiability)
          const { data: cookingSteps } = await supabase
            .from('cooking_steps')
            .select('cross_contact_risk, is_modifiable, modifiable_allergens')
            .eq('menu_item_id', item.id);

          const ingredients = (menuItemIngredients || []).map((mii: any) => ({
            name: mii.ingredient?.name || '',
            allergens: mii.ingredient?.contains_allergens || [],
            isRemovable: mii.is_removable || false,
            isSubstitutable: mii.is_substitutable || false,
          }));

          const crossContactRisks: string[] = [];
          const modifiableCrossContactRisks: string[] = [];
          for (const step of cookingSteps || []) {
            for (const risk of step.cross_contact_risk || []) {
              if (step.is_modifiable) {
                // If the step is modifiable, check if this specific allergen is in modifiable_allergens
                const modifiableAllergens = step.modifiable_allergens || [];
                if (modifiableAllergens.length === 0 || modifiableAllergens.some((ma: string) => ma.toLowerCase() === risk.toLowerCase())) {
                  modifiableCrossContactRisks.push(risk);
                } else {
                  crossContactRisks.push(risk);
                }
              } else {
                crossContactRisks.push(risk);
              }
            }
          }

          const statuses: Record<string, CategoryStatus> = {};

          for (const cat of CATEGORIES) {
            if (cat.type === 'allergen') {
              // Check allergen aliases against ingredients, description allergens, and cross-contact risks
              statuses[cat.key] = computeAllergenFreeStatus(
                cat.allergenAliases!,
                item.description_allergens || [],
                ingredients,
                crossContactRisks,
                modifiableCrossContactRisks
              );
            } else if (cat.type === 'dietary-style') {
              statuses[cat.key] = computeDietaryStyleStatus(
                cat.key,
                ingredients,
                item.description_allergens || [],
                crossContactRisks,
                modifiableCrossContactRisks
              );
            } else if (cat.type === 'health-focused') {
              statuses[cat.key] = computeHealthFocusedStatus(cat.key, item);
            }
          }

          return {
            id: item.id,
            name: item.name,
            category: item.category || 'Other',
            statuses,
          };
        })
      );

      setDishes(dishData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const printContent = document.getElementById('allergen-print-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1600,height=900');
    if (!printWindow) {
      alert('Please allow popups to download PDF');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${restaurantName} - Dietary Compatibility Matrix</title>
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            @page {
              size: landscape;
              margin: 0.3in;
            }
            body {
              margin: 0;
              padding: 12px;
              font-family: system-ui, -apple-system, sans-serif;
            }
            table { width: 100%; table-layout: fixed; }
            th, td { overflow: hidden; text-overflow: ellipsis; }
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

  const getStatusDot = (status: CategoryStatus) => {
    switch (status) {
      case 'compatible':
        return (
          <div
            className="w-4 h-4 rounded-full mx-auto"
            style={{ backgroundColor: '#10B981' }}
          />
        );
      case 'can_modify':
        return (
          <div
            className="w-4 h-4 rounded-full mx-auto"
            style={{ backgroundColor: '#FBBF24' }}
          />
        );
      case 'not_compatible':
        return (
          <div
            className="w-4 h-4 rounded-full mx-auto"
            style={{ backgroundColor: '#EF4444' }}
          />
        );
    }
  };

  const groupedDishes = dishes.reduce((acc, dish) => {
    if (!acc[dish.category]) acc[dish.category] = [];
    acc[dish.category].push(dish);
    return acc;
  }, {} as Record<string, DishCategoryData[]>);

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
      <div className="fixed inset-2 md:inset-4 lg:inset-6 bg-white rounded-2xl z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Dietary Compatibility Matrix</h2>
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
          <div ref={printRef} className="mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="ml-3 text-slate-600">Loading dietary data...</span>
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
                    {restaurantName} - Dietary Compatibility Matrix
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
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                      <span className="text-sm text-slate-700">
                        <strong>Green</strong> = Not present / Compatible
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#FBBF24' }} />
                      <span className="text-sm text-slate-700">
                        <strong>Yellow</strong> = Present but can be modified
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                      <span className="text-sm text-slate-700">
                        <strong>Red</strong> = Present, no modifications possible
                      </span>
                    </div>
                  </div>
                </div>

                {/* Matrix Table */}
                <div>
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left py-3 px-3 font-semibold text-slate-700 border border-slate-300" style={{ width: '140px' }}>
                          Dish Name
                        </th>
                        {CATEGORIES.map((cat) => {
                          const Icon = CategoryIcons[cat.key];
                          return (
                            <th
                              key={cat.key}
                              className="py-2 px-1 text-center border border-slate-300"
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                {Icon && <Icon size={20} />}
                                <span className="text-[10px] font-medium text-slate-600 leading-tight">
                                  {cat.label}
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
                              colSpan={CATEGORIES.length + 1}
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
                              <td className="py-2 px-3 font-medium text-slate-800 border border-slate-300 text-sm truncate">
                                {dish.name}
                              </td>
                              {CATEGORIES.map((cat) => (
                                <td
                                  key={`${dish.id}-${cat.key}`}
                                  className="py-2 px-1 text-center border border-slate-300"
                                >
                                  {getStatusDot(dish.statuses[cat.key])}
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
                    This dietary compatibility matrix is provided for informational purposes. Please inform your server of any allergies or dietary needs before ordering.
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

// --- Status computation helpers ---

interface IngredientInfo {
  name: string;
  allergens: string[];
  isRemovable: boolean;
  isSubstitutable: boolean;
}

function computeAllergenFreeStatus(
  allergenAliases: string[],
  descriptionAllergens: string[],
  ingredients: IngredientInfo[],
  crossContactRisks: string[],
  modifiableCrossContactRisks: string[] = []
): CategoryStatus {
  let hasBlocker = false;
  let hasModifiable = false;

  // 1. Description allergens (cannot be modified)
  for (const descAllergen of descriptionAllergens) {
    const lower = descAllergen.toLowerCase();
    if (allergenAliases.some(alias => lower.includes(alias))) {
      hasBlocker = true;
    }
  }

  // 2. Non-modifiable cross-contact risks (cannot be modified)
  for (const risk of crossContactRisks) {
    const lower = risk.toLowerCase();
    if (allergenAliases.some(alias => lower.includes(alias))) {
      hasBlocker = true;
    }
  }

  // 3. Modifiable cross-contact risks (can be adjusted by kitchen)
  for (const risk of modifiableCrossContactRisks) {
    const lower = risk.toLowerCase();
    if (allergenAliases.some(alias => lower.includes(alias))) {
      hasModifiable = true;
    }
  }

  // 4. Ingredient allergens
  for (const ing of ingredients) {
    for (const ingAllergen of ing.allergens) {
      const lower = ingAllergen.toLowerCase();
      if (allergenAliases.some(alias => lower.includes(alias))) {
        if (ing.isRemovable || ing.isSubstitutable) {
          hasModifiable = true;
        } else {
          hasBlocker = true;
        }
      }
    }
    // Also check ingredient name against allergen aliases
    const ingNameLower = ing.name.toLowerCase();
    if (allergenAliases.some(alias => ingNameLower.includes(alias))) {
      if (ing.isRemovable || ing.isSubstitutable) {
        hasModifiable = true;
      } else {
        hasBlocker = true;
      }
    }
  }

  if (hasBlocker) return 'not_compatible';
  if (hasModifiable) return 'can_modify';
  return 'compatible';
}

// Map dietary-style categories to description allergen tags that indicate non-compliance
// These are the AI-tagged allergen names (e.g. "Fish", "Shellfish", "Milk") from description_allergens
const DIETARY_STYLE_BLOCKER_ALLERGENS: Record<string, string[]> = {
  vegetarian: ['fish', 'shellfish', 'mollusks'],
  vegan: ['fish', 'shellfish', 'mollusks', 'milk', 'eggs', 'dairy'],
  pescatarian: [], // meat/poultry aren't standard allergen tags
  kosher: ['shellfish', 'mollusks'],
  halal: [], // pork/alcohol aren't standard allergen tags
};

function computeDietaryStyleStatus(
  categoryKey: string,
  ingredients: IngredientInfo[],
  descriptionAllergens: string[],
  crossContactRisks: string[],
  modifiableCrossContactRisks: string[] = []
): CategoryStatus {
  let hasBlocker = false;
  let hasModifiable = false;

  // 1. Check ingredient names against dietary keyword lists
  const checkIngredients = (keywords: string[]) => {
    for (const ing of ingredients) {
      if (ingredientMatchesAny(ing.name, keywords)) {
        if (ing.isRemovable || ing.isSubstitutable) {
          hasModifiable = true;
        } else {
          hasBlocker = true;
        }
      }
    }
  };

  // 2. Check ingredient allergen tags (e.g. ingredient tagged with "Fish" allergen)
  const checkIngredientAllergenTags = (blockerTags: string[]) => {
    for (const ing of ingredients) {
      for (const allergen of ing.allergens) {
        const lower = allergen.toLowerCase();
        if (blockerTags.some(tag => lower.includes(tag))) {
          if (ing.isRemovable || ing.isSubstitutable) {
            hasModifiable = true;
          } else {
            hasBlocker = true;
          }
        }
      }
    }
  };

  // 3. Check description allergens (cannot be modified — they come from the dish description itself)
  const blockerAllergens = DIETARY_STYLE_BLOCKER_ALLERGENS[categoryKey] || [];
  for (const descAllergen of descriptionAllergens) {
    const lower = descAllergen.toLowerCase();
    if (blockerAllergens.some(tag => lower.includes(tag))) {
      hasBlocker = true;
    }
  }

  // 4. Check non-modifiable cooking step cross-contact risks
  for (const risk of crossContactRisks) {
    const lower = risk.toLowerCase();
    if (blockerAllergens.some(tag => lower.includes(tag))) {
      hasBlocker = true;
    }
  }

  // 5. Check modifiable cooking step cross-contact risks
  for (const risk of modifiableCrossContactRisks) {
    const lower = risk.toLowerCase();
    if (blockerAllergens.some(tag => lower.includes(tag))) {
      hasModifiable = true;
    }
  }

  // 6. Check ingredient names and allergen tags per dietary style
  switch (categoryKey) {
    case 'vegetarian':
      // No meat, fish, seafood, or gelatin
      checkIngredients([...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS, ...GELATIN_KEYWORDS]);
      checkIngredientAllergenTags(['fish', 'shellfish', 'mollusks']);
      break;
    case 'vegan':
      // No animal products at all
      checkIngredients([
        ...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS, ...DAIRY_ING_KEYWORDS,
        ...EGG_ING_KEYWORDS, ...GELATIN_KEYWORDS, 'honey',
      ]);
      checkIngredientAllergenTags(['fish', 'shellfish', 'mollusks', 'milk', 'eggs', 'dairy']);
      break;
    case 'pescatarian':
      // No meat or poultry (fish/seafood OK)
      checkIngredients(MEAT_KEYWORDS.filter(kw =>
        !FISH_KEYWORDS.includes(kw) && !SEAFOOD_KEYWORDS.includes(kw)
      ));
      checkIngredients(GELATIN_KEYWORDS);
      break;
    case 'kosher':
      // No pork, shellfish
      checkIngredients(PORK_KEYWORDS);
      checkIngredients(['shrimp', 'crab', 'lobster', 'crayfish', 'prawn', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus']);
      checkIngredientAllergenTags(['shellfish', 'mollusks']);
      break;
    case 'halal':
      // No pork, alcohol
      checkIngredients(PORK_KEYWORDS);
      checkIngredients(ALCOHOL_KEYWORDS);
      break;
  }

  if (hasBlocker) return 'not_compatible';
  if (hasModifiable) return 'can_modify';
  return 'compatible';
}

function computeHealthFocusedStatus(
  categoryKey: string,
  item: any
): CategoryStatus {
  switch (categoryKey) {
    case 'low-carb':
      if (item.carbs_g != null && item.carbs_g < 20) return 'compatible';
      if (item.carbs_g != null) return 'not_compatible';
      // No nutrition data — cannot determine
      return 'not_compatible';
    case 'low-sodium':
      if (item.sodium_mg != null && item.sodium_mg < 600) return 'compatible';
      if (item.sodium_mg != null) return 'not_compatible';
      return 'not_compatible';
    default:
      return 'not_compatible';
  }
}
