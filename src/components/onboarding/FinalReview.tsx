import { useEffect, useState, useRef } from 'react';
import { supabase, Database, WeightUnit, formatAmount } from '../../lib/supabase';
import { CheckCircle2, Download, QrCode as QrCodeIcon, ExternalLink, ArrowLeft, AlertTriangle, Loader2, Plus, X, Edit3, ChevronDown, ChevronUp, Repeat, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { analyzeMenuItemAllergens, MenuItemAllergenAnalysis, COMMON_ALLERGENS } from '../../lib/openai';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type MenuItemIngredient = Database['public']['Tables']['menu_item_ingredients']['Row'];
type Restaurant = Database['public']['Tables']['restaurants']['Row'];

interface SubstituteIngredient {
  id: string;
  name: string;
  allergens: string[];
}

interface IngredientWithAmount extends Ingredient {
  amount_value: number | null;
  amount_unit: WeightUnit | null;
  is_removable: boolean;
  is_substitutable: boolean;
  substitutes: SubstituteIngredient[];
}

interface MenuItemWithIngredients extends MenuItem {
  ingredients: IngredientWithAmount[];
  allergenAnalysis?: MenuItemAllergenAnalysis;
}

interface FinalReviewProps {
  restaurantId: string;
  onBack?: () => void;
}

type AllergenSource = 'ingredient' | 'cross-contamination';

interface EditingAllergen {
  menuItemId: string;
  showAddModal: boolean;
}

export default function FinalReview({ restaurantId, onBack }: FinalReviewProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAllergens, setAnalyzingAllergens] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Allergen editing state
  const [editingAllergen, setEditingAllergen] = useState<EditingAllergen | null>(null);
  const [selectedAllergen, setSelectedAllergen] = useState<string>('');
  const [customAllergen, setCustomAllergen] = useState('');
  const [allergenSource, setAllergenSource] = useState<AllergenSource>('ingredient');
  const [crossContaminationReason, setCrossContaminationReason] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [restaurantId]);

  const loadData = async () => {
    try {
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();

      if (restaurantData) {
        setRestaurant(restaurantData);
      }

      // Load menu items
      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (items) {
        // Load ingredients for each item via junction table
        const itemsWithIngredients = await Promise.all(
          items.map(async (item) => {
            // Get menu_item_ingredients with ingredient details
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

            const ingredients: IngredientWithAmount[] = (menuItemIngredients || []).map((mii: any) => {
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
                amount_value: mii.amount_value,
                amount_unit: mii.amount_unit,
                is_removable: mii.is_removable || false,
                is_substitutable: mii.is_substitutable || false,
                substitutes: subs,
              };
            });

            return {
              ...item,
              ingredients,
            };
          })
        );

        setMenuItems(itemsWithIngredients);

        // Analyze allergens for each item (including preparation)
        setAnalyzingAllergens(true);
        const itemsWithAllergenAnalysis = await Promise.all(
          itemsWithIngredients.map(async (item) => {
            const analysis = await analyzeMenuItemAllergens(
              item.name,
              item.ingredients.map(ing => ({
                name: ing.name,
                allergens: ing.contains_allergens,
              })),
              item.preparation || ''
            );
            return {
              ...item,
              allergenAnalysis: analysis,
            };
          })
        );
        setMenuItems(itemsWithAllergenAnalysis);
        setAnalyzingAllergens(false);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!restaurant) return;

    try {
      await supabase
        .from('restaurants')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      setQrGenerated(true);
    } catch (err) {
      console.error('Error generating QR code:', err);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  // Generate QR code after the canvas is rendered
  useEffect(() => {
    const generateQRToCanvas = async () => {
      if (!qrGenerated || !restaurant || !canvasRef.current) return;

      try {
        const menuUrl = `${window.location.origin}/?qr=${restaurant.qr_code}`;

        await QRCode.toCanvas(canvasRef.current, menuUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
        });

        const dataUrl = canvasRef.current.toDataURL('image/png');
        setQrCodeUrl(dataUrl);
      } catch (err) {
        console.error('Error generating QR to canvas:', err);
      }
    };

    generateQRToCanvas();
  }, [qrGenerated, restaurant]);

  const handleDownloadQR = () => {
    if (!qrCodeUrl || !restaurant) return;

    const link = document.createElement('a');
    link.download = `${restaurant.name.replace(/\s+/g, '-')}-menu-qr.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const openAddAllergenModal = (menuItemId: string) => {
    setEditingAllergen({ menuItemId, showAddModal: true });
    setSelectedAllergen('');
    setCustomAllergen('');
    setAllergenSource('ingredient');
    setCrossContaminationReason('');
  };

  const closeAddAllergenModal = () => {
    setEditingAllergen(null);
    setSelectedAllergen('');
    setCustomAllergen('');
    setAllergenSource('ingredient');
    setCrossContaminationReason('');
  };

  const handleAddAllergen = () => {
    if (!editingAllergen) return;

    const allergenToAdd = selectedAllergen || customAllergen.trim();
    if (!allergenToAdd) return;

    // For cross-contamination, require a reason
    if (allergenSource === 'cross-contamination' && !crossContaminationReason.trim()) {
      alert('Please provide a reason for cross-contamination risk.');
      return;
    }

    setMenuItems(prev => prev.map(item => {
      if (item.id !== editingAllergen.menuItemId || !item.allergenAnalysis) return item;

      const analysis = { ...item.allergenAnalysis };

      if (allergenSource === 'ingredient') {
        // Add to direct allergens if not already present
        if (!analysis.directAllergens.includes(allergenToAdd)) {
          analysis.directAllergens = [...analysis.directAllergens, allergenToAdd];
        }
      } else {
        // Add to cross-contamination risks if not already present
        const exists = analysis.crossContaminationRisks.some(
          r => r.allergen.toLowerCase() === allergenToAdd.toLowerCase()
        );
        if (!exists) {
          analysis.crossContaminationRisks = [
            ...analysis.crossContaminationRisks,
            { allergen: allergenToAdd, reason: crossContaminationReason.trim() }
          ];
        }
      }

      // Update allAllergens
      analysis.allAllergens = [
        ...new Set([
          ...analysis.directAllergens,
          ...analysis.crossContaminationRisks.map(r => r.allergen)
        ])
      ];

      return { ...item, allergenAnalysis: analysis };
    }));

    closeAddAllergenModal();
  };

  const handleRemoveDirectAllergen = (menuItemId: string, allergen: string) => {
    setMenuItems(prev => prev.map(item => {
      if (item.id !== menuItemId || !item.allergenAnalysis) return item;

      const analysis = { ...item.allergenAnalysis };
      analysis.directAllergens = analysis.directAllergens.filter(a => a !== allergen);
      analysis.allAllergens = [
        ...new Set([
          ...analysis.directAllergens,
          ...analysis.crossContaminationRisks.map(r => r.allergen)
        ])
      ];

      return { ...item, allergenAnalysis: analysis };
    }));
  };

  const handleRemoveCrossContamination = (menuItemId: string, allergen: string) => {
    setMenuItems(prev => prev.map(item => {
      if (item.id !== menuItemId || !item.allergenAnalysis) return item;

      const analysis = { ...item.allergenAnalysis };
      analysis.crossContaminationRisks = analysis.crossContaminationRisks.filter(
        r => r.allergen !== allergen
      );
      analysis.allAllergens = [
        ...new Set([
          ...analysis.directAllergens,
          ...analysis.crossContaminationRisks.map(r => r.allergen)
        ])
      ];

      return { ...item, allergenAnalysis: analysis };
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading menu...
        </div>
      </div>
    );
  }

  const menuUrl = restaurant ? `${window.location.origin}/?qr=${restaurant.qr_code}` : '';

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {onBack && !qrGenerated && (
            <button
              onClick={onBack}
              className="text-slate-600 hover:text-slate-900 mb-6 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Edit Dishes
            </button>
          )}

          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Review Your Menu
          </h1>
          <p className="text-slate-600 mb-8">
            Verify all dishes and allergen information before publishing
          </p>

          {analyzingAllergens && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800">Analyzing allergens and cross-contamination risks...</span>
            </div>
          )}

          <div className="space-y-4 mb-8">
            {menuItems.map((item) => {
              const analysis = item.allergenAnalysis;
              const hasDirectAllergens = analysis && analysis.directAllergens.length > 0;
              const hasCrossContamination = analysis && analysis.crossContaminationRisks.length > 0;
              const isAllergenFree = analysis && analysis.allAllergens.length === 0;
              const isExpanded = expandedItems.has(item.id);

              return (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="font-medium">{item.category}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-900">
                          ${Number(item.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {item.photo_url && (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                  </div>

                  {/* Ingredients List */}
                  {item.ingredients.length > 0 && (
                    <div className="mb-3 text-sm text-slate-600">
                      <span className="font-medium">Ingredients: </span>
                      {item.ingredients.map((ing, idx) => {
                        const displayAmount = formatAmount(ing.amount_value, ing.amount_unit);
                        return (
                          <span key={ing.id}>
                            {ing.name}{displayAmount ? ` (${displayAmount})` : ''}
                            {idx < item.ingredients.length - 1 ? ', ' : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Modification Options */}
                  {(() => {
                    const removableIngredients = item.ingredients.filter(ing => ing.is_removable);
                    const substitutableIngredients = item.ingredients.filter(ing => ing.is_substitutable);

                    if (removableIngredients.length === 0 && substitutableIngredients.length === 0) {
                      return null;
                    }

                    return (
                      <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-sm font-medium text-slate-700 block mb-2">Modification Options:</span>

                        {removableIngredients.length > 0 && (
                          <div className="mb-2">
                            <span className="text-xs text-green-700 font-medium flex items-center gap-1 mb-1">
                              <Trash2 className="w-3 h-3" />
                              Can be removed:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {removableIngredients.map((ing) => (
                                <span
                                  key={ing.id}
                                  className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full"
                                >
                                  {ing.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {substitutableIngredients.length > 0 && (
                          <div>
                            <span className="text-xs text-purple-700 font-medium flex items-center gap-1 mb-1">
                              <Repeat className="w-3 h-3" />
                              Can be substituted:
                            </span>
                            <div className="space-y-1.5">
                              {substitutableIngredients.map((ing) => (
                                <div key={ing.id} className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                                    {ing.name}
                                  </span>
                                  {ing.substitutes.length > 0 && (
                                    <>
                                      <span className="text-xs text-slate-400">→</span>
                                      {ing.substitutes.map((sub, subIdx) => (
                                        <span
                                          key={sub.id}
                                          className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full"
                                          title={sub.allergens.length > 0 ? `Contains: ${sub.allergens.join(', ')}` : 'No allergens'}
                                        >
                                          {sub.name}
                                          {sub.allergens.length > 0 && (
                                            <AlertTriangle className="w-2.5 h-2.5 inline ml-1 text-amber-500" />
                                          )}
                                        </span>
                                      ))}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Preparation Instructions */}
                  {item.preparation && (
                    <div className="mb-3">
                      <button
                        onClick={() => toggleItemExpanded(item.id)}
                        className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        Preparation Instructions
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                          {item.preparation}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Allergen Information with Edit Controls */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Allergens</span>
                      <button
                        onClick={() => openAddAllergenModal(item.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Allergen
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isAllergenFree && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          No common allergens detected
                        </span>
                      )}

                      {/* Direct allergens from ingredients - with delete button */}
                      {hasDirectAllergens && analysis.directAllergens.map((allergen) => (
                        <span
                          key={`direct-${allergen}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full group"
                        >
                          Contains: {allergen}
                          <button
                            onClick={() => handleRemoveDirectAllergen(item.id, allergen)}
                            className="ml-1 p-0.5 hover:bg-red-200 rounded-full transition-colors"
                            title="Remove allergen"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      {/* Cross-contamination risks from preparation - with delete button */}
                      {hasCrossContamination && analysis.crossContaminationRisks.map((risk, idx) => (
                        <span
                          key={`cross-${idx}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full group"
                          title={risk.reason}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          May contain: {risk.allergen}
                          <button
                            onClick={() => handleRemoveCrossContamination(item.id, risk.allergen)}
                            className="ml-1 p-0.5 hover:bg-amber-200 rounded-full transition-colors"
                            title="Remove cross-contamination risk"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Safety Notes */}
                  {analysis && analysis.safetyNotes.length > 0 && (
                    <div className="mt-3 text-xs text-slate-500 italic">
                      {analysis.safetyNotes.map((note, idx) => (
                        <p key={idx}>{note}</p>
                      ))}
                    </div>
                  )}

                  {/* Cross-contamination details (expandable) */}
                  {hasCrossContamination && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                      <p className="text-xs font-semibold text-amber-900 mb-1">Cross-contamination details:</p>
                      <ul className="text-xs text-amber-800 space-y-1">
                        {analysis.crossContaminationRisks.map((risk, idx) => (
                          <li key={idx}>• <strong>{risk.allergen}:</strong> {risk.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!qrGenerated ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-3">Ready to publish?</h3>
              <p className="text-sm text-slate-700 mb-4">
                Once you generate your QR code, customers will be able to scan it and access your
                menu with allergen information. You can always edit menu items later from your
                dashboard.
              </p>
              <button
                onClick={handleGenerateQR}
                disabled={analyzingAllergens}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <QrCodeIcon className="w-6 h-6" />
                Generate My QR Code & Publish Menu
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8">
              <div className="flex items-start gap-4 mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="text-2xl font-bold text-green-900 mb-2">
                    Your Menu is Live!
                  </h3>
                  <p className="text-green-800">
                    Customers can now scan this QR code to view your menu with allergen information.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 text-center">
                  <canvas ref={canvasRef} className="mx-auto mb-4" />
                  <button
                    onClick={handleDownloadQR}
                    className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download QR Code
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-6">
                    <h4 className="font-semibold text-slate-900 mb-3">Next Steps:</h4>
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">1.</span>
                        <span>Print the QR code and place it on tables</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">2.</span>
                        <span>Add it to your physical menus</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">3.</span>
                        <span>Train staff on the new system</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">4.</span>
                        <span>Keep menu information up-to-date</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white rounded-xl p-6">
                    <h4 className="font-semibold text-slate-900 mb-2">Menu URL:</h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={menuUrl}
                        readOnly
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => window.open(menuUrl, '_blank')}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Open menu"
                      >
                        <ExternalLink className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <a
                    href="/admin"
                    className="block w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-all text-center"
                  >
                    Go to Dashboard
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Allergen Modal */}
      {editingAllergen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add Allergen</h3>
              <button
                onClick={closeAddAllergenModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Source Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Allergen Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAllergenSource('ingredient')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    allergenSource === 'ingredient'
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-900 text-sm">From Ingredients</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Allergen is directly in the dish
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAllergenSource('cross-contamination')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    allergenSource === 'cross-contamination'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-900 text-sm">Cross-Contamination</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Risk from preparation/equipment
                  </div>
                </button>
              </div>
            </div>

            {/* Allergen Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Allergen
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_ALLERGENS.map((allergen) => (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => {
                      setSelectedAllergen(allergen);
                      setCustomAllergen('');
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      selectedAllergen === allergen
                        ? allergenSource === 'ingredient'
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {allergen}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={customAllergen}
                  onChange={(e) => {
                    setCustomAllergen(e.target.value);
                    setSelectedAllergen('');
                  }}
                  placeholder="Or type a custom allergen..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            {/* Cross-contamination reason (only if source is cross-contamination) */}
            {allergenSource === 'cross-contamination' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Reason for Cross-Contamination Risk *
                </label>
                <textarea
                  value={crossContaminationReason}
                  onChange={(e) => setCrossContaminationReason(e.target.value)}
                  placeholder="e.g., Shared fryer with shrimp, prepared on the same surface as nuts..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeAddAllergenModal}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAllergen}
                disabled={!selectedAllergen && !customAllergen.trim()}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  allergenSource === 'ingredient'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                Add {allergenSource === 'ingredient' ? 'Contains' : 'May Contain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
