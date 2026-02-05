import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, QrCode, Plus, BarChart3, X, Download, Copy, Check, FileSpreadsheet } from 'lucide-react';
import RestaurantSetup from '../components/admin/RestaurantSetup';
import MenuManager from '../components/admin/MenuManager';
import AccessibilityDashboard from '../components/admin/AccessibilityDashboard';
import AllergenMatrixPreview from '../components/admin/AllergenMatrixPreview';
import QRCodeLib from 'qrcode';

// Get the base URL for QR codes - use environment variable if set, otherwise use current origin
const getMenuBaseUrl = (): string => {
  // Check for explicit production URL in environment
  const envUrl = import.meta.env.VITE_PUBLIC_URL;
  if (envUrl) return envUrl;

  // Fallback to current origin (works in production, but not ideal for dev environments)
  return window.location.origin;
};

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
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAllergenMatrix, setShowAllergenMatrix] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleSignOut = async () => {
    await signOut();
    if (onBackToGuest) {
      onBackToGuest();
    }
  };

  useEffect(() => {
    loadRestaurant();
  }, [user]);

  // Generate QR code when modal opens
  useEffect(() => {
    const generateQR = async () => {
      if (!showQRModal || !restaurant || !qrCanvasRef.current) return;

      try {
        const menuUrl = `${getMenuBaseUrl()}/menu/${restaurant.qr_code}`;

        await QRCodeLib.toCanvas(qrCanvasRef.current, menuUrl, {
          width: 280,
          margin: 2,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
        });

        const dataUrl = qrCanvasRef.current.toDataURL('image/png');
        setQrCodeUrl(dataUrl);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };

    generateQR();
  }, [showQRModal, restaurant]);

  const handleCopyUrl = () => {
    if (!restaurant) return;
    const qrUrl = `${getMenuBaseUrl()}/menu/${restaurant.qr_code}`;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl || !restaurant) return;

    const link = document.createElement('a');
    link.download = `${restaurant.name.replace(/\s+/g, '-')}-menu-qr.png`;
    link.href = qrCodeUrl;
    link.click();
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
                onClick={() => setShowQRModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                Share Menu
              </button>
              <button
                onClick={handleOpenAllergenMatrix}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Allergen Matrix
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

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Share Your Menu</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Restaurant Code - Primary */}
            <div className="text-center mb-6">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 mb-4 border-2 border-emerald-200">
                <p className="text-sm font-medium text-slate-600 mb-2">Your Restaurant Code</p>
                <div className="flex justify-center gap-2">
                  {restaurant.restaurant_code.split('').map((digit, i) => (
                    <span
                      key={i}
                      className="w-12 h-14 flex items-center justify-center bg-white border-2 border-emerald-300 rounded-lg text-2xl font-bold text-slate-900 shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Share this code with customers to access your menu
                </p>
              </div>
            </div>

            {/* QR Code - Secondary */}
            <div className="text-center mb-6">
              <details className="group">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4" />
                  Show QR Code (optional)
                </summary>
                <div className="bg-slate-50 rounded-xl p-4 mt-3">
                  <canvas ref={qrCanvasRef} className="mx-auto" />
                  <p className="text-xs text-slate-500 mt-2">
                    Customers can also scan this QR code
                  </p>
                </div>
              </details>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownloadQR}
                disabled={!qrCodeUrl}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                Download QR Code
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${getMenuBaseUrl()}/menu/${restaurant.qr_code}`}
                  readOnly
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 text-sm font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span className="text-slate-600 text-sm font-medium">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
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
