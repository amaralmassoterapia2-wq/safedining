import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LiabilityAgreement from '../components/onboarding/LiabilityAgreement';
import MenuDigitization from '../components/onboarding/MenuDigitization';
import DishDetailsInput from '../components/onboarding/DishDetailsInput';
import ChefModifications from '../components/onboarding/ChefModifications';
import FinalReview from '../components/onboarding/FinalReview';

export type OnboardingStep = 'loading' | 'terms' | 'scan' | 'details' | 'modifications' | 'review';

export interface ScannedDish {
  id: string;
  name: string;
  category: string;
  price: string;
  description?: string;
  completed?: boolean;
}

interface RestaurantOnboardingProps {
  restaurantId: string;
  onComplete?: () => void;
}

export default function RestaurantOnboarding({ restaurantId, onComplete }: RestaurantOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('loading');
  const [scannedDishes, setScannedDishes] = useState<ScannedDish[]>([]);

  // Check if terms are already accepted
  useEffect(() => {
    const checkTermsStatus = async () => {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('terms_accepted')
        .eq('id', restaurantId)
        .single();

      if (restaurant?.terms_accepted) {
        setCurrentStep('scan'); // Skip terms if already accepted
      } else {
        setCurrentStep('terms');
      }
    };

    checkTermsStatus();
  }, [restaurantId]);

  const handleTermsAccepted = () => {
    setCurrentStep('scan');
  };

  const handleScanComplete = (dishes: ScannedDish[]) => {
    setScannedDishes(dishes);
    setCurrentStep('details');
  };

  const handleDetailsComplete = () => {
    setCurrentStep('modifications');
  };

  const handleModificationsComplete = () => {
    setCurrentStep('review');
  };

  const handleBackToDetails = () => {
    setCurrentStep('details');
  };

  const handleBackToModifications = () => {
    setCurrentStep('modifications');
  };

  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {currentStep === 'terms' && restaurantId && (
        <LiabilityAgreement
          restaurantId={restaurantId}
          onAccept={handleTermsAccepted}
        />
      )}
      {currentStep === 'scan' && restaurantId && (
        <MenuDigitization
          restaurantId={restaurantId}
          onComplete={handleScanComplete}
        />
      )}
      {currentStep === 'details' && restaurantId && (
        <DishDetailsInput
          restaurantId={restaurantId}
          dishes={scannedDishes}
          onComplete={handleDetailsComplete}
        />
      )}
      {currentStep === 'modifications' && restaurantId && (
        <ChefModifications
          restaurantId={restaurantId}
          onBack={handleBackToDetails}
          onComplete={handleModificationsComplete}
        />
      )}
      {currentStep === 'review' && restaurantId && (
        <FinalReview restaurantId={restaurantId} onBack={handleBackToModifications} onComplete={onComplete} />
      )}
    </div>
  );
}
