import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChefHat, Mail, Lock, Building2, ArrowLeft } from 'lucide-react';

interface RestaurantOwnerLoginProps {
  onLoginSuccess: (restaurantId: string, isNewSignup?: boolean) => void;
  onBackToGuest: () => void;
}

export default function RestaurantOwnerLogin({ onLoginSuccess, onBackToGuest }: RestaurantOwnerLoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const qrCode = `REST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Use RPC function to bypass RLS (works before email confirmation)
        const { data: restaurantId, error: restaurantError } = await supabase
          .rpc('create_restaurant_for_user', {
            p_name: restaurantName,
            p_owner_id: authData.user.id,
            p_qr_code: qrCode,
          });

        if (restaurantError) throw restaurantError;

        onLoginSuccess(restaurantId, true); // true = new signup
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, terms_accepted, onboarding_completed')
          .eq('owner_id', authData.user.id)
          .maybeSingle();

        if (restaurantError) throw restaurantError;

        if (!restaurant) {
          throw new Error('No restaurant found for this account');
        }

        onLoginSuccess(restaurant.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 w-full max-w-md">
          <button
            onClick={() => setMode('login')}
            className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl">
              <ChefHat className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Register Your Restaurant
          </h1>
          <p className="text-slate-400 text-center mb-8">
            Create an account to get started
          </p>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Restaurant Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500"
                  placeholder="Your restaurant name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Chef/Manager Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500"
                  placeholder="chef@restaurant.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <button
            onClick={onBackToGuest}
            className="mt-6 text-center w-full text-sm text-slate-400 hover:text-white transition-colors"
          >
            Back to Guest View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl">
            <ChefHat className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Restaurant Owner Login
        </h1>
        <p className="text-slate-400 text-center mb-8">
          Access your restaurant dashboard
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500"
                placeholder="chef@restaurant.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700">
          <p className="text-center text-sm text-slate-400 mb-3">
            Don't have an account?
          </p>
          <button
            onClick={() => setMode('register')}
            className="w-full text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Register Your Restaurant
          </button>
        </div>

        <button
          onClick={onBackToGuest}
          className="mt-6 text-center w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Back to Guest View
        </button>
      </div>
    </div>
  );
}
