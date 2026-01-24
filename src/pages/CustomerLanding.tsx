import { useState, useRef, useEffect } from 'react';
import { Shield, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CustomerLandingProps {
  onQrCodeEntered: (qrCode: string) => void;
  onSwitchToRestaurantMode: () => void;
}

export default function CustomerLanding({ onQrCodeEntered, onSwitchToRestaurantMode }: CustomerLandingProps) {
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (digit && index === 3 && newCode.every(d => d !== '')) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedData.length === 4) {
      const newCode = pastedData.split('');
      setCode(newCode);
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (restaurantCode?: string) => {
    const codeToCheck = restaurantCode || code.join('');

    if (codeToCheck.length !== 4) {
      setError('Please enter a 4-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Look up restaurant by code
      const { data: restaurant, error: queryError } = await supabase
        .from('restaurants')
        .select('qr_code')
        .eq('restaurant_code', codeToCheck)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (!restaurant) {
        setError('Restaurant not found. Please check the code.');
        setCode(['', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Found the restaurant - use its qr_code for navigation
      onQrCodeEntered(restaurant.qr_code);
    } catch (err) {
      console.error('Error looking up restaurant:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = code.every(d => d !== '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg">
        {/* Badge */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-full shadow-lg">
            <Sparkles className="w-4 h-4" />
            AI-Powered
          </span>
        </div>

        <div className="flex items-center justify-center mb-8 mt-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg">
            <Shield className="w-14 h-14 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-center text-slate-900 mb-3">
          Safe Dining
        </h1>
        <p className="text-center text-slate-500 text-lg mb-8">
          Instant allergen information for your meal
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <span className="text-xl">🥗</span>
            </div>
            <p className="text-xs text-slate-600 font-medium">Full Menu Info</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <span className="text-xl">⚠️</span>
            </div>
            <p className="text-xs text-slate-600 font-medium">Allergen Alerts</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <span className="text-xl">🔄</span>
            </div>
            <p className="text-xs text-slate-600 font-medium">Modifications</p>
          </div>
        </div>

        {/* Code Input */}
        <div className="mb-6">
          <label className="block text-center text-sm font-medium text-slate-600 mb-3">
            Enter Restaurant Code
          </label>
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-14 h-16 text-center text-2xl font-bold border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                disabled={loading}
              />
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Ask your server for the 4-digit code
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={() => handleSubmit()}
          disabled={!isComplete || loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            'Finding Restaurant...'
          ) : (
            <>
              View Menu
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-slate-400 text-sm mt-4">
          Enter the code, then snap a photo of the menu
        </p>
      </div>

      <button
        onClick={onSwitchToRestaurantMode}
        className="mt-8 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Restaurant Owner? Sign in here
      </button>
    </div>
  );
}
