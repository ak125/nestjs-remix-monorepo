/**
 * 🛒 ADD TO CART FORM - Version moderne avec Fetch API et validation Zod
 */

import { useState } from "react";
import { 
  AddToCartRequestSchema, 
  safeValidateAddToCartRequest, 
  type AddToCartRequest 
} from "../../types/cart-validation";

interface AddToCartModernProps {
  productId: string;
  productName?: string;
  price?: number;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  onCartUpdate?: () => void; // Callback pour notifier la mise à jour du panier
}

export function AddToCartModern({ 
  productId, 
  productName = "Produit",
  price = 0,
  quantity = 1, 
  disabled = false,
  className = "",
  onCartUpdate
}: AddToCartModernProps) {
  const [currentQuantity, setCurrentQuantity] = useState(quantity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // 🚀 Fonction moderne avec Fetch API native et validation Zod
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setShowMessage(false);
    setValidationErrors([]);
    
    try {
      // 🛡️ Validation Zod côté client
      const requestData: AddToCartRequest = {
        product_id: productId,
        quantity: Number(currentQuantity),
        price: Number(price),
        name: productName,
      };

      const validation = safeValidateAddToCartRequest(requestData);
      
      if (!validation.success) {
        const errors = validation.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        setValidationErrors(errors);
        setMessage("❌ Données invalides");
        setIsSuccess(false);
        setShowMessage(true);
        return;
      }

      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });
      
      const result = await response.json();
      console.log("🛒 AddToCartModern - Réponse API /cart/items:", result);
      
      if (response.ok) {
        // API réelle réussie (status 200/201)
        setMessage("✅ Produit ajouté au panier !");
        setIsSuccess(true);
        setIsSuccess(true);
        setShowMessage(true);
        
        // 🔄 Notifier la mise à jour du panier (pour rafraîchir le compteur)
        if (onCartUpdate) {
          onCartUpdate();
        }
        
        // 🔄 Rafraîchir l'icône panier globalement
        if ((window as any).refreshCartIcon) {
          (window as any).refreshCartIcon();
        }
        
        // Effacer le message après 3 secondes
        setTimeout(() => {
          setShowMessage(false);
        }, 3000);
        
      } else {
        setMessage(`❌ ${result.message || "Erreur lors de l'ajout"}`);
        setIsSuccess(false);
        setShowMessage(true);
        
        setTimeout(() => {
          setShowMessage(false);
        }, 5000);
      }
    } catch (error) {
      console.error("Erreur ajout panier:", error);
      setMessage("❌ Erreur de connexion au serveur");
      setIsSuccess(false);
      setShowMessage(true);
      
      setTimeout(() => {
        setShowMessage(false);
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
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
          value={currentQuantity}
          onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
          className="w-16 text-center border rounded px-2 py-1"
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
      
      {showMessage && (
        <div className={`text-sm p-2 rounded ${
          isSuccess 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        }`}>
          {message}
          {validationErrors.length > 0 && (
            <ul className="mt-2 text-xs">
              {validationErrors.map((error, index) => (
                <li key={index} className="list-disc list-inside">
                  {error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}