import { useState } from 'react';
import LiabilityAgreement from '../components/onboarding/LiabilityAgreement';
import MenuDigitization from '../components/onboarding/MenuDigitization';
import DishDetailsInput from '../components/onboarding/DishDetailsInput';
import FinalReview from '../components/onboarding/FinalReview';

export type OnboardingStep = 'terms' | 'scan' | 'details' | 'review';

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
}

export default function RestaurantOnboarding({ restaurantId }: RestaurantOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('terms');
  const [scannedDishes, setScannedDishes] = useState<ScannedDish[]>([]);

  const handleTermsAccepted = () => {
    setCurrentStep('scan');
  };

  const handleScanComplete = (dishes: ScannedDish[]) => {
    setScannedDishes(dishes);
    setCurrentStep('details');
  };

  const handleDetailsComplete = () => {
    setCurrentStep('review');
  };

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
      {currentStep === 'review' && restaurantId && (
        <FinalReview restaurantId={restaurantId} />
      )}
    </div>
  );
}
