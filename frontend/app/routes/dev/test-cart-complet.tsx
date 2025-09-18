/**
 * Test complet du système de panier moderne avec Fetch API
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AddToCartModern } from "../components/cart/AddToCartModern";
import { CartIconModern } from "../components/cart/CartIconModern";

export async function action({ request }: ActionFunctionArgs) {
  console.log("🧪 Test cart complet action appelée");
  const formData = await request.formData();
  console.log("🧪 FormData:", Object.fromEntries(formData));
  
  const intent = formData.get("intent");
  
  if (intent === "add") {
    const productId = formData.get("product_id");
    const quantity = formData.get("quantity");
    
    try {
      // Appel à l'API backend
      const response = await fetch(`http://localhost:3000/api/cart/test-add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: quantity,
        }),
      });
      
      const result = await response.json();
      console.log("🧪 Réponse API:", result);
      
      if (response.ok) {
        return json({ success: true, message: "✅ Produit ajouté au panier !", data: result });
      } else {
        return json({ success: false, message: "❌ Erreur lors de l'ajout", error: result }, { status: response.status });
      }
    } catch (error) {
      console.error("🧪 Erreur ajout panier:", error);
      return json({ success: false, message: "❌ Erreur de connexion au serveur" }, { status: 500 });
    }
  }
  
  return json({ 
    success: true, 
    message: "Test réussi",
    data: Object.fromEntries(formData)
  });
}

export default function TestCartComplet() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec icône de panier */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">🧪 Test Système Panier Moderne</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Panier :</span>
            <CartIconModern />
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Produit 1 */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Produit Test A</h2>
            <p className="text-gray-600 mb-2">ID: 12345</p>
            <p className="text-lg font-bold mb-4 text-green-600">29,99 €</p>
            <p className="text-sm text-gray-500 mb-6">Produit de test pour vérifier l'ajout au panier</p>
            
            <AddToCartModern 
              productId="12345" 
              quantity={1}
              className="w-full"
            />
          </div>

          {/* Produit 2 */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Produit Test B</h2>
            <p className="text-gray-600 mb-2">ID: 67890</p>
            <p className="text-lg font-bold mb-4 text-green-600">45,50 €</p>
            <p className="text-sm text-gray-500 mb-6">Deuxième produit pour tester les ajouts multiples</p>
            
            <AddToCartModern 
              productId="67890" 
              quantity={2}
              className="w-full"
            />
          </div>

          {/* Produit 3 */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Produit Test C</h2>
            <p className="text-gray-600 mb-2">ID: 11111</p>
            <p className="text-lg font-bold mb-4 text-green-600">12,75 €</p>
            <p className="text-sm text-gray-500 mb-6">Troisième produit avec quantité personnalisée</p>
            
            <AddToCartModern 
              productId="11111" 
              quantity={3}
              className="w-full"
            />
          </div>

          {/* Instructions de test */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4 text-blue-900">🔬 Instructions de Test :</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>Observez le compteur de panier en haut à droite</li>
              <li>Cliquez sur "Ajouter au panier" sur différents produits</li>
              <li>Vérifiez que le compteur se met à jour automatiquement</li>
              <li>Vérifiez les messages de confirmation</li>
              <li>Attendez 3 secondes pour voir les messages disparaître</li>
              <li>Testez plusieurs ajouts rapides pour vérifier la stabilité</li>
            </ol>
            
            <div className="mt-4 p-3 bg-blue-100 rounded">
              <p className="text-xs text-blue-700">
                <strong>Note :</strong> Cette page utilise l'API Fetch moderne 
                au lieu des patterns Remix traditionnels pour une meilleure performance.
              </p>
            </div>
          </div>
        </div>

        {/* Section de statut */}
        <div className="mt-8 bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">📊 Statut du Système</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-900">✅ Backend API</div>
              <div className="text-green-700">Opérationnel</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-900">✅ Fetch API</div>
              <div className="text-green-700">Moderne</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-900">✅ Compteur Auto</div>
              <div className="text-green-700">Actif</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}