/**
 * CartIcon - Icone panier avec compteur
 *
 * Source unique : useRootCart() (SSR + revalidation automatique)
 * Pas de fetch independant — root.tsx revalide sur cart:updated (300ms debounce)
 */
import { Link } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";
import { memo } from "react";

import { useRootCart } from "~/hooks/useRootData";
import { Badge } from "../ui/badge";

interface CartIconProps {
  className?: string;
}

export const CartIcon = memo(function CartIcon({
  className = "",
}: CartIconProps) {
  const rootCart = useRootCart();
  const itemCount = rootCart?.summary?.total_items || 0;

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
          data-cart-badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs"
        >
          {itemCount}
        </Badge>
      )}
    </Link>
  );
});
