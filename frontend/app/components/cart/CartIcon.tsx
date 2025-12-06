import { useFetcher, Link } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "../ui/badge";

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

  // ✅ APPROCHE OPTIMISÉE : Utiliser useFetcher pour récupérer via notre nouveau service
  useEffect(() => {
    const fetchCartCount = () => {
      // Utiliser fetcher pour appeler le loader de /cart
      fetcher.load('/cart');
    };

    // Charger une fois au montage
    fetchCartCount();

    // Écouter les événements de mise à jour du panier
    const handleCartUpdate = () => {
      console.log('🔄 CartIcon: Événement cart:updated reçu');
      fetchCartCount();
    };

    window.addEventListener('cart:updated', handleCartUpdate);

    return () => {
      window.removeEventListener('cart:updated', handleCartUpdate);
    };
  }, [fetcher]);

  // Mettre à jour le compteur quand les données arrivent
  useEffect(() => {
    if (fetcher.data) {
      const data = fetcher.data as CartFetcherData;
      if (data.success && data.cart?.summary?.total_items) {
        setItemCount(data.cart.summary.total_items);
      } else {
        setItemCount(0);
      }
    }
  }, [fetcher.data]);

  return (
    <Link 
      to="/cart" 
      rel="nofollow"
      className={`hover:text-blue-200 transition-colors relative inline-flex items-center ${className}`}
      aria-label="Panier"
    >
      <ShoppingCart className="flex-shrink-0" size={20} />
      {itemCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs"
        >
          {itemCount}
        </Badge>
      )}
    </Link>
  );
}
