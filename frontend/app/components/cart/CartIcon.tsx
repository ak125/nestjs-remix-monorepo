import { useFetcher, Link } from "@remix-run/react";
import { useState, useEffect } from "react";

// Type pour les données du fetcher
interface CartFetcherData {
  success: boolean;
  cart?: {
    summary?: {
      total_items?: number;
    };
  };
}

interface CartIconProps {
  className?: string;
}

export function CartIcon({ className = "" }: CartIconProps) {
  const [itemCount, setItemCount] = useState(0);
  const fetcher = useFetcher();

  // ✅ APPROCHE OPTIMISÉE : Utiliser useFetcher pour récupérer via intégration directe
  useEffect(() => {
    const fetchCartCount = () => {
      // Utiliser fetcher pour appeler le loader de /cart qui utilise l'intégration directe
      fetcher.load('/cart?summary=true');
    };

    fetchCartCount();
    
    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(fetchCartCount, 30000);
    return () => clearInterval(interval);
  }, [fetcher]);

  // Mettre à jour le compteur quand les données arrivent
  useEffect(() => {
    if (fetcher.data) {
      const data = fetcher.data as CartFetcherData;
      if (data.success && data.cart?.summary) {
        setItemCount(data.cart.summary.total_items || 0);
      }
    }
  }, [fetcher.data]);

  return (
    <Link 
      to="/cart" 
      className={`relative inline-flex items-center p-3 text-white hover:bg-blue-700 rounded ${className}`}
    >
      <svg 
        className="w-6 h-6" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"
        />
      </svg>
      
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}
