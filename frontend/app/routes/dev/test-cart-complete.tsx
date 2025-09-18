/**
 * Test complet du système de panier moderne avec Fetch API
 * Teste AddToCartModern + CartIconModern + communication globale
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AddToCartModern } from "../components/cart/AddToCartModern";
import { CartIconModern } from "../components/cart/CartIconModern";

export async function action({ request }: ActionFunctionArgs) {
  console.log("🧪 Test cart complete action appelée");
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

export default function TestCartComplete() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec icône panier */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">🧪 Test Panier Complet</h1>
            </div>
            <div className="flex items-center space-x-4">
              <CartIconModern />
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Produit 1 */}
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-2">Produit Test 1</h2>
              <p className="text-gray-600 mb-2">ID: 12345</p>
              <p className="text-lg font-bold mb-4">29,99 €</p>
              <AddToCartModern 
                productId="12345" 
                quantity={1}
                className="w-full"
              />
            </div>

            {/* Produit 2 */}
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-2">Produit Test 2</h2>
              <p className="text-gray-600 mb-2">ID: 67890</p>
              <p className="text-lg font-bold mb-4">49,99 €</p>
              <AddToCartModern 
                productId="67890" 
                quantity={2}
                className="w-full"
              />
            </div>

            {/* Produit 3 */}
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-2">Produit Test 3</h2>
              <p className="text-gray-600 mb-2">ID: 11111</p>
              <p className="text-lg font-bold mb-4">19,99 €</p>
              <AddToCartModern 
                productId="11111" 
                quantity={3}
                className="w-full"
              />
            </div>
          </div>

          {/* Instructions de test */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Instructions de Test</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">Test AddToCartModern :</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                  <li>Cliquez sur "Ajouter au panier" sur chaque produit</li>
                  <li>Vérifiez les messages de confirmation</li>
                  <li>Testez avec différentes quantités</li>
                  <li>Observez la réactivité des boutons</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">Test CartIconModern :</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                  <li>Regardez l'icône panier en haut à droite</li>
                  <li>Elle devrait se mettre à jour automatiquement</li>
                  <li>Le compteur doit refléter les ajouts</li>
                  <li>Testez la mise à jour en temps réel</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Statut technique */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">✅ Fonctionnalités Modernes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-sm">
                <h4 className="font-semibold text-green-800">Fetch API Native</h4>
                <p className="text-green-700">Remplacement d'AJAX/XMLHttpRequest</p>
              </div>
              <div className="text-sm">
                <h4 className="font-semibold text-green-800">Communication Globale</h4>
                <p className="text-green-700">window.refreshCartIcon pour sync</p>
              </div>
              <div className="text-sm">
                <h4 className="font-semibold text-green-800">Mise à jour Auto</h4>
                <p className="text-green-700">CartIcon se rafraîchit automatiquement</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}