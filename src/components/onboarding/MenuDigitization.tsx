import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, RefreshCw, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { ScannedDish } from '../../pages/RestaurantOnboarding';
import { analyzeMenuImage } from '../../lib/openai';
import { supabase, Database } from '../../lib/supabase';

type ExistingMenuItem = Database['public']['Tables']['menu_items']['Row'];

interface MenuDigitizationProps {
  restaurantId: string;
  onComplete: (dishes: ScannedDish[]) => void;
}

interface ConflictItem {
  scannedDish: ScannedDish;
  existingItem: ExistingMenuItem | null;
  similarity: number;
  action: 'override' | 'keep' | 'add';
}

// Simple fuzzy matching function using Levenshtein distance
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity percentage (0-100)
function calculateSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

// Find best matching existing item for a scanned dish
function findBestMatch(
  dish: ScannedDish,
  existingItems: ExistingMenuItem[],
  threshold: number = 60
): { item: ExistingMenuItem | null; similarity: number } {
  let bestMatch: ExistingMenuItem | null = null;
  let bestSimilarity = 0;

  for (const item of existingItems) {
    const similarity = calculateSimilarity(dish.name, item.name);
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = item;
    }
  }

  return { item: bestMatch, similarity: bestSimilarity };
}

export default function MenuDigitization({ restaurantId, onComplete }: MenuDigitizationProps) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState('');
  const [dishes, setDishes] = useState<ScannedDish[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [existingItems, setExistingItems] = useState<ExistingMenuItem[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load existing menu items on mount
  useEffect(() => {
    const loadExistingItems = async () => {
      try {
        const { data } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId);

        if (data) {
          setExistingItems(data);
        }
      } catch (err) {
        console.error('Error loading existing menu items:', err);
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExistingItems();
  }, [restaurantId]);

  const processImage = async (file: File) => {
    setError('');
    setScanning(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreviewImage(base64);

      const extractedDishes = await analyzeMenuImage(base64);

      if (extractedDishes.length === 0) {
        throw new Error('No dishes could be detected in the image. Please try a clearer photo.');
      }

      setDishes(extractedDishes);

      // Check for conflicts with existing items
      if (existingItems.length > 0) {
        const conflictItems: ConflictItem[] = extractedDishes.map((dish) => {
          const { item, similarity } = findBestMatch(dish, existingItems);
          return {
            scannedDish: dish,
            existingItem: item,
            similarity,
            action: item ? 'keep' as const : 'add' as const, // Default to keeping existing
          };
        });

        const hasConflicts = conflictItems.some((c) => c.existingItem !== null);

        if (hasConflicts) {
          setConflicts(conflictItems);
          setShowConflictResolution(true);
        } else {
          setScanned(true);
        }
      } else {
        setScanned(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze menu image');
      setPreviewImage(null);
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError('Image too large. Please select an image under 20MB.');
        return;
      }
      processImage(file);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRetry = () => {
    setScanned(false);
    setShowConflictResolution(false);
    setDishes([]);
    setConflicts([]);
    setPreviewImage(null);
    setError('');
  };

  const handleConflictAction = (dishId: string, action: 'override' | 'keep') => {
    setConflicts((prev) =>
      prev.map((c) =>
        c.scannedDish.id === dishId ? { ...c, action } : c
      )
    );
  };

  const handleBulkAction = (action: 'override' | 'keep') => {
    setConflicts((prev) =>
      prev.map((c) =>
        c.existingItem ? { ...c, action } : c
      )
    );
  };

  const toggleConflictExpand = (dishId: string) => {
    setExpandedConflicts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dishId)) {
        newSet.delete(dishId);
      } else {
        newSet.add(dishId);
      }
      return newSet;
    });
  };

  const handleConflictResolutionComplete = () => {
    // Build final dish list based on conflict resolution
    const finalDishes: ScannedDish[] = [];

    for (const conflict of conflicts) {
      if (conflict.action === 'override' || conflict.action === 'add') {
        // Add the scanned dish (new or overriding existing)
        finalDishes.push({
          ...conflict.scannedDish,
          // If overriding, mark it with the existing item's ID for later update
          id: conflict.action === 'override' && conflict.existingItem
            ? conflict.existingItem.id
            : conflict.scannedDish.id,
        });
      }
      // If 'keep', we don't add the scanned dish - existing item stays as is
    }

    // Also add any new dishes that don't have conflicts
    const newDishesWithoutConflicts = dishes.filter(
      (d) => !conflicts.some((c) => c.scannedDish.id === d.id)
    );
    finalDishes.push(...newDishesWithoutConflicts);

    setShowConflictResolution(false);
    setScanned(true);
    setDishes(finalDishes);
  };

  const handleContinue = () => {
    onComplete(dishes);
  };

  const conflictsWithMatches = conflicts.filter((c) => c.existingItem !== null);
  const newItems = conflicts.filter((c) => c.existingItem === null);

  if (loadingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-slate-600 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading existing menu...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-slate-900 p-4 rounded-2xl">
            <Camera className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
          Digitize Your Menu
        </h1>
        <p className="text-center text-slate-600 mb-8">
          Take a photo or upload an image of your menu to extract dish information
        </p>

        {existingItems.length > 0 && !scanned && !scanning && !showConflictResolution && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You have {existingItems.length} existing menu item{existingItems.length !== 1 ? 's' : ''}.
              If scanned items match existing ones, you'll be able to choose whether to update or keep the originals.
            </p>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800">{error}</p>
              {error.includes('API key') && (
                <p className="text-red-600 text-sm mt-1">
                  Get your API key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a>
                </p>
              )}
            </div>
          </div>
        )}

        {!scanned && !scanning && !showConflictResolution && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Tips for best results:</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Ensure good lighting and avoid shadows</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Keep the menu flat and capture the full page</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Text should be clearly readable in the photo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>You can scan multiple pages one at a time</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleCameraClick}
                className="bg-slate-900 text-white py-4 px-6 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
              >
                <Camera className="w-6 h-6" />
                <span>Take Photo</span>
              </button>
              <button
                onClick={handleUploadClick}
                className="bg-white text-slate-900 py-4 px-6 rounded-xl font-semibold border-2 border-slate-900 hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              >
                <Upload className="w-6 h-6" />
                <span>Upload Image</span>
              </button>
            </div>
          </div>
        )}

        {scanning && (
          <div className="text-center py-12">
            {previewImage && (
              <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 max-h-48 mx-auto">
                <img src={previewImage} alt="Menu preview" className="w-full h-48 object-cover" />
              </div>
            )}
            <Loader2 className="w-16 h-16 text-slate-900 animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Analyzing menu...</h3>
            <p className="text-slate-600">
              AI is extracting dish names, prices, and descriptions
            </p>
          </div>
        )}

        {/* Conflict Resolution UI */}
        {showConflictResolution && (
          <div className="space-y-6">
            {previewImage && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-32">
                <img src={previewImage} alt="Menu" className="w-full h-32 object-cover" />
              </div>
            )}

            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <RefreshCw className="w-8 h-8 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-amber-900 mb-2">
                    Potential Duplicates Found
                  </h3>
                  <p className="text-amber-800 mb-4">
                    We found <strong>{conflictsWithMatches.length}</strong> item{conflictsWithMatches.length !== 1 ? 's' : ''} that
                    may already exist in your menu. Choose whether to update existing items or keep them as-is.
                  </p>

                  {/* Bulk Actions */}
                  {conflictsWithMatches.length > 1 && (
                    <div className="bg-white rounded-lg p-3 mb-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Apply to all matches:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBulkAction('override')}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          Override All
                        </button>
                        <button
                          onClick={() => handleBulkAction('keep')}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Keep All Existing
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Individual Conflict Items */}
                  <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                    {conflictsWithMatches.map((conflict) => (
                      <div
                        key={conflict.scannedDish.id}
                        className={`border-2 rounded-lg overflow-hidden transition-colors ${
                          conflict.action === 'override'
                            ? 'border-blue-400 bg-blue-50/30'
                            : 'border-slate-300 bg-slate-50/30'
                        }`}
                      >
                        <button
                          onClick={() => toggleConflictExpand(conflict.scannedDish.id)}
                          className={`w-full p-3 flex items-center justify-between transition-colors ${
                            conflict.action === 'override'
                              ? 'bg-blue-50 hover:bg-blue-100'
                              : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              conflict.action === 'override'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-500 text-white'
                            }`}>
                              {conflict.action === 'override' ? 'UPDATE' : 'KEEP'}
                            </span>
                            <span className="font-medium text-slate-900">{conflict.scannedDish.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                              {conflict.similarity}% match
                            </span>
                          </div>
                          {expandedConflicts.has(conflict.scannedDish.id) ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        {expandedConflicts.has(conflict.scannedDish.id) && (
                          <div className="p-3 border-t border-slate-200 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Existing</div>
                                <div className="font-medium text-slate-900">{conflict.existingItem?.name}</div>
                                <div className="text-slate-600">${Number(conflict.existingItem?.price || 0).toFixed(2)}</div>
                                {conflict.existingItem?.description && (
                                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{conflict.existingItem.description}</div>
                                )}
                              </div>
                              <div className="bg-blue-50 rounded-lg p-3">
                                <div className="text-xs text-blue-500 mb-1">Scanned (New)</div>
                                <div className="font-medium text-slate-900">{conflict.scannedDish.name}</div>
                                <div className="text-slate-600">${conflict.scannedDish.price}</div>
                                {conflict.scannedDish.description && (
                                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{conflict.scannedDish.description}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleConflictAction(conflict.scannedDish.id, 'keep')}
                                className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
                                  conflict.action === 'keep'
                                    ? 'bg-slate-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                Keep Existing
                              </button>
                              <button
                                onClick={() => handleConflictAction(conflict.scannedDish.id, 'override')}
                                className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
                                  conflict.action === 'override'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                Use Scanned Version
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {newItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-amber-200">
                      <p className="text-sm text-amber-800">
                        <strong>{newItems.length}</strong> new item{newItems.length !== 1 ? 's' : ''} will be added
                        (no existing match found)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleRetry}
                className="flex-1 bg-white text-slate-900 py-4 rounded-xl font-semibold border-2 border-slate-300 hover:bg-slate-50 transition-all"
              >
                Scan Different Menu
              </button>
              <button
                onClick={handleConflictResolutionComplete}
                className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {scanned && !showConflictResolution && (
          <div className="space-y-6">
            {previewImage && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-32">
                <img src={previewImage} alt="Menu" className="w-full h-32 object-cover" />
              </div>
            )}

            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-green-900 mb-2">
                    {conflicts.length > 0 ? 'Conflicts Resolved!' : 'Analysis Complete!'}
                  </h3>
                  <p className="text-green-800 mb-4">
                    {dishes.length > 0 ? (
                      <>Ready to proceed with <strong>{dishes.length} dish{dishes.length !== 1 ? 'es' : ''}</strong></>
                    ) : (
                      <>All scanned items matched existing menu items that you chose to keep</>
                    )}
                  </p>
                  {dishes.length > 0 && (
                    <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                      <h4 className="font-semibold text-slate-900 mb-2">Items to process:</h4>
                      <div className="space-y-2 text-sm text-slate-700">
                        {dishes.map((dish) => (
                          <div key={dish.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="font-medium">{dish.name}</span>
                            </div>
                            <span className="text-slate-500">${dish.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-900">
                <strong>Next step:</strong> You'll add detailed ingredient information and allergen
                details for each dish.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleRetry}
                className="flex-1 bg-white text-slate-900 py-4 rounded-xl font-semibold border-2 border-slate-300 hover:bg-slate-50 transition-all"
              >
                Scan Different Menu
              </button>
              <button
                onClick={handleContinue}
                disabled={dishes.length === 0}
                className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Dish Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
