import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";

interface AddToCartFormProps {
  productId: number;
  maxQuantity?: number;
  className?: string;
}

// Types pour les réponses d'actions (identiques à ceux du cart)
interface ActionSuccess {
  success: true;
  message: string;
}

interface ActionError {
  error: string;
  validation?: boolean;
}

type ActionData = ActionSuccess | ActionError;

export function AddToCartForm({ 
  productId, 
  maxQuantity = 99, 
  className = "" 
}: AddToCartFormProps) {
  const [quantity, setQuantity] = useState(1);
  const navigation = useNavigation();
  const actionData = useActionData<ActionData>();

  const isSubmitting = navigation.state === "submitting" && 
    navigation.formData?.get("intent") === "add" &&
    Number(navigation.formData?.get("product_id")) === productId;

  const handleQuantityChange = (newQuantity: number) => {
    const validQuantity = Math.max(1, Math.min(maxQuantity, newQuantity));
    setQuantity(validQuantity);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Contrôle de quantité */}
      <div className="flex items-center justify-center space-x-3">
        <button
          type="button"
          onClick={() => handleQuantityChange(quantity - 1)}
          disabled={quantity <= 1}
          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        
        <input
          type="number"
          min="1"
          max={maxQuantity}
          value={quantity}
          onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
          className="w-16 text-center border rounded py-1"
        />
        
        <button
          type="button"
          onClick={() => handleQuantityChange(quantity + 1)}
          disabled={quantity >= maxQuantity}
          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {/* Formulaire d'ajout au panier */}
      <Form method="post" action="/cart">
        <input type="hidden" name="intent" value="add" />
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="quantity" value={quantity} />
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full font-bold py-2 px-4 rounded transition-colors ${
            isSubmitting
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 text-white'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Ajout en cours...
            </span>
          ) : (
            `Ajouter au panier (${quantity})`
          )}
        </button>
      </Form>

      {/* Message de succès temporaire */}
      {actionData && 'success' in actionData && actionData.success && (
        <div className="text-green-600 text-sm text-center font-medium">
          ✅ {actionData.message}
        </div>
      )}

      {/* Message d'erreur temporaire */}
      {actionData && 'error' in actionData && (
        <div className="text-red-600 text-sm text-center">
          ❌ {actionData.error}
        </div>
      )}
    </div>
  );
}
