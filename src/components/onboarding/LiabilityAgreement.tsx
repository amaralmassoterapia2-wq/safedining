import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, AlertTriangle, Check } from 'lucide-react';

interface LiabilityAgreementProps {
  restaurantId: string;
  onAccept: () => void;
}

export default function LiabilityAgreement({ restaurantId, onAccept }: LiabilityAgreementProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!agreed) return;

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (updateError) throw updateError;

      onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save terms acceptance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-slate-900 p-4 rounded-2xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
          Terms of Service
        </h1>
        <p className="text-center text-slate-600 mb-8">
          Please read and accept our terms before continuing
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-amber-900 mb-2 text-lg">
                Important Legal Notice
              </h3>
              <p className="text-amber-900 text-sm leading-relaxed">
                This section contains critical information about liability and responsibilities.
                Please read carefully before proceeding.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6 max-h-96 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Terms of Service Agreement</h2>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">1. Information Accuracy and Responsibility</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>This tool displays information provided directly by the restaurant.</strong> Safe Dining
              does not verify the accuracy of ingredient lists, preparation methods, nutritional information,
              or any other data entered into the system. The restaurant is <strong>solely and completely responsible</strong> for:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4 space-y-2">
              <li>The accuracy and completeness of all ingredient information</li>
              <li>Proper identification of all allergens in dishes</li>
              <li>Accurate description of cooking processes and cross-contamination risks</li>
              <li>Maintaining up-to-date information when recipes or suppliers change</li>
              <li>Training staff to handle customer inquiries about allergens</li>
            </ul>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">2. Limitation of Liability</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Safe Dining <strong>cannot and does not guarantee</strong> the absence of cross-contamination,
              allergens, or any other food safety concerns. This platform is provided as an information display
              tool only. Safe Dining assumes no liability for:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4 space-y-2">
              <li>Allergic reactions or adverse health events resulting from information displayed</li>
              <li>Errors, omissions, or inaccuracies in restaurant-provided data</li>
              <li>Changes to recipes or ingredients not updated in the system</li>
              <li>Cross-contamination during food preparation</li>
              <li>Any health consequences arising from the use of this platform</li>
            </ul>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">3. Restaurant Obligations</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              By using this service, the restaurant agrees to:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4 space-y-2">
              <li>Provide accurate, complete, and current information about all menu items</li>
              <li>Update information immediately when recipes, suppliers, or processes change</li>
              <li>Implement proper food safety protocols in the kitchen</li>
              <li>Train staff to understand allergen risks and customer needs</li>
              <li>Verify customer dietary requirements directly with guests when requested</li>
              <li>Comply with all applicable food safety regulations and laws</li>
            </ul>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">4. Guest Safety</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              The restaurant acknowledges that this tool is a <strong>supplementary information resource</strong>
              and does not replace direct communication with guests about their dietary needs. Restaurant staff
              must always be prepared to discuss allergens, ingredients, and preparation methods with customers.
            </p>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">5. Acceptance</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              By checking the box below and continuing, you confirm that you have read, understood, and accept
              full responsibility for the information entered into this system and the safety of your guests.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors mb-6">
          <div className="relative flex-shrink-0 mt-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
            {agreed && (
              <Check className="w-4 h-4 text-white absolute top-0.5 left-0.5 pointer-events-none" />
            )}
          </div>
          <div className="text-sm text-slate-700 leading-relaxed">
            I have read and agree to the Terms of Service. I understand that my restaurant is solely
            responsible for the accuracy of all information entered into this system and the safety of
            our guests.
          </div>
        </label>

        <button
          onClick={handleContinue}
          disabled={!agreed || loading}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Accept Terms and Continue'}
        </button>
      </div>
    </div>
  );
}
