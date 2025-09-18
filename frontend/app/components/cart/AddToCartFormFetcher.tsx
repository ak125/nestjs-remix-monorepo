/**
 * 🛒 ADD TO CART FORM - Version avec fetcher pour éviter les timeouts
 */

import { useFetcher, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";

interface AddToCartFormFetcherProps {
  productId: string | number;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  redirectAfterAdd?: boolean; // Nouvelle option
  redirectUrl?: string; // URL de redirection personnalisée
}

export function AddToCartFormFetcher({ 
  productId, 
  quantity = 1, 
  disabled = false,
  className = ""
}: AddToCartFormFetcherProps) {
  const fetcher = useFetcher();
  const [currentQuantity, setCurrentQuantity] = useState(quantity);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const isSubmitting = fetcher.state === "submitting";
  
  // Effacer le message de succès après 3 secondes
  useEffect(() => {
    if (fetcher.data && (fetcher.data as any)?.success) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);
  
  const handleSubmit = () => {
    // Utiliser l'action Remix comme proxy vers l'API backend
    fetcher.submit(
      {
        intent: "add",
        product_id: String(productId),
        quantity: String(currentQuantity)
      },
      {
        method: "post"
        // Pas d'action spécifiée = utilise l'action de la route courante
      }
    );
  };

  return (
    <div className={`space-y-3 w-full ${className}`}>
      <div className="flex items-center justify-center space-x-3">
        <button
          type="button"
          disabled={currentQuantity <= 1 || isSubmitting}
          onClick={() => setCurrentQuantity(Math.max(1, currentQuantity - 1))}
          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        
        <input
          type="number"
          min="1"
          max="10"
          className="w-16 text-center border rounded py-1"
          value={currentQuantity}
          onChange={(e) => setCurrentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={isSubmitting}
        />
        
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => setCurrentQuantity(currentQuantity + 1)}
          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
      
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isSubmitting}
        className={`w-full font-bold py-2 px-4 rounded transition-colors ${
          isSubmitting
            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
            : disabled
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-700 text-white"
        }`}
      >
        {isSubmitting 
          ? "Ajout en cours..." 
          : `Ajouter au panier (${currentQuantity})`
        }
      </button>
      
      {(fetcher.data && showSuccess) && (
        <div className={`text-sm p-2 rounded ${
          (fetcher.data as any)?.success 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        }`}>
          {(fetcher.data as any)?.message || "Action terminée"}
        </div>
      )}
    </div>
  );
}