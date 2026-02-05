import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppModeProvider, useAppMode } from './contexts/AppModeContext';
import { supabase } from './lib/supabase';
import CustomerLanding from './pages/CustomerLanding';
import DietaryProfileSetup from './pages/DietaryProfileSetup';
import CustomerMenu from './pages/CustomerMenu';
import RestaurantOwnerLogin from './pages/RestaurantOwnerLogin';
import RestaurantOnboarding from './pages/RestaurantOnboarding';
import AdminDashboard from './pages/AdminDashboard';

type GuestView = 'landing' | 'dietary-setup' | 'menu';
type RestaurantView = 'login' | 'onboarding' | 'dashboard';

function AppContent() {
  const { user, loading } = useAuth();
  const { userMode, setUserMode } = useAppMode();

  const [guestView, setGuestView] = useState<GuestView>('landing');
  const [restaurantView, setRestaurantView] = useState<RestaurantView>('login');
  const [qrCode, setQrCode] = useState<string>('');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // Handle /menu/CODE format
    if (path.startsWith('/menu/')) {
      const code = path.split('/menu/')[1];
      if (code) {
        // Check if it's a 4-digit restaurant code or a qr_code
        if (/^\d{4}$/.test(code)) {
          // It's a restaurant code - look up the qr_code
          supabase
            .from('restaurants')
            .select('qr_code')
            .eq('restaurant_code', code)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setQrCode(data.qr_code);
                setGuestView('dietary-setup');
                setUserMode('guest');
              }
            });
        } else {
          // It's a qr_code
          setQrCode(code);
          setGuestView('dietary-setup');
          setUserMode('guest');
        }
      }
    }
    // Handle /?qr=CODE format (from QR code share links)
    else if (searchParams.has('qr')) {
      const code = searchParams.get('qr');
      if (code) {
        setQrCode(code);
        // Update URL to cleaner format
        window.history.replaceState({}, '', `/menu/${code}`);
        setGuestView('dietary-setup');
        setUserMode('guest');
      }
    }
  }, []);

  useEffect(() => {
    if (userMode === 'restaurant' && user) {
      loadRestaurantData();
    }
  }, [user, userMode]);

  const loadRestaurantData = async () => {
    if (!user) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, terms_accepted, onboarding_completed')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (restaurant) {
      setRestaurantId(restaurant.id);

      if (!restaurant.terms_accepted || !restaurant.onboarding_completed) {
        setRestaurantView('onboarding');
      } else {
        // Check if restaurant has any menu items
        const { count } = await supabase
          .from('menu_items')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id);

        if (count === 0) {
          // No menu items - force onboarding to scan menu
          setRestaurantView('onboarding');
        } else {
          setRestaurantView('dashboard');
        }
      }
    }
  };

  const handleSwitchToRestaurantMode = () => {
    setUserMode('restaurant');
    setRestaurantView('login');
  };

  const handleBackToGuestMode = () => {
    setUserMode('guest');
    setGuestView('landing');
  };

  const handleQrCodeEntered = (code: string) => {
    setQrCode(code);
    window.history.pushState({}, '', `/menu/${code}`);
    setGuestView('dietary-setup');
  };

  const handleProfileComplete = () => {
    setGuestView('menu');
  };

  const handleEditProfile = () => {
    setGuestView('dietary-setup');
  };

  const handleExitMenu = () => {
    setQrCode('');
    setGuestView('landing');
    window.history.pushState({}, '', '/');
  };

  const handleRestaurantLoginSuccess = (id: string, isNewSignup: boolean = false) => {
    setRestaurantId(id);
    if (isNewSignup) {
      // New signup - go directly to onboarding (we know terms_accepted and onboarding_completed are false)
      setRestaurantView('onboarding');
    } else {
      // Existing user login - load their data to determine where to go
      loadRestaurantData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (userMode === 'restaurant') {
    if (restaurantView === 'login') {
      return (
        <RestaurantOwnerLogin
          onLoginSuccess={handleRestaurantLoginSuccess}
          onBackToGuest={handleBackToGuestMode}
        />
      );
    }

    if (restaurantView === 'onboarding' && restaurantId) {
      return (
        <RestaurantOnboarding
          restaurantId={restaurantId}
          onComplete={() => setRestaurantView('dashboard')}
        />
      );
    }

    if (restaurantView === 'dashboard') {
      return <AdminDashboard onBackToGuest={handleBackToGuestMode} />;
    }
  }

  if (guestView === 'dietary-setup') {
    return <DietaryProfileSetup onComplete={handleProfileComplete} />;
  }

  if (guestView === 'menu' && qrCode) {
    return <CustomerMenu qrCode={qrCode} onEditProfile={handleEditProfile} onExit={handleExitMenu} />;
  }

  return (
    <CustomerLanding
      onQrCodeEntered={handleQrCodeEntered}
      onSwitchToRestaurantMode={handleSwitchToRestaurantMode}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppModeProvider>
        <AppContent />
      </AppModeProvider>
    </AuthProvider>
  );
}

export default App;
