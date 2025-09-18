/**
 * 🎯 EXEMPLE D'USAGE AVANCÉ DE ZOD
 * 
 * Démonstration des différentes façons d'utiliser Zod
 * dans l'application avec des exemples concrets
 * 
 * @author GitHub Copilot
 * @version 2.0.0
 */

import { useState } from 'react';
import { 
  AddToCartRequestSchema, 
  safeValidateAddToCartRequest,
  validateAddToCartRequest,
  type AddToCartRequest 
} from '../types/cart-validation';
import { 
  validateWithSchema, 
  createValidationHook,
  validateFormData,
  logValidationErrors,
  type ValidationResult 
} from '../utils/zod-utils';

// 🎯 EXEMPLE 1: Hook personnalisé pour validation de formulaire

/**
 * Hook personnalisé pour validation du panier
 */
export const useCartValidation = createValidationHook(AddToCartRequestSchema);

/**
 * Composant exemple utilisant le hook de validation
 */
export function CartFormExample() {
  const { validate, errors, isValid, clearErrors } = useCartValidation();
  const [formData, setFormData] = useState<Partial<AddToCartRequest>>({
    product_id: '',
    quantity: 1,
    price: 0,
    name: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = validate(formData);
    if (result.success) {
      console.log('✅ Formulaire valide:', result.data);
      // Ici, envoyer les données au serveur
    } else {
      console.log('❌ Erreurs de validation:', errors);
      logValidationErrors(errors, 'CartForm');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="product_id">ID Produit:</label>
        <input
          id="product_id"
          type="text"
          value={formData.product_id}
          onChange={(e) => setFormData({...formData, product_id: e.target.value})}
          className="border rounded px-2 py-1"
        />
        {errors.find(e => e.field === 'product_id') && (
          <p className="text-red-500 text-sm">
            {errors.find(e => e.field === 'product_id')?.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="quantity">Quantité:</label>
        <input
          id="quantity"
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
          className="border rounded px-2 py-1"
        />
        {errors.find(e => e.field === 'quantity') && (
          <p className="text-red-500 text-sm">
            {errors.find(e => e.field === 'quantity')?.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="price">Prix:</label>
        <input
          id="price"
          type="number"
          step="0.01"
          value={formData.price}
          onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
          className="border rounded px-2 py-1"
        />
        {errors.find(e => e.field === 'price') && (
          <p className="text-red-500 text-sm">
            {errors.find(e => e.field === 'price')?.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="name">Nom du produit:</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="border rounded px-2 py-1"
        />
        {errors.find(e => e.field === 'name') && (
          <p className="text-red-500 text-sm">
            {errors.find(e => e.field === 'name')?.message}
          </p>
        )}
      </div>

      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={!isValid && Object.keys(formData).length > 0}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Ajouter au panier
        </button>
        <button
          type="button"
          onClick={clearErrors}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Effacer erreurs
        </button>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Erreurs de validation:</strong>
          <ul className="mt-2">
            {errors.map((error, index) => (
              <li key={index} className="list-disc list-inside">
                {error.field}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

// 🎯 EXEMPLE 2: Validation API côté client

/**
 * Service pour validation côté client avant envoi API
 */
export class CartValidationService {
  /**
   * Valide une requête d'ajout au panier avant envoi
   */
  static validateBeforeSubmit(data: unknown): ValidationResult<AddToCartRequest> {
    console.log('🛡️ Validation côté client avant envoi API...');
    
    const result = validateWithSchema(AddToCartRequestSchema, data);
    
    if (!result.success) {
      console.error('❌ Validation échouée:', result.errors);
      logValidationErrors(result.errors!, 'ClientValidation');
    } else {
      console.log('✅ Validation réussie:', result.data);
    }
    
    return result;
  }

  /**
   * Valide et nettoie les données avant envoi
   */
  static sanitizeAndValidate(data: unknown): AddToCartRequest | null {
    try {
      // Utilisation de la validation stricte
      return validateAddToCartRequest(data);
    } catch (error) {
      console.error('❌ Données invalides:', error);
      return null;
    }
  }

  /**
   * Validation souple pour feedback utilisateur
   */
  static softValidate(data: unknown) {
    return safeValidateAddToCartRequest(data);
  }
}

// 🎯 EXEMPLE 3: Validation de FormData

/**
 * Fonction pour valider un formulaire HTML standard
 */
export function validateCartFormData(formData: FormData): ValidationResult<AddToCartRequest> {
  console.log('🛡️ Validation FormData...');
  
  const result = validateFormData(AddToCartRequestSchema, formData);
  
  if (!result.success) {
    logValidationErrors(result.errors!, 'FormData');
  }
  
  return result;
}

// 🎯 EXEMPLE 4: Validation en temps réel

/**
 * Hook pour validation en temps réel pendant la saisie
 */
export function useRealTimeValidation(schema: any) {
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);

  const validateRealTime = (inputValue: string) => {
    setValue(inputValue);
    
    const result = validateWithSchema(schema, inputValue);
    
    if (result.success) {
      setErrors([]);
      setIsValid(true);
    } else {
      setErrors(result.errors?.map(e => e.message) || []);
      setIsValid(false);
    }
  };

  return {
    value,
    errors,
    isValid,
    setValue: validateRealTime,
  };
}

// 🎯 EXEMPLE 5: Validation conditionnelle

/**
 * Validation basée sur l'état de l'utilisateur
 */
export function validateBasedOnUserType(
  data: unknown,
  userType: 'guest' | 'authenticated'
): ValidationResult<AddToCartRequest> {
  let schema = AddToCartRequestSchema;
  
  if (userType === 'guest') {
    // Pour les invités, certains champs peuvent être optionnels
    schema = AddToCartRequestSchema.partial({
      description: true,
      image_url: true,
    });
  }
  
  return validateWithSchema(schema, data);
}

// 🎯 EXEMPLE 6: Validation d'API Response

/**
 * Valide la réponse de l'API panier
 */
export function validateApiResponse(response: unknown) {
  // Ici vous pouvez utiliser CartSchema pour valider la réponse
  console.log('🛡️ Validation réponse API:', response);
  
  // Exemple simple - dans un vrai cas, utilisez le CartSchema
  if (typeof response === 'object' && response !== null) {
    return { success: true, data: response };
  }
  
  return { 
    success: false, 
    errors: [{ field: 'response', message: 'Réponse API invalide', code: 'invalid_response' }] 
  };
}

// 🎯 EXEMPLE 7: Middleware de validation

/**
 * Middleware pour valider automatiquement les requêtes
 */
export function createValidationMiddleware<T>(schema: any) {
  return (data: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const result = validateWithSchema(schema, data);
      
      if (result.success) {
        resolve(result.data as T);
      } else {
        reject(new Error(`Validation failed: ${result.errors?.map(e => e.message).join(', ')}`));
      }
    });
  };
}

// Middleware spécifique pour le panier
export const validateCartRequest = createValidationMiddleware<AddToCartRequest>(AddToCartRequestSchema);

// 🎯 EXEMPLE 8: Utilisation avec React Query

/**
 * Hook personnalisé combinant React Query et validation Zod
 */
export function useValidatedCartMutation() {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const addToCart = async (data: unknown) => {
    // Validation côté client d'abord
    const validation = CartValidationService.validateBeforeSubmit(data);
    
    if (!validation.success) {
      const errors = validation.errors?.map(e => e.message) || [];
      setValidationErrors(errors);
      throw new Error('Validation failed');
    }
    
    setValidationErrors([]);
    
    // Envoi à l'API
    const response = await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validation.data),
    });
    
    if (!response.ok) {
      throw new Error('API call failed');
    }
    
    return response.json();
  };

  return {
    addToCart,
    validationErrors,
    clearValidationErrors: () => setValidationErrors([]),
  };
}

// � Ce fichier exporte des exemples d'utilisation de Zod
// Importez les fonctions et composants individuellement selon vos besoins