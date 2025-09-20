/**
 * 🛒 EMPTY CART COMPONENT - Affichage panier vide
 */

import { ShoppingBag } from "lucide-react";
import { Link } from "@remix-run/react";

export function EmptyCart() {
  return (
    <div className="text-center py-12">
      <div className="mb-6">
        <ShoppingBag className="mx-auto h-24 w-24 text-gray-400" />
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Votre panier est vide
      </h2>
      
      <p className="text-gray-600 mb-8">
        Découvrez nos produits et ajoutez-les à votre panier !
      </p>
      
      <Link
        to="/products"
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Découvrir nos produits
      </Link>
    </div>
  );
}
