import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, QrCode, Plus, BarChart3 } from 'lucide-react';
import RestaurantSetup from '../components/admin/RestaurantSetup';
import MenuManager from '../components/admin/MenuManager';
import AccessibilityDashboard from '../components/admin/AccessibilityDashboard';
import ChefRequests from '../components/admin/ChefRequests';

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  qr_code: string;
};

type Tab = 'menu' | 'dashboard' | 'requests';

interface AdminDashboardProps {
  onBackToGuest?: () => void;
}

export default function AdminDashboard({ onBackToGuest }: AdminDashboardProps = {}) {
  const { user, signOut } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('menu');

  const handleSignOut = async () => {
    await signOut();
    if (onBackToGuest) {
      onBackToGuest();
    }
  };

  useEffect(() => {
    loadRestaurant();
  }, [user]);

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
              <p className="text-sm text-slate-400 mt-1">Restaurant Admin Panel</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const qrUrl = `${window.location.origin}/menu/${restaurant.qr_code}`;
                  navigator.clipboard.writeText(qrUrl);
                  alert('QR Code URL copied to clipboard!');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                Share Menu
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
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'requests'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Chef Requests
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'menu' && <MenuManager restaurantId={restaurant.id} />}
        {activeTab === 'dashboard' && <AccessibilityDashboard restaurantId={restaurant.id} />}
        {activeTab === 'requests' && <ChefRequests restaurantId={restaurant.id} />}
      </main>
    </div>
  );
}
