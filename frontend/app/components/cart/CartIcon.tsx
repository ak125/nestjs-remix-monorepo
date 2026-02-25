/**
 * 🛒 CartIcon - Icône panier avec compteur
 *
 * Version corrigée:
 * - Utilise useRootCart() pour l'initialisation (SSR)
 * - Debounce sur le listener cart:updated (1 seconde)
 * - Pas de fetch au montage (évite la boucle infinie)
 */
import { Link } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";
import { useState, useEffect, memo } from "react";

import { useRootCart } from "~/hooks/useRootData";
import { logger } from "~/utils/logger";
import { Badge } from "../ui/badge";

interface CartIconProps {
  className?: string;
}

export const CartIcon = memo(function CartIcon({
  className = "",
}: CartIconProps) {
  const rootCart = useRootCart(); // Données SSR du root loader
  const [itemCount, setItemCount] = useState(0);

  // Initialiser depuis SSR - pas de fetch au montage
  useEffect(() => {
    if (rootCart?.summary?.total_items !== undefined) {
      setItemCount(rootCart.summary.total_items);
    }
  }, [rootCart?.summary?.total_items]);

  // Listener avec debounce pour mise à jour après actions panier
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const handleCartUpdate = () => {
      // Debounce 1 seconde pour éviter les appels multiples
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch("/api/cart", {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            if (isMounted) {
              // Supporter les deux formats de réponse
              const count =
                data.cart?.summary?.total_items ||
                data.summary?.total_items ||
                0;
              setItemCount(count);
            }
          }
        } catch (error) {
          logger.error("CartIcon: erreur fetch cart", error);
        }
      }, 1000);
    };

    window.addEventListener("cart:updated", handleCartUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("cart:updated", handleCartUpdate);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
});
