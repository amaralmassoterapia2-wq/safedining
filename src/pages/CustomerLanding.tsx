import { useState } from 'react';
import { Camera, Utensils } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-lg">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-lg">
            <Utensils className="w-16 h-16 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-center text-slate-900 mb-3">
          Safe Dining
        </h1>
        <p className="text-center text-slate-600 text-lg mb-10">
          Get instant allergen information for your meal
        </p>

        <button
          onClick={() => setShowScanner(true)}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-5 rounded-2xl font-bold text-lg hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
        >
          <Camera className="w-7 h-7" />
          Scan Restaurant Menu
        </button>
      </div>

      <button
        onClick={onSwitchToRestaurantMode}
        className="mt-8 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        For Restaurant Owners
      </button>
    </div>
  );
}
