/**
 * 💬 Notification de fusion de panier
 * 
 * Affiche un message informatif lorsqu'un panier invité a été fusionné
 * avec un panier utilisateur existant après connexion.
 */

import { useEffect, useState } from 'react';

interface CartMergeInfo {
  merged: boolean;
  guestItems?: number;
  existingItems?: number;
  totalItems?: number;
  message?: string;
  timestamp?: string;
}

export function CartMergeNotification() {
  const [mergeInfo, setMergeInfo] = useState<CartMergeInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Vérifier s'il y a une fusion de panier à afficher
    const checkMergeInfo = async () => {
      try {
        const response = await fetch('/api/cart/merge-info', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data: CartMergeInfo = await response.json();
          
          if (data.merged) {
            setMergeInfo(data);
            setVisible(true);
            
            // Auto-masquer après 8 secondes
            setTimeout(() => {
              setVisible(false);
            }, 8000);
          }
        }
      } catch (error) {
        console.error('Erreur vérification fusion panier:', error);
      }
    };

    checkMergeInfo();
  }, []);

  if (!visible || !mergeInfo) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 max-w-md animate-slide-in">
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-900">
              🛒 Panier fusionné !
            </h3>
            <div className="mt-2 text-sm text-blue-800">
              <p>{mergeInfo.message}</p>
              
              {mergeInfo.guestItems && mergeInfo.existingItems && (
                <div className="mt-2 text-xs bg-blue-100 rounded px-2 py-1">
                  <div className="flex justify-between">
                    <span>Nouveaux articles :</span>
                    <span className="font-semibold">{mergeInfo.guestItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Articles existants :</span>
                    <span className="font-semibold">{mergeInfo.existingItems}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 mt-1 pt-1">
                    <span className="font-semibold">Total :</span>
                    <span className="font-semibold">{mergeInfo.totalItems}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setVisible(false)}
            className="ml-3 flex-shrink-0 inline-flex text-blue-400 hover:text-blue-600"
            aria-label="Fermer"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 📝 Note: Ajouter ces styles CSS dans globals.css ou tailwind.config.js
 * 
 * @keyframes slide-in {
 *   from {
 *     transform: translateX(100%);
 *     opacity: 0;
 *   }
 *   to {
 *     transform: translateX(0);
 *     opacity: 1;
 *   }
 * }
 * 
 * .animate-slide-in {
 *   animation: slide-in 0.3s ease-out;
 * }
 */
