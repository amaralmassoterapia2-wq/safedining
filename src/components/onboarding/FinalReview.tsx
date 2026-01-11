import { useEffect, useState, useRef } from 'react';
import { supabase, Database, WeightUnit, formatAmount } from '../../lib/supabase';
import { CheckCircle2, Download, QrCode as QrCodeIcon, ExternalLink, ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { analyzeMenuItemAllergens, MenuItemAllergenAnalysis } from '../../lib/openai';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type MenuItemIngredient = Database['public']['Tables']['menu_item_ingredients']['Row'];
type Restaurant = Database['public']['Tables']['restaurants']['Row'];

interface IngredientWithAmount extends Ingredient {
  amount_value: number | null;
  amount_unit: WeightUnit | null;
}

interface MenuItemWithIngredients extends MenuItem {
  ingredients: IngredientWithAmount[];
  allergenAnalysis?: MenuItemAllergenAnalysis;
}

interface FinalReviewProps {
  restaurantId: string;
  onBack?: () => void;
}

export default function FinalReview({ restaurantId, onBack }: FinalReviewProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAllergens, setAnalyzingAllergens] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

            const ingredients: IngredientWithAmount[] = (menuItemIngredients || []).map((mii: any) => ({
              ...mii.ingredient,
              amount_value: mii.amount_value,
              amount_unit: mii.amount_unit,
            }));

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
      const menuUrl = `${window.location.origin}/?qr=${restaurant.qr_code}`;

      if (canvasRef.current) {
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
      }

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

  const handleDownloadQR = () => {
    if (!qrCodeUrl || !restaurant) return;

    const link = document.createElement('a');
    link.download = `${restaurant.name.replace(/\s+/g, '-')}-menu-qr.png`;
    link.href = qrCodeUrl;
    link.click();
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

                  {/* Allergen Information */}
                  <div className="flex flex-wrap gap-2">
                    {isAllergenFree && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        No common allergens detected
                      </span>
                    )}

                    {/* Direct allergens from ingredients */}
                    {hasDirectAllergens && analysis.directAllergens.map((allergen) => (
                      <span
                        key={`direct-${allergen}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full"
                      >
                        Contains: {allergen}
                      </span>
                    ))}

                    {/* Cross-contamination risks from preparation */}
                    {hasCrossContamination && analysis.crossContaminationRisks.map((risk, idx) => (
                      <span
                        key={`cross-${idx}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
                        title={risk.reason}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        May contain: {risk.allergen}
                      </span>
                    ))}
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
    </div>
  );
}
