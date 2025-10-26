/**
 * PurchaseGuideStepper - Guidage achat progressif 4 étapes
 * 
 * Stepper visuel pour guider l'utilisateur dans le parcours d'achat:
 * 1. Sélection véhicule
 * 2. Catalogue/recherche pièces
 * 3. Panier/validation
 * 4. Paiement/confirmation
 * 
 * Features:
 * - Progression visuelle claire (1/4, 2/4, 3/4, 4/4)
 * - Navigation entre étapes
 * - Validation avant passage étape suivante
 * - Indicateur étape active, complétée, à venir
 * - Responsive mobile-first
 * 
 * Design System: Primary (étape active), Success (complété), Secondary (à venir), Neutral (fond)
 * Typographie: font-heading (titres étapes), font-sans (descriptions)
 * Espacement: 8px grid (gap-md, p-lg)
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export type PurchaseStep = 'vehicle' | 'catalog' | 'cart' | 'payment';

export interface StepConfig {
  id: PurchaseStep;
  label: string;
  shortLabel?: string; // Pour mobile
  description: string;
  icon: string;
}

export interface PurchaseGuideStepperProps {
  /** Étape actuellement active */
  currentStep: PurchaseStep;
  
  /** Étapes complétées (peuvent être revisitées) */
  completedSteps?: PurchaseStep[];
  
  /** Callback changement étape */
  onStepChange?: (step: PurchaseStep) => void;
  
  /** Valider une étape avant passage suivante (retourne true si OK) */
  validateStep?: (step: PurchaseStep) => boolean;
  
  /** Désactiver navigation manuelle (mode linéaire uniquement) */
  disableManualNavigation?: boolean;
  
  /** Afficher descriptions étapes */
  showDescriptions?: boolean;
  
  /** Mode compact (pour header) */
  compact?: boolean;
  
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
}

// ============================================================================
// Configuration des étapes
// ============================================================================

const DEFAULT_STEPS: StepConfig[] = [
  {
    id: 'vehicle',
    label: '1. Sélection véhicule',
    shortLabel: 'Véhicule',
    description: 'Choisissez votre véhicule pour voir les pièces compatibles',
    icon: '🚗',
  },
  {
    id: 'catalog',
    label: '2. Recherche pièces',
    shortLabel: 'Catalogue',
    description: 'Parcourez notre catalogue de pièces compatibles',
    icon: '🔍',
  },
  {
    id: 'cart',
    label: '3. Validation panier',
    shortLabel: 'Panier',
    description: 'Vérifiez vos articles et options de livraison',
    icon: '🛒',
  },
  {
    id: 'payment',
    label: '4. Paiement',
    shortLabel: 'Paiement',
    description: 'Finalisez votre commande en toute sécurité',
    icon: '💳',
  },
];

// ============================================================================
// Composant principal
// ============================================================================

export const PurchaseGuideStepper: React.FC<PurchaseGuideStepperProps> = ({
  currentStep,
  completedSteps = [],
  onStepChange,
  validateStep,
  disableManualNavigation = false,
  showDescriptions = true,
  compact = false,
  orientation = 'horizontal',
}) => {
  // Trouver index étape active
  const currentIndex = DEFAULT_STEPS.findIndex((s) => s.id === currentStep);

  // Déterminer si une étape est cliquable
  const isStepClickable = (stepId: PurchaseStep, stepIndex: number): boolean => {
    if (disableManualNavigation) return false;
    if (stepId === currentStep) return false; // Déjà active
    if (completedSteps.includes(stepId)) return true; // Complétée = revisitable
    return stepIndex < currentIndex; // Étapes précédentes
  };

  // Handler click étape
  const handleStepClick = (step: StepConfig, stepIndex: number) => {
    if (!isStepClickable(step.id, stepIndex)) return;
    
    // Valider étape actuelle si on avance
    if (stepIndex > currentIndex && validateStep) {
      const isValid = validateStep(currentStep);
      if (!isValid) return;
    }
    
    onStepChange?.(step.id);
  };

  // Helper: Status d'une étape
  const getStepStatus = (
    stepId: PurchaseStep,
    _stepIndex: number
  ): 'completed' | 'active' | 'upcoming' => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'upcoming';
  };

  // Classes CSS selon status
  const getStepClasses = (stepId: PurchaseStep, stepIndex: number) => {
    const status = getStepStatus(stepId, stepIndex);
    const isClickable = isStepClickable(stepId, stepIndex);

    const baseClasses = 'flex-1 transition-all duration-300';

    const statusClasses = {
      completed: 'bg-success-50 border-success-500 text-success-700',
      active: 'bg-primary-50 border-primary-500 text-primary-700',
      upcoming: 'bg-neutral-100 border-neutral-300 text-neutral-500',
    }[status];

    const interactionClasses = isClickable
      ? 'cursor-pointer hover:shadow-md hover:scale-105'
      : 'cursor-default';

    return `${baseClasses} ${statusClasses} ${interactionClasses}`;
  };

  // Render mode horizontal (défaut)
  if (orientation === 'horizontal') {
    return (
      <div className="w-full">
        <div className="flex items-stretch gap-md">
          {DEFAULT_STEPS.map((step, index) => {
            const status = getStepStatus(step.id, index);
            const isClickable = isStepClickable(step.id, index);

            return (
              <div
                key={step.id}
                className={`
                  ${getStepClasses(step.id, index)}
                  ${compact ? 'p-sm' : 'p-md'}
                  border-2 rounded-lg
                  flex flex-col items-center text-center
                `}
                onClick={() => handleStepClick(step, index)}
                role="button"
                tabIndex={isClickable ? 0 : -1}
                aria-current={status === 'active' ? 'step' : undefined}
                aria-disabled={!isClickable}
              >
                {/* Icône + numéro */}
                <div className={`${compact ? 'text-2xl mb-xs' : 'text-3xl mb-sm'}`}>
                  {status === 'completed' ? '✅' : step.icon}
                </div>

                {/* Label */}
                <h3
                  className={`font-heading ${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'} font-bold`}
                >
                  <span className="hidden md:inline">{step.label}</span>
                  <span className="md:hidden">{step.shortLabel || step.label}</span>
                </h3>

                {/* Description (optionnelle, cachée sur mobile/compact) */}
                {!compact && showDescriptions && (
                  <p className="font-sans text-xs mt-xs hidden lg:block opacity-75">
                    {step.description}
                  </p>
                )}

                {/* Badge "Actif" */}
                {status === 'active' && !compact && (
                  <span className="mt-sm bg-primary-500 text-white text-xs px-sm py-xs rounded-full font-bold">
                    En cours
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Barre de progression */}
        {!compact && (
          <div className="mt-md bg-neutral-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary-500 h-full transition-all duration-500 ease-out"
              style={{
                width: `${((currentIndex + 1) / DEFAULT_STEPS.length) * 100}%`,
              }}
              role="progressbar"
              aria-valuenow={currentIndex + 1}
              aria-valuemin={1}
              aria-valuemax={DEFAULT_STEPS.length}
              aria-label={`Étape ${currentIndex + 1} sur ${DEFAULT_STEPS.length}`}
            />
          </div>
        )}
      </div>
    );
  }

  // Render mode vertical
  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col gap-md">
        {DEFAULT_STEPS.map((step, index) => {
          const status = getStepStatus(step.id, index);
          const isClickable = isStepClickable(step.id, index);

          return (
            <div
              key={step.id}
              className={`
                ${getStepClasses(step.id, index)}
                p-lg border-2 rounded-lg
                flex items-start gap-md
              `}
              onClick={() => handleStepClick(step, index)}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              aria-current={status === 'active' ? 'step' : undefined}
              aria-disabled={!isClickable}
            >
              {/* Icône */}
              <div className="text-3xl flex-shrink-0">
                {status === 'completed' ? '✅' : step.icon}
              </div>

              {/* Contenu */}
              <div className="flex-1">
                <h3 className="font-heading text-base font-bold mb-xs">{step.label}</h3>
                {showDescriptions && (
                  <p className="font-sans text-sm opacity-75">{step.description}</p>
                )}
                {status === 'active' && (
                  <span className="inline-block mt-sm bg-primary-500 text-white text-xs px-sm py-xs rounded-full font-bold">
                    En cours
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Hook utilitaire - Gestion état stepper
// ============================================================================

export interface UseStepperReturn {
  currentStep: PurchaseStep;
  completedSteps: PurchaseStep[];
  goToStep: (step: PurchaseStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  completeCurrentStep: () => void;
  resetStepper: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

/**
 * Hook pour gérer l'état du stepper facilement
 */
export const usePurchaseStepper = (
  initialStep: PurchaseStep = 'vehicle'
): UseStepperReturn => {
  const [currentStep, setCurrentStep] = React.useState<PurchaseStep>(initialStep);
  const [completedSteps, setCompletedSteps] = React.useState<PurchaseStep[]>([]);

  const currentIndex = DEFAULT_STEPS.findIndex((s) => s.id === currentStep);

  const goToStep = React.useCallback((step: PurchaseStep) => {
    setCurrentStep(step);
  }, []);

  const nextStep = React.useCallback(() => {
    if (currentIndex < DEFAULT_STEPS.length - 1) {
      const nextStep = DEFAULT_STEPS[currentIndex + 1];
      setCurrentStep(nextStep.id);
    }
  }, [currentIndex]);

  const previousStep = React.useCallback(() => {
    if (currentIndex > 0) {
      const prevStep = DEFAULT_STEPS[currentIndex - 1];
      setCurrentStep(prevStep.id);
    }
  }, [currentIndex]);

  const completeCurrentStep = React.useCallback(() => {
    setCompletedSteps((prev) => {
      if (prev.includes(currentStep)) return prev;
      return [...prev, currentStep];
    });
  }, [currentStep]);

  const resetStepper = React.useCallback(() => {
    setCurrentStep(initialStep);
    setCompletedSteps([]);
  }, [initialStep]);

  return {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    previousStep,
    completeCurrentStep,
    resetStepper,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === DEFAULT_STEPS.length - 1,
    canGoNext: currentIndex < DEFAULT_STEPS.length - 1,
    canGoPrevious: currentIndex > 0,
  };
};

// ============================================================================
// Export
// ============================================================================

export default PurchaseGuideStepper;
