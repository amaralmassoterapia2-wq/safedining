import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Store, AlertCircle } from 'lucide-react';

interface RestaurantSetupProps {
  onRestaurantCreated: () => void;
}

export default function RestaurantSetup({ onRestaurantCreated }: RestaurantSetupProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const qrCode = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const { error: insertError } = await supabase.from('restaurants').insert({
        name: name.trim(),
        description: description.trim() || null,
        qr_code: qrCode,
        owner_id: user.id,
      });

      if (insertError) {
        throw insertError;
      }

      onRestaurantCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create restaurant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 text-white rounded-full mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome to Your Restaurant Dashboard
          </h1>
          <p className="text-slate-600">
            Let's set up your restaurant profile to get started
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Restaurant Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your restaurant name"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your restaurant"
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? 'Creating...' : 'Create Restaurant Profile'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">What's Next?</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Add menu items with detailed ingredients</li>
              <li>• Specify allergen information and cooking steps</li>
              <li>• Generate a QR code for customers to scan</li>
              <li>• Track accessibility metrics and customer requests</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
