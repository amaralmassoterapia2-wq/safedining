import { useEffect, useState } from 'react';
import { supabase, Database } from '../lib/supabase';
import { getOrCreateSessionId } from '../lib/customerSession';
import { Check } from 'lucide-react';
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Dietary Profile</h1>
          <p className="text-slate-600 mb-8">
            Select your dietary requirements to see personalized menu recommendations
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-4">
                Select your dietary restrictions:
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
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="bg-emerald-500 text-white rounded-full p-1">
                            <Check className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <div className={isSelected ? 'text-emerald-600' : 'text-slate-400'}>
                          {getDietaryIcon(restriction.name, 24)}
                        </div>
                        <div className="font-semibold text-slate-900">{restriction.name}</div>
                      </div>
                      {restriction.description && (
                        <div className="text-xs text-slate-600">{restriction.description}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="customAllergens" className="block text-sm font-medium text-slate-700 mb-2">
                Additional allergens or ingredients to avoid (optional)
              </label>
              <input
                id="customAllergens"
                type="text"
                value={customAllergens}
                onChange={(e) => setCustomAllergens(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g., cilantro, mushrooms, bell peppers"
              />
              <p className="text-xs text-slate-600 mt-1">Separate multiple items with commas</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Continue to Menu'}
              </button>
              <button
                type="button"
                onClick={onComplete}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Skip
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
