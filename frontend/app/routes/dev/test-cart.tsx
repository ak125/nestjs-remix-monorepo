/**
 * Route de test pour isoler le problème de panier
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AddToCartModern } from "../components/cart/AddToCartModern";

export async function action({ request }: ActionFunctionArgs) {
  console.log("🧪 Test cart action appelée");
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

export default function TestCart() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">🧪 Test Panier avec AddToCartFormFetcher</h1>
      
      <div className="max-w-md mx-auto bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Produit Test</h2>
        <p className="text-gray-600 mb-4">ID: 12345</p>
        <p className="text-lg font-bold mb-6">29,99 €</p>
        
        <AddToCartModern 
          productId="12345" 
          quantity={1}
          className="w-full"
        />
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold mb-2">Instructions :</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Cliquez sur "Ajouter au panier"</li>
          <li>Vérifiez le message de confirmation</li>
          <li>Le message disparaît après 3 secondes</li>
        </ol>
      </div>
    </div>
  );
}