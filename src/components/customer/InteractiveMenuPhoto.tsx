import { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, CheckCircle, AlertCircle, XCircle, Shield } from 'lucide-react';
import { analyzeMenuPhoto, fuzzyMatchScore, findBestMatch, DetectedMenuItem } from '../../lib/openai';
import { analyzeDishSafety } from '../../lib/safetyAnalysis';
import { supabase, Database } from '../../lib/supabase';
import BottomSheet from '../common/BottomSheet';
import DishDetail from './DishDetail';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Ingredient = Database['public']['Tables']['ingredients']['Row'];
type CookingStep = Database['public']['Tables']['cooking_steps']['Row'];

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

interface MatchedItem {
  detected: DetectedMenuItem;
  dbDish: MenuItemWithData | null;
  matchScore: number;
  safetyStatus: 'safe' | 'safe-with-modifications' | 'unsafe' | 'unknown';
}

interface InteractiveMenuPhotoProps {
  restaurantId: string;
  customerAllergens: string[];
  onClose: () => void;
  embedded?: boolean; // If true, renders inline instead of as a modal
}

export default function InteractiveMenuPhoto({
  restaurantId,
  customerAllergens,
  onClose,
  embedded = false,
}: InteractiveMenuPhotoProps) {
  const [step, setStep] = useState<'capture' | 'analyzing' | 'result'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [dbDishes, setDbDishes] = useState<MenuItemWithData[]>([]);
  const [selectedDish, setSelectedDish] = useState<MenuItemWithData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  // Load all menu items from database
  useEffect(() => {
    loadMenuItems();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [restaurantId]);

  const loadMenuItems = async () => {
    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);

    if (items) {
      const itemsWithData = await Promise.all(
        items.map(async (item) => {
          const { data: menuItemIngredients } = await supabase
            .from('menu_item_ingredients')
            .select('*, ingredient:ingredients(*)')
            .eq('menu_item_id', item.id);

          const miiIds = (menuItemIngredients || []).map((mii: any) => mii.id);

          const { data: substitutesData } = miiIds.length > 0 ? await supabase
            .from('ingredient_substitutes')
            .select('*, substitute:ingredients(*)')
            .in('menu_item_ingredient_id', miiIds) : { data: [] };

          const ingredients: IngredientWithModifications[] = (menuItemIngredients || []).map((mii: any) => {
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

      setDbDishes(itemsWithData);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setStream(mediaStream);
      setCameraStarted(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please use file upload instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);

      // Stop camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      analyzeImage(imageData);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);
      analyzeImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (imageBase64: string) => {
    setStep('analyzing');
    setError(null);

    try {
      const result = await analyzeMenuPhoto(imageBase64);

      if (result.detectedItems.length === 0) {
        setError('No menu items detected. Please try again with a clearer photo.');
        setStep('capture');
        return;
      }

      // Match detected items with database dishes
      const matched: MatchedItem[] = result.detectedItems.map((detected) => {
        const bestMatch = findBestMatch(
          detected.name,
          dbDishes.map(d => ({ id: d.id, name: d.name })),
          50 // Lower threshold for fuzzy matching
        );

        const dbDish = bestMatch.dish
          ? dbDishes.find(d => d.id === bestMatch.dish!.id) || null
          : null;

        // Calculate safety status if we have a match and allergens
        let safetyStatus: MatchedItem['safetyStatus'] = 'unknown';
        if (dbDish && customerAllergens.length > 0) {
          const analysis = analyzeDishSafety(dbDish, dbDish.ingredients, dbDish.cookingSteps, customerAllergens);
          safetyStatus = analysis.status;
        } else if (dbDish) {
          safetyStatus = 'safe'; // No allergens specified, consider safe
        }

        return {
          detected,
          dbDish,
          matchScore: bestMatch.score,
          safetyStatus,
        };
      });

      setMatchedItems(matched);
      setStep('result');
    } catch (err) {
      console.error('Analysis error:', err);
      // Show the actual error message to help with debugging
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze menu. Please try again.';
      setError(errorMessage);
      setStep('capture');
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setMatchedItems([]);
    setError(null);
    setCameraStarted(false);
    setStep('capture');
    // Stop current stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const getSafetyIcon = (status: MatchedItem['safetyStatus']) => {
    switch (status) {
      case 'safe':
        return <CheckCircle className="w-3 h-3 text-green-300" />;
      case 'safe-with-modifications':
        return <AlertCircle className="w-3 h-3 text-amber-300" />;
      case 'unsafe':
        return <XCircle className="w-3 h-3 text-red-300" />;
      default:
        return null;
    }
  };

  // Don't auto-start camera - wait for user action

  const containerClass = embedded
    ? "bg-slate-900 flex flex-col min-h-[calc(100vh-180px)]"
    : "fixed inset-0 bg-slate-900 z-50 flex flex-col";

  return (
    <div className={containerClass}>
      {/* Header - only show in modal mode */}
      {!embedded && (
        <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">Scan Menu</h1>
              <p className="text-xs text-slate-400">
                {step === 'capture' && 'Point camera at the menu'}
                {step === 'analyzing' && 'Analyzing menu...'}
                {step === 'result' && `${matchedItems.filter(m => m.dbDish).length} items recognized`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </header>
      )}

      {/* Embedded mode status bar */}
      {embedded && step !== 'capture' && (
        <div className="bg-slate-800/50 px-4 py-2 text-center">
          <p className="text-sm text-slate-300">
            {step === 'analyzing' && 'Analyzing menu...'}
            {step === 'result' && `${matchedItems.filter(m => m.dbDish).length} items recognized`}
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {step === 'capture' && (
          <div className="h-full flex flex-col">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 text-sm m-4 rounded-lg">
                {error}
              </div>
            )}

            {!cameraStarted ? (
              // Initial state - show options to start camera or upload
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <Camera className="w-12 h-12 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Scan Your Menu</h2>
                <p className="text-slate-400 text-center mb-8 max-w-xs">
                  Take a photo of the physical menu to see allergen information for each dish
                </p>

                <div className="w-full max-w-sm space-y-3">
                  <button
                    onClick={startCamera}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Camera className="w-6 h-6" />
                    Open Camera
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-700 text-slate-200 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    Upload from Gallery
                  </button>
                </div>
              </div>
            ) : (
              // Camera is running - show viewfinder
              <>
                <div className="flex-1 relative bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Viewfinder overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-8 border-2 border-white/30 rounded-xl" />
                    <div className="absolute top-1/2 left-8 right-8 h-px bg-white/20" />
                  </div>
                </div>

                <div className="p-4 bg-slate-800">
                  <button
                    onClick={capturePhoto}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Camera className="w-6 h-6" />
                    Take Photo
                  </button>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="h-full flex flex-col items-center justify-center">
            <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-white text-lg font-medium">Analyzing menu...</p>
            <p className="text-slate-400 text-sm mt-2">Detecting dishes and matching with database</p>
          </div>
        )}

        {step === 'result' && capturedImage && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Menu container with proper scaling */}
            <div className="flex-1 overflow-auto bg-black flex items-start justify-center">
              <div className="relative" style={{ maxHeight: 'calc(100vh - 180px)', width: 'fit-content' }}>
                {/* Menu Image - Scaled to fit screen */}
                <img
                  src={capturedImage}
                  alt="Captured menu"
                  className="h-auto max-h-[calc(100vh-180px)] w-auto max-w-full object-contain"
                />

                {/* Info Cards Overlaid on Menu */}
                {matchedItems.map((item, index) => {
                  const dish = item.dbDish;
                  const allergens = dish?.ingredients
                    ?.flatMap(ing => ing.contains_allergens || [])
                    .filter((a, i, arr) => arr.indexOf(a) === i) || [];
                  const dangerousAllergens = allergens.filter(a =>
                    customerAllergens.some(ca => a.toLowerCase().includes(ca.toLowerCase()) || ca.toLowerCase().includes(a.toLowerCase()))
                  );

                  const bgColor = item.safetyStatus === 'safe' ? 'bg-green-700' :
                    item.safetyStatus === 'safe-with-modifications' ? 'bg-amber-700' :
                    item.safetyStatus === 'unsafe' ? 'bg-red-700' :
                    'bg-slate-800';

                  return (
                    <div
                      key={index}
                      onClick={() => dish && setSelectedDish(dish)}
                      className={`absolute ${bgColor} rounded shadow-lg cursor-pointer hover:brightness-110 transition-all border-l-4 border-white/50`}
                      style={{
                        left: `${item.detected.boundingBox.x}%`,
                        top: `${item.detected.boundingBox.y}%`,
                        transform: 'translate(0, -50%)',
                        maxWidth: '140px',
                        zIndex: 10 + index,
                      }}
                    >
                      {/* Compact Card Content */}
                      <div className="px-1.5 py-1">
                        {/* Name Row */}
                        <div className="flex items-center gap-1">
                          <span className="w-3 h-3 flex-shrink-0">{getSafetyIcon(item.safetyStatus)}</span>
                          <span className="font-semibold text-white text-xs leading-tight truncate">
                            {dish?.name || item.detected.name}
                          </span>
                        </div>

                        {dish ? (
                          <div className="mt-0.5 space-y-0.5">
                            {/* Calories & Macros - Single Line */}
                            <div className="flex items-center gap-1 text-[10px] text-white/90">
                              {dish.calories && <span className="font-medium">{dish.calories}cal</span>}
                              {dish.protein_g && <span>P{dish.protein_g}</span>}
                              {dish.carbs_g && <span>C{dish.carbs_g}</span>}
                              {dish.fat_g && <span>F{dish.fat_g}</span>}
                            </div>

                            {/* Allergens - Compact */}
                            {allergens.length > 0 && (
                              <div className="flex flex-wrap gap-0.5">
                                {allergens.slice(0, 2).map((allergen, i) => {
                                  const isDangerous = dangerousAllergens.includes(allergen);
                                  return (
                                    <span
                                      key={i}
                                      className={`text-[9px] px-1 rounded ${
                                        isDangerous
                                          ? 'bg-red-900 text-red-200 font-medium'
                                          : 'bg-black/40 text-white/70'
                                      }`}
                                    >
                                      {isDangerous && '⚠'}{allergen}
                                    </span>
                                  );
                                })}
                                {allergens.length > 2 && (
                                  <span className="text-[9px] text-white/50">+{allergens.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] text-white/60">Not in DB</span>
                        )}
                      </div>

                    </div>
                  );
                })}

              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3 flex-shrink-0">
              <button
                onClick={retakePhoto}
                className="flex-1 bg-slate-700 text-slate-200 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-semibold"
              >
                {embedded ? 'View Full Menu' : 'Done'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dish Detail Bottom Sheet */}
      <BottomSheet
        isOpen={!!selectedDish}
        onClose={() => setSelectedDish(null)}
        title={selectedDish?.name}
      >
        {selectedDish && (
          <DishDetail
            dish={selectedDish}
            customerAllergens={customerAllergens}
            restaurantId={restaurantId}
          />
        )}
      </BottomSheet>
    </div>
  );
}
