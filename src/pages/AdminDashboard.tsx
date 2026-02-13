import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Plus, BarChart3, X, Copy, Check, FileSpreadsheet, Share2 } from 'lucide-react';
import RestaurantSetup from '../components/admin/RestaurantSetup';
import MenuManager from '../components/admin/MenuManager';
import AccessibilityDashboard from '../components/admin/AccessibilityDashboard';
import AllergenMatrixPreview from '../components/admin/AllergenMatrixPreview';

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  qr_code: string;
  restaurant_code: string;
};

type Tab = 'menu' | 'dashboard';

interface AdminDashboardProps {
  onBackToGuest?: () => void;
}

export default function AdminDashboard({ onBackToGuest }: AdminDashboardProps = {}) {
  const { user, signOut } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('menu');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllergenMatrix, setShowAllergenMatrix] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    if (onBackToGuest) {
      onBackToGuest();
    }
  };

  useEffect(() => {
    loadRestaurant();
  }, [user]);

  const handleCopyCode = () => {
    if (!restaurant) return;
    navigator.clipboard.writeText(restaurant.restaurant_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenAllergenMatrix = () => {
    setShowAllergenMatrix(true);
  };

  const loadRestaurant = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setRestaurant(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!restaurant) {
    return <RestaurantSetup onRestaurantCreated={loadRestaurant} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{restaurant.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-slate-400">Restaurant Admin Panel</p>
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-mono font-bold">
                  Code: {restaurant.restaurant_code}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share Menu
              </button>
              <button
                onClick={handleOpenAllergenMatrix}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Dietary Matrix
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('menu')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'menu'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Menu Management
              </div>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Accessibility Dashboard
              </div>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'menu' && <MenuManager restaurantId={restaurant.id} />}
        {activeTab === 'dashboard' && <AccessibilityDashboard restaurantId={restaurant.id} />}
      </main>

      {/* Share Menu Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Share Your Menu</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Restaurant Code */}
            <div className="text-center mb-6">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-8 border-2 border-emerald-200">
                <p className="text-sm font-medium text-slate-600 mb-3">Your Restaurant Code</p>
                <div className="flex justify-center gap-3">
                  {restaurant.restaurant_code.split('').map((digit, i) => (
                    <span
                      key={i}
                      className="w-14 h-16 flex items-center justify-center bg-white border-2 border-emerald-300 rounded-xl text-3xl font-bold text-slate-900 shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-600 mt-4">
                  Customers enter this code in the app to view your menu
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Code Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Code
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Allergen Matrix Preview */}
      <AllergenMatrixPreview
        isOpen={showAllergenMatrix}
        onClose={() => setShowAllergenMatrix(false)}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
      />
    </div>
  );
}
