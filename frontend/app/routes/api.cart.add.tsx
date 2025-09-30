/**
 * 🛒 API ROUTE - Ajout au panier
 * Action pour ajouter des pièces au panier
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const action = formData.get("action") as string;
    
    if (action === "add-to-cart") {
      const productId = formData.get("productId") as string;
      const quantity = parseInt(formData.get("quantity") as string, 10) || 1;
      const productName = formData.get("productName") as string;
      const price = parseFloat(formData.get("price") as string) || 0;

      console.log(`🛒 [ADD-TO-CART] Ajout: productId=${productId}, quantity=${quantity}, price=${price}`);

      // Validation basique
      if (!productId || isNaN(quantity) || quantity <= 0) {
        return json({
          success: false,
          error: "Données invalides"
        }, { status: 400 });
      }

      // Appel à l'API backend
      try {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
        const response = await fetch(`${backendUrl}/api/cart/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Copier les headers d'authentification si présents
            ...(request.headers.get("authorization") && {
              "authorization": request.headers.get("authorization")!
            }),
            // Copier les cookies de session
            ...(request.headers.get("cookie") && {
              "cookie": request.headers.get("cookie")!
            })
          },
          body: JSON.stringify({
            product_id: parseInt(productId, 10),
            quantity: quantity,
            custom_price: price
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ [ADD-TO-CART] Succès:`, result);
          
          return json({
            success: true,
            message: `${productName} ajouté au panier`,
            cart: result,
            productId,
            quantity
          });
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ [ADD-TO-CART] Erreur API:`, response.status, errorData);
          
          return json({
            success: false,
            error: errorData.message || "Erreur lors de l'ajout au panier"
          }, { status: response.status });
        }

      } catch (fetchError) {
        console.error(`❌ [ADD-TO-CART] Erreur réseau:`, fetchError);
        
        // Fallback : simulation d'ajout pour le développement
        return json({
          success: true,
          message: `${productName} ajouté au panier (mode développement)`,
          cart: {
            id: `cart-${Date.now()}`,
            items: [{
              id: `item-${Date.now()}`,
              product_id: productId,
              quantity: quantity,
              price: price,
              product_name: productName,
              total_price: price * quantity
            }],
            summary: {
              total_items: quantity,
              total_price: price * quantity,
              subtotal: price * quantity,
              tax_amount: 0,
              shipping_cost: 0,
              currency: "EUR"
            }
          },
          productId,
          quantity,
          developmentMode: true
        });
      }
    }

    return json({
      success: false,
      error: "Action non supportée"
    }, { status: 400 });

  } catch (error) {
    console.error("❌ [ADD-TO-CART] Erreur générale:", error);
    
    return json({
      success: false,
      error: "Erreur interne du serveur"
    }, { status: 500 });
  }
}

// Pas de loader pour cette route API
export function loader() {
  return json({
    message: "Utilisez POST pour ajouter au panier"
  }, { status: 405 });
}