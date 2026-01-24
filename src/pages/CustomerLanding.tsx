import { useState } from 'react';
import { Camera, Shield, Sparkles } from 'lucide-react';
import QRCodeScanner from '../components/customer/QRCodeScanner';

interface CustomerLandingProps {
  onQrCodeEntered: (qrCode: string) => void;
  onSwitchToRestaurantMode: () => void;
}

export default function CustomerLanding({ onQrCodeEntered, onSwitchToRestaurantMode }: CustomerLandingProps) {
  const [showScanner, setShowScanner] = useState(false);

  const handleScanSuccess = (qrCode: string) => {
    setShowScanner(false);
    onQrCodeEntered(qrCode);
  };

  if (showScanner) {
    return <QRCodeScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />;
  }

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

        <button
          onClick={() => setShowScanner(true)}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
        >
          <Camera className="w-6 h-6" />
          Get Started
        </button>

        <p className="text-center text-slate-400 text-sm mt-4">
          Scan restaurant QR code, then snap a photo of the menu
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
