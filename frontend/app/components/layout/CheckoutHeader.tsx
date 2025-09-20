/**
 * 🛒 CHECKOUT HEADER - Header minimal pour processus de commande
 * 
 * Header épuré pour ne pas distraire l'utilisateur pendant le checkout
 */

import { Header } from './Header';

interface CheckoutHeaderProps {
  className?: string;
  step?: string;
  showProgress?: boolean;
}

export function CheckoutHeader({ 
  className, 
  step,
  showProgress = true 
}: CheckoutHeaderProps) {
  return (
    <div>
      <Header 
        context="public"
        variant="minimal"
        theme="default"
        className={className}
      />
      
      {/* Barre de progression optionnelle */}
      {showProgress && step && (
        <div className="bg-blue-50 border-b">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-center">
              <span className="text-sm text-blue-700 font-medium">
                🛒 Étape : {step}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
