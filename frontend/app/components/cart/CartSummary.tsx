/**
 * 🛒 CART SUMMARY COMPONENT - Résumé du panier
 */

import  { type Cart } from "~/services/cart.server";

interface CartSummaryProps {
  cart: Cart;
  children?: React.ReactNode;
}

export function CartSummary({ cart, children }: CartSummaryProps) {
  const { totals } = cart;

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Résumé de la commande</h2>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span>Sous-total ({totals.total_items} articles)</span>
          <span>{totals.subtotal.toFixed(2)} €</span>
        </div>
        
        {totals.discount_amount && totals.discount_amount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Réduction</span>
            <span>-{totals.discount_amount.toFixed(2)} €</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span>Livraison</span>
          <span>
            {totals.shipping_cost === 0 ? 'Gratuite' : `${totals.shipping_cost.toFixed(2)} €`}
          </span>
        </div>
        
        {totals.tax_amount > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>TVA</span>
            <span>{totals.tax_amount.toFixed(2)} €</span>
          </div>
        )}
      </div>
      
      <div className="border-t pt-2 mb-6">
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{totals.total_price.toFixed(2)} {totals.currency}</span>
        </div>
      </div>
      
      {children}
    </div>
  );
}
