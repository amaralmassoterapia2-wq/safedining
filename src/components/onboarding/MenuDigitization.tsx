import { useState } from 'react';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { ScannedDish } from '../../pages/RestaurantOnboarding';

interface MenuDigitizationProps {
  restaurantId: string;
  onComplete: (dishes: ScannedDish[]) => void;
}

const MOCK_DISHES: ScannedDish[] = [
  { id: '1', name: 'Grilled Salmon', category: 'Main Courses', price: '28.00', description: 'Fresh Atlantic salmon with herbs' },
  { id: '2', name: 'Caesar Salad', category: 'Appetizers', price: '12.00', description: 'Romaine lettuce with parmesan and croutons' },
  { id: '3', name: 'Chocolate Lava Cake', category: 'Desserts', price: '9.00', description: 'Warm chocolate cake with molten center' },
  { id: '4', name: 'Chicken Alfredo', category: 'Main Courses', price: '22.00', description: 'Fettuccine pasta with creamy alfredo sauce' },
  { id: '5', name: 'Tomato Basil Soup', category: 'Appetizers', price: '8.00', description: 'Homemade tomato soup with fresh basil' },
  { id: '6', name: 'New York Strip Steak', category: 'Main Courses', price: '38.00', description: '12oz premium cut steak' },
  { id: '7', name: 'Margherita Pizza', category: 'Main Courses', price: '18.00', description: 'Classic pizza with mozzarella and basil' },
  { id: '8', name: 'Tiramisu', category: 'Desserts', price: '10.00', description: 'Italian coffee-flavored dessert' },
  { id: '9', name: 'Caprese Salad', category: 'Appetizers', price: '14.00', description: 'Fresh mozzarella, tomatoes, and basil' },
  { id: '10', name: 'Fish and Chips', category: 'Main Courses', price: '19.00', description: 'Battered cod with french fries' },
  { id: '11', name: 'Garlic Bread', category: 'Sides', price: '6.00', description: 'Toasted bread with garlic butter' },
  { id: '12', name: 'Crème Brûlée', category: 'Desserts', price: '11.00', description: 'Classic French custard dessert' },
];

export default function MenuDigitization({ onComplete }: MenuDigitizationProps) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [dishCount] = useState(MOCK_DISHES.length);

  const handleScan = () => {
    setScanning(true);

    setTimeout(() => {
      setScanning(false);
      setScanned(true);
    }, 2500);
  };

  const handleContinue = () => {
    onComplete(MOCK_DISHES);
  };

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
          Scan your physical menu to extract dish names and information
        </p>

        {!scanned && !scanning && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-3">What to prepare:</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Have your physical menu ready</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Ensure good lighting for clear scanning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>The scan will capture dish names, prices, and descriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>You'll add detailed allergen information in the next step</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleScan}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              <Camera className="w-6 h-6" />
              Scan Physical Menu with Camera
            </button>
          </div>
        )}

        {scanning && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-slate-900 animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Scanning menu...</h3>
            <p className="text-slate-600">
              Processing your menu and extracting dish information
            </p>
          </div>
        )}

        {scanned && (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-green-900 mb-2">
                    Scanning Complete!
                  </h3>
                  <p className="text-green-800 mb-4">
                    Found <strong>{dishCount} dishes</strong> across multiple categories
                  </p>
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">Detected Dishes:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                      {MOCK_DISHES.slice(0, 6).map((dish) => (
                        <div key={dish.id} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span>{dish.name}</span>
                        </div>
                      ))}
                    </div>
                    {MOCK_DISHES.length > 6 && (
                      <p className="text-xs text-slate-500 mt-2">
                        +{MOCK_DISHES.length - 6} more dishes
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-900">
                <strong>Next step:</strong> You'll add detailed ingredient information and allergen
                details for each dish.
              </p>
            </div>

            <button
              onClick={handleContinue}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
            >
              Continue to Dish Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
