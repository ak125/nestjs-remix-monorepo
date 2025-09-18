/**
 * 🧪 PAGE DE TEST POUR VALIDATION ZOD AVANCÉE
 * 
 * Page de démonstration des composants et hooks de validation
 */

import React from 'react';
import { AdvancedCartForm, SimpleQuantityValidator, CartItemsList } from '../components/AdvancedCartForm';

export default function ZodValidationTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        
        {/* En-tête */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🛡️ Tests de Validation Zod Avancée
          </h1>
          <p className="text-lg text-gray-600">
            Démonstration des hooks et composants de validation en temps réel
          </p>
        </div>

        {/* Grille de composants */}
        <div className="grid gap-8">
          
          {/* Formulaire principal */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
              📝 Formulaire de Panier Complet
            </h2>
            <AdvancedCartForm />
          </section>

          {/* Grille de composants plus petits */}
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Validateur simple */}
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                🎯 Validation Simple
              </h2>
              <SimpleQuantityValidator />
            </section>

            {/* Instructions */}
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                📋 Instructions
              </h2>
              <div className="max-w-sm mx-auto p-4 bg-white rounded-lg shadow">
                <ul className="space-y-2 text-sm">
                  <li>✅ <strong>Validation temps réel :</strong> Les erreurs apparaissent automatiquement</li>
                  <li>🔄 <strong>Debounce :</strong> Validation après 500ms d'inactivité</li>
                  <li>🎯 <strong>Mode onChange :</strong> Validation à chaque modification</li>
                  <li>🛡️ <strong>Type safety :</strong> TypeScript + Zod complets</li>
                  <li>🚀 <strong>Performance :</strong> Cache et optimisations</li>
                </ul>
              </div>
            </section>
          </div>

          {/* Liste d'articles */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
              📋 Validation de Liste
            </h2>
            <CartItemsList />
          </section>

          {/* Informations techniques */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🔧 Détails Techniques
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Fonctionnalités */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-blue-600">
                  ✨ Fonctionnalités
                </h3>
                <ul className="space-y-1 text-sm">
                  <li>• <code>useZodForm</code> - Gestion complète de formulaire</li>
                  <li>• <code>useZodValidation</code> - Validation simple</li>
                  <li>• <code>useZodArrayValidation</code> - Validation de listes</li>
                  <li>• <code>useAsyncZodValidation</code> - Validation asynchrone</li>
                  <li>• Debounce configurable</li>
                  <li>• Cache de validation</li>
                  <li>• Gestion d'état optimisée</li>
                </ul>
              </div>

              {/* Schémas Zod */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-600">
                  🛡️ Schémas de Validation
                </h3>
                <ul className="space-y-1 text-sm">
                  <li>• <code>ProductIdSchema</code> - ID produit</li>
                  <li>• <code>QuantitySchema</code> - Quantité (1-999)</li>
                  <li>• <code>PriceSchema</code> - Prix (≥0, 2 décimales)</li>
                  <li>• <code>ProductNameSchema</code> - Nom produit</li>
                  <li>• <code>AddToCartRequestSchema</code> - Requête complète</li>
                  <li>• Validation URL pour images</li>
                  <li>• Contraintes de longueur</li>
                </ul>
              </div>
            </div>

            {/* Code examples */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3 text-purple-600">
                💻 Exemple d'Usage
              </h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
{`const { values, errors, isValid, handleSubmit } = useZodForm(
  AddToCartRequestSchema,
  { product_id: '', quantity: 1 },
  { validateOnChange: true, debounceMs: 500 }
);`}
              </pre>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p>🚀 Système de validation Zod avancé pour React + NestJS</p>
          <p className="text-sm mt-1">Type-safe, performant, et facile à utiliser</p>
        </div>
      </div>
    </div>
  );
}