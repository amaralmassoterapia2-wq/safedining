import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChefHat, Mail, Lock, Building2, ArrowLeft, MailCheck } from 'lucide-react';

interface RestaurantOwnerLoginProps {
  onLoginSuccess: (restaurantId: string, isNewSignup?: boolean) => void;
  onBackToGuest: () => void;
}

export default function RestaurantOwnerLogin({ onLoginSuccess, onBackToGuest }: RestaurantOwnerLoginProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sendVerificationEmail = async (targetEmail: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return error;
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const resendError = await sendVerificationEmail(email);
      if (resendError) throw resendError;
      setMessage('Verification email sent! Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
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

      // Check if user already exists (Supabase returns empty identities for existing emails)
      const isExistingUser = authData.user &&
        (!authData.user.identities || authData.user.identities.length === 0);

      if (isExistingUser) {
        // Resend verification for existing unconfirmed user
        await sendVerificationEmail(email);
        setMode('verify');
        return;
      }

      if (authData.user) {
        const qrCode = `REST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const restaurantCode = String(Math.floor(1000 + Math.random() * 9000));

        // Use RPC function to bypass RLS (works before email confirmation)
        const { data: restaurantId, error: restaurantError } = await supabase
          .rpc('create_restaurant_for_user', {
            p_name: restaurantName,
            p_owner_id: authData.user.id,
            p_qr_code: qrCode,
            p_restaurant_code: restaurantCode,
          });

        if (restaurantError) throw restaurantError;

        // Explicitly resend verification email to guarantee delivery
        await sendVerificationEmail(email);

        setMode('verify');
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
    setMessage('');
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

  // Email verification screen
  if (mode === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl">
              <MailCheck className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Verify Your Email
          </h1>
          <p className="text-slate-400 text-center mb-6">
            We sent a verification link to
          </p>
          <p className="text-emerald-400 font-medium text-center mb-8">
            {email}
          </p>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-300 leading-relaxed">
              Click the link in the email to verify your account, then come back here and sign in. Check your spam folder if you don't see it.
            </p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-emerald-900/50 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-lg mb-4">
              {message}
            </div>
          )}

          <button
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full bg-slate-700 text-slate-200 py-3 rounded-xl font-semibold hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            onClick={() => { setMode('login'); setError(''); setMessage(''); }}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg"
          >
            Go to Sign In
          </button>

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
            {error.includes('Invalid login credentials') && (
              <button
                onClick={handleResendVerification}
                disabled={loading}
                className="block mt-2 text-sm text-red-300 hover:text-white underline"
              >
                Resend verification email
              </button>
            )}
          </div>
        )}

        {message && (
          <div className="bg-emerald-900/50 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-lg mb-6">
            {message}
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
