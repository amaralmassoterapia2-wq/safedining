import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface QRCodeScannerProps {
  onScanSuccess: (qrCode: string) => void;
  onClose: () => void;
}

export default function QRCodeScanner({ onScanSuccess, onClose }: QRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setError('');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopScanner();
          onScanSuccess(decodedText);
        },
        () => {
          // Ignore scan errors (happens continuously while scanning)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      if (err instanceof Error) {
        if (err.message.includes('Permission denied')) {
          setError('Camera permission denied. Please enable camera access in your browser settings.');
        } else if (err.message.includes('NotFoundError')) {
          setError('No camera found on this device.');
        } else {
          setError('Unable to access camera. Please try again.');
        }
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6" />
          <div>
            <h2 className="font-semibold">Scan QR Code</h2>
            <p className="text-sm text-slate-300">Point camera at restaurant QR code</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black">
        {error ? (
          <div className="max-w-md mx-auto p-6 text-center">
            <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 mb-4">
              <p className="text-white">{error}</p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md px-4">
            <div id="qr-reader" className="rounded-xl overflow-hidden shadow-2xl" />
            <p className="text-white text-center mt-6 text-sm">
              Position the QR code within the frame
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
