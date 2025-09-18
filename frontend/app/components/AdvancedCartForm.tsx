/**
 * 🛒 COMPOSANT CART FORM AVEC VALIDATION ZOD AVANCÉE
 * 
 * Exemple d'utilisation des hooks de validation personnalisés
 * Formulaire d'ajout au panier avec validation temps réel
 */

import React, { useState } from 'react';
import { useZodForm, useZodValidation, useZodArrayValidation } from '../hooks/useZodValidation';
import { 
  AddToCartRequestSchema, 
  UpdateQuantityRequestSchema,
  type AddToCartRequest,
  type UpdateQuantityRequest 
} from '../types/cart-validation';

/**
 * Composant principal pour le formulaire de panier avancé
 */
export function AdvancedCartForm() {
  const [submitStatus, setSubmitStatus] = useState<string>('');

  // Utilisation du hook de formulaire avec validation Zod
  const {
    values,
    errors,
    isValid,
    isValidating,
    isSubmitting,
    isDirty,
    setValue,
    handleSubmit,
    reset,
    getFieldProps,
  } = useZodForm<AddToCartRequest>(AddToCartRequestSchema, {
    product_id: '',
    quantity: 1,
    price: 0,
    name: '',
  }, {
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 500,
    mode: 'onChange',
  });

  // Gestion de la soumission
  const onSubmit = async (data: AddToCartRequest) => {
    try {
      setSubmitStatus('Ajout en cours...');
      
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setSubmitStatus(`✅ Article ajouté: ${result.items?.length || 0} articles dans le panier`);
        reset(); // Réinitialiser le formulaire
      } else {
        const error = await response.json();
        setSubmitStatus(`❌ Erreur: ${error.message || 'Échec de l\'ajout'}`);
      }
    } catch (error) {
      setSubmitStatus(`❌ Erreur réseau: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🛒 Formulaire de Panier Avancé
      </h2>

      <form onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(onSubmit);
      }} className="space-y-4">
        
        {/* Champ Product ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID Produit
          </label>
          <input
            {...getFieldProps('product_id')}
            placeholder="ex: product-123"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.product_id 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.product_id && (
            <p className="mt-1 text-sm text-red-600">{errors.product_id}</p>
          )}
        </div>

        {/* Champ Quantité */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantité
          </label>
          <input
            type="number"
            {...getFieldProps('quantity')}
            onChange={(e) => setValue('quantity', parseInt(e.target.value) || 0)}
            min="1"
            max="999"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.quantity 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.quantity && (
            <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
          )}
        </div>

        {/* Champ Prix */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prix (€)
          </label>
          <input
            type="number"
            step="0.01"
            {...getFieldProps('price')}
            onChange={(e) => setValue('price', parseFloat(e.target.value) || 0)}
            min="0"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.price 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.price && (
            <p className="mt-1 text-sm text-red-600">{errors.price}</p>
          )}
        </div>

        {/* Champ Nom */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom du produit
          </label>
          <input
            {...getFieldProps('name')}
            placeholder="Nom du produit"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.name 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Champ Description (optionnel) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optionnel)
          </label>
          <textarea
            {...getFieldProps('description')}
            placeholder="Description du produit..."
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.description 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Statut de validation */}
        <div className="flex items-center space-x-2 text-sm">
          {isValidating && (
            <span className="text-blue-600">🔄 Validation...</span>
          )}
          {isDirty && !isValidating && (
            <span className={isValid ? 'text-green-600' : 'text-red-600'}>
              {isValid ? '✅ Formulaire valide' : '❌ Erreurs de validation'}
            </span>
          )}
        </div>

        {/* Boutons */}
        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={!isValid || isSubmitting || isValidating}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              isValid && !isSubmitting && !isValidating
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? '🔄 Ajout...' : '🛒 Ajouter au panier'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              reset();
              setSubmitStatus('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            🔄 Reset
          </button>
        </div>
      </form>

      {/* Statut de soumission */}
      {submitStatus && (
        <div className="mt-4 p-3 rounded-md bg-gray-50 border">
          <p className="text-sm">{submitStatus}</p>
        </div>
      )}

      {/* Informations de debug */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          🔍 Debug Info
        </summary>
        <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
          <div><strong>Values:</strong> {JSON.stringify(values, null, 2)}</div>
          <div><strong>Errors:</strong> {JSON.stringify(errors, null, 2)}</div>
          <div><strong>State:</strong> Valid: {String(isValid)}, Dirty: {String(isDirty)}, Validating: {String(isValidating)}</div>
        </div>
      </details>
    </div>
  );
}

/**
 * Composant pour validation simple d'une quantité
 */
export function SimpleQuantityValidator() {
  const {
    value,
    error,
    isValidating,
    isValid,
    updateValue,
  } = useZodValidation(UpdateQuantityRequestSchema.shape.quantity, 1);

  return (
    <div className="max-w-sm mx-auto p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">🔢 Validateur de Quantité</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Quantité
        </label>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => updateValue(parseInt(e.target.value) || 0)}
          className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        
        <div className="mt-2 text-sm">
          {isValidating && <span className="text-blue-600">🔄 Validation...</span>}
          {!isValidating && error && <span className="text-red-600">❌ {error}</span>}
          {!isValidating && !error && value && <span className="text-green-600">✅ Valide</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Composant pour validation de liste d'articles
 */
export function CartItemsList() {
  const {
    items,
    errors,
    isValidating,
    isValid,
    addItem,
    updateItem,
    removeItem,
  } = useZodArrayValidation(AddToCartRequestSchema);

  const [newItem, setNewItem] = useState<Partial<AddToCartRequest>>({
    product_id: '',
    quantity: 1,
    name: '',
  });

  const handleAddItem = async () => {
    if (newItem.product_id && newItem.quantity && newItem.name) {
      await addItem(newItem as AddToCartRequest);
      setNewItem({ product_id: '', quantity: 1, name: '' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h3 className="text-xl font-bold mb-4">📋 Liste d'Articles</h3>
      
      {/* Formulaire d'ajout */}
      <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded">
        <input
          placeholder="ID produit"
          value={newItem.product_id || ''}
          onChange={(e) => setNewItem(prev => ({ ...prev, product_id: e.target.value }))}
          className="px-2 py-1 border rounded text-sm"
        />
        <input
          type="number"
          placeholder="Quantité"
          value={newItem.quantity || ''}
          onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
          className="px-2 py-1 border rounded text-sm"
        />
        <input
          placeholder="Nom"
          value={newItem.name || ''}
          onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
          className="px-2 py-1 border rounded text-sm"
        />
        <button
          onClick={handleAddItem}
          className="col-span-3 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          ➕ Ajouter
        </button>
      </div>

      {/* Liste des articles */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className={`p-3 border rounded flex justify-between items-center ${
              errors[index] ? 'border-red-500 bg-red-50' : 'border-gray-200'
            }`}
          >
            <div>
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-gray-600 ml-2">
                ({item.product_id}) × {item.quantity}
              </span>
              {errors[index] && (
                <p className="text-sm text-red-600 mt-1">{errors[index]}</p>
              )}
            </div>
            <button
              onClick={() => removeItem(index)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              🗑️ Supprimer
            </button>
          </div>
        ))}
      </div>

      {/* Statut */}
      <div className="mt-4 text-sm">
        {isValidating && <span className="text-blue-600">🔄 Validation...</span>}
        <span className={`ml-2 ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          {isValid ? '✅ Liste valide' : '❌ Erreurs dans la liste'} ({items.length} articles)
        </span>
      </div>
    </div>
  );
}

export default AdvancedCartForm;