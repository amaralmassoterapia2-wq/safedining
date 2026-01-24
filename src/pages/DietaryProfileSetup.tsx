import { useEffect, useState } from 'react';
import { supabase, Database } from '../lib/supabase';
import { getOrCreateSessionId } from '../lib/customerSession';
import { Check, Shield, ChevronRight } from 'lucide-react';
import { getDietaryIcon } from '../components/icons/DietaryIcons';

type DietaryRestriction = Database['public']['Tables']['dietary_restrictions']['Row'];

interface DietaryProfileSetupProps {
  onComplete: () => void;
}

export default function DietaryProfileSetup({ onComplete }: DietaryProfileSetupProps) {
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>([]);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [customAllergens, setCustomAllergens] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRestrictions();
    loadExistingProfile();
  }, []);

  const loadRestrictions = async () => {
    const { data } = await supabase
      .from('dietary_restrictions')
      .select('*')
      .order('name');

    if (data) {
      setRestrictions(data);
    }
    setLoading(false);
  };

  const loadExistingProfile = async () => {
    const sessionId = getOrCreateSessionId();
    const { data } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (data) {
      setSelectedRestrictions(data.dietary_restrictions);
      setCustomAllergens(data.custom_allergens.join(', '));
    }
  };

  const toggleRestriction = (name: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const sessionId = getOrCreateSessionId();
    const customAllergensList = customAllergens
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    const { data: existing } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('customer_profiles')
        .update({
          dietary_restrictions: selectedRestrictions,
          custom_allergens: customAllergensList,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('customer_profiles').insert({
        session_id: sessionId,
        dietary_restrictions: selectedRestrictions,
        custom_allergens: customAllergensList,
      });
    }

    setSaving(false);
    onComplete();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Safe Dining</h1>
              <p className="text-sm text-slate-400">Dietary Profile Setup</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
            <h2 className="text-2xl font-bold text-white">Your Dietary Profile</h2>
            <p className="text-emerald-100 mt-1">
              Select your dietary requirements for personalized menu recommendations
            </p>
          </div>

          {/* Card Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">
                Dietary Restrictions
              </label>
              <div className="grid grid-cols-2 gap-3">
                {restrictions.map((restriction) => {
                  const isSelected = selectedRestrictions.includes(restriction.name);
                  return (
                    <button
                      key={restriction.id}
                      type="button"
                      onClick={() => toggleRestriction(restriction.name)}
                      className={`relative p-4 border-2 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="bg-emerald-500 text-white rounded-full p-1 shadow-sm">
                            <Check className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-1">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {getDietaryIcon(restriction.name, 20)}
                        </div>
                        <div className="font-semibold text-slate-900">{restriction.name}</div>
                      </div>
                      {restriction.description && (
                        <div className="text-xs text-slate-500 ml-11">{restriction.description}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <label htmlFor="customAllergens" className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Additional Allergens
              </label>
              <p className="text-sm text-slate-500 mb-3">
                Add any other ingredients you need to avoid
              </p>
              <input
                id="customAllergens"
                type="text"
                value={customAllergens}
                onChange={(e) => setCustomAllergens(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="e.g., cilantro, mushrooms, bell peppers"
              />
              <p className="text-xs text-slate-400 mt-2">Separate multiple items with commas</p>
            </div>

            {/* Summary */}
            {(selectedRestrictions.length > 0 || customAllergens.trim()) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Your Selections</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRestrictions.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full"
                    >
                      {getDietaryIcon(name, 14)}
                      {name}
                    </span>
                  ))}
                  {customAllergens.split(',').filter(a => a.trim()).map((allergen) => (
                    <span
                      key={allergen.trim()}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-full"
                    >
                      {allergen.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Continue to Menu'}
                {!saving && <ChevronRight className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onComplete}
                className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Skip
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
