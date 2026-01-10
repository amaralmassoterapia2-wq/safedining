import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ScannedDish } from '../../pages/RestaurantOnboarding';
import { Check, Upload, X, ChevronRight } from 'lucide-react';

interface DishDetailsInputProps {
  restaurantId: string;
  dishes: ScannedDish[];
  onComplete: () => void;
}

interface DishForm {
  ingredients: string;
  preparation: string;
  photoFile: File | null;
  photoUrl: string;
}

export default function DishDetailsInput({ restaurantId, dishes, onComplete }: DishDetailsInputProps) {
  const [currentDishIndex, setCurrentDishIndex] = useState<number | null>(null);
  const [dishForms, setDishForms] = useState<Record<string, DishForm>>({});
  const [saving, setSaving] = useState(false);
  const [completedDishes, setCompletedDishes] = useState<Set<string>>(new Set());

  const currentDish = currentDishIndex !== null ? dishes[currentDishIndex] : null;
  const currentForm = currentDish ? dishForms[currentDish.id] || { ingredients: '', preparation: '', photoFile: null, photoUrl: '' } : null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, dishId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setDishForms((prev) => ({
        ...prev,
        [dishId]: { ...prev[dishId] || { ingredients: '', preparation: '', photoFile: null, photoUrl: '' }, photoFile: file, photoUrl: url },
      }));
    }
  };

  const handleSaveDish = async () => {
    if (!currentDish || !currentForm) return;

    setSaving(true);

    try {
      let photoUrl = null;

      if (currentForm.photoFile) {
        const fileExt = currentForm.photoFile.name.split('.').pop();
        const fileName = `${restaurantId}/${currentDish.id}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dish-photos')
          .upload(fileName, currentForm.photoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('dish-photos')
          .getPublicUrl(uploadData.path);

        photoUrl = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from('menu_items').insert({
        restaurant_id: restaurantId,
        name: currentDish.name,
        description: currentDish.description,
        category: currentDish.category,
        price: currentDish.price,
        photo_url: photoUrl,
        modification_policy: 'Please inform your server of any dietary restrictions.',
        is_active: true,
      });

      if (insertError) throw insertError;

      setCompletedDishes((prev) => new Set([...prev, currentDish.id]));
      setCurrentDishIndex(null);
    } catch (err) {
      console.error('Error saving dish:', err);
      alert('Failed to save dish. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  const completedCount = completedDishes.size;
  const progress = (completedCount / dishes.length) * 100;

  if (currentDishIndex === null) {
    return (
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Add Dish Details
            </h1>
            <p className="text-slate-600 mb-6">
              Fill in ingredient and preparation information for each dish
            </p>

            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Progress</span>
                <span>
                  {completedCount} of {dishes.length} dishes completed
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-slate-900 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {dishes.map((dish, index) => {
                const isCompleted = completedDishes.has(dish.id);
                return (
                  <button
                    key={dish.id}
                    onClick={() => setCurrentDishIndex(index)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                      isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {isCompleted && (
                          <div className="bg-green-500 text-white rounded-full p-1">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-slate-900">{dish.name}</h3>
                          <p className="text-sm text-slate-600">
                            {dish.category} • ${dish.price}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                );
              })}
            </div>

            {completedCount === dishes.length ? (
              <button
                onClick={handleFinish}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl"
              >
                All Dishes Complete - Continue
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="w-full bg-slate-300 text-slate-600 py-4 rounded-xl font-semibold cursor-not-allowed"
                disabled
              >
                Complete all dishes to continue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <button
            onClick={() => setCurrentDishIndex(null)}
            className="text-slate-600 hover:text-slate-900 mb-6 flex items-center gap-2 text-sm"
          >
            ← Back to All Dishes
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{currentDish?.name}</h1>
            <p className="text-slate-600">
              {currentDish?.category} • ${currentDish?.price}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Ingredients
              </label>
              <p className="text-xs text-slate-600 mb-2">
                List every ingredient and its exact amount (e.g., "Salmon fillet: 200g", "Olive oil: 15ml", "Wheat croutons: 30g")
              </p>
              <textarea
                value={currentForm?.ingredients || ''}
                onChange={(e) =>
                  setDishForms((prev) => ({
                    ...prev,
                    [currentDish.id]: { ...currentForm!, ingredients: e.target.value },
                  }))
                }
                rows={8}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                placeholder="Enter each ingredient on a new line..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Preparation Process
              </label>
              <p className="text-xs text-slate-600 mb-2">
                Describe the cooking process. Note any shared surfaces, fryers, or equipment used for allergens.
              </p>
              <textarea
                value={currentForm?.preparation || ''}
                onChange={(e) =>
                  setDishForms((prev) => ({
                    ...prev,
                    [currentDish.id]: { ...currentForm!, preparation: e.target.value },
                  }))
                }
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                placeholder="Describe how this dish is prepared..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Dish Photo (Optional)
              </label>
              <p className="text-xs text-slate-600 mb-2">
                Upload or take a photo of this dish to help customers visualize it
              </p>

              {currentForm?.photoUrl ? (
                <div className="relative">
                  <img
                    src={currentForm.photoUrl}
                    alt={currentDish.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() =>
                      setDishForms((prev) => ({
                        ...prev,
                        [currentDish.id]: { ...currentForm!, photoFile: null, photoUrl: '' },
                      }))
                    }
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block w-full p-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="text-sm text-slate-600">
                    Click to upload or drag and drop
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, currentDish.id)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <button
              onClick={handleSaveDish}
              disabled={saving || !currentForm?.ingredients || !currentForm?.preparation}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Dish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
