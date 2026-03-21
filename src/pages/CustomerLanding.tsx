import { useState, useRef, useEffect } from 'react';
import { AlertCircle, ArrowRight, ChefHat, Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ShieldWithForkKnife from '../components/ShieldWithForkKnife';

interface CustomerLandingProps {
  onQrCodeEntered: (qrCode: string) => void;
  onSwitchToRestaurantMode: () => void;
}

export default function CustomerLanding({ onQrCodeEntered, onSwitchToRestaurantMode }: CustomerLandingProps) {
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
    if (digit && index === 3 && newCode.every(d => d !== '')) handleSubmit(newCode.join(''));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
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
    if (codeToCheck.length !== 4) { setError('Please enter a 4-digit code'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: restaurant, error: queryError } = await supabase
        .from('restaurants')
        .select('qr_code')
        .eq('restaurant_code', codeToCheck)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!restaurant) {
        setError('Restaurant not found. Please check the code.');
        setCode(['', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }
      onQrCodeEntered(restaurant.qr_code);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = code.every(d => d !== '');

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #e0f2f1 0%, #e8f4f8 40%, #fce8d8 100%)' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Logo + Title row */}
        <div className="flex items-center gap-4">
          <ShieldWithForkKnife />
          <div>
            <h1 className="text-3xl font-bold text-slate-800 leading-tight">Safe Dining</h1>
            <p className="text-slate-500 text-sm mt-0.5">Instant allergen information for your meal</p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Full Menu Info - yellow */}
          <div className="flex flex-col items-center justify-between rounded-2xl p-4 shadow-md"
            style={{ background: 'linear-gradient(145deg, #f6c12b, #f5a623)', minHeight: 110 }}>
            <Utensils className="w-9 h-9 text-white" strokeWidth={2} />
            <p className="text-white font-bold text-xs text-center leading-tight mt-2">Full Menu Info</p>
          </div>
          {/* Allergen Alerts - orange-red */}
          <div className="flex flex-col items-center justify-between rounded-2xl p-4 shadow-md"
            style={{ background: 'linear-gradient(145deg, #f97316, #dc2626)', minHeight: 110 }}>
            <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
              <path d="M24 4 L45 42 H3 Z" stroke="white" strokeWidth="3" strokeLinejoin="round" fill="none" />
              <line x1="24" y1="17" x2="24" y2="30" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="24" cy="36.5" r="2.2" fill="white" />
            </svg>
            <p className="text-white font-bold text-xs text-center leading-tight mt-2">Allergen Alerts</p>
          </div>
          {/* Modifications - blue */}
          <div className="flex flex-col items-center justify-between rounded-2xl p-4 shadow-md"
            style={{ background: 'linear-gradient(145deg, #60a5fa, #6366f1)', minHeight: 110 }}>
            <ChefHat className="w-9 h-9 text-white" strokeWidth={2} />
            <p className="text-white font-bold text-xs text-center leading-tight mt-2">Modifications</p>
          </div>
        </div>

        {/* Code Input card */}
        <div className="bg-white rounded-2xl shadow-md px-5 py-4">
          <p className="text-slate-600 text-sm font-medium mb-3">Enter Restaurant Code</p>
          <div className="flex justify-start gap-2" onPaste={handlePaste}>
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
                className="w-12 h-12 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-400/20 outline-none transition-all text-slate-800 bg-slate-50"
                disabled={loading}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Ask your server for the 4-digit code</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* View Menu button */}
        <button
          onClick={() => handleSubmit()}
          disabled={!isComplete || loading}
          className="w-full text-white py-4 rounded-full font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #0d9488)' }}
        >
          {loading ? 'Finding Restaurant...' : (
            <> View Menu <ArrowRight className="w-5 h-5" /> </>
          )}
        </button>
      </div>

      <button
        onClick={onSwitchToRestaurantMode}
        className="mt-8 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        Restaurant Owner? Sign in here
      </button>
    </div>
  );
}
