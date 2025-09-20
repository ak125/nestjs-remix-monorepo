/**
 * 🛒 CART BUTTON - Alias pour CartIcon existant
 * 
 * Compatible avec votre structure Header
 */

import { CartIcon } from "../cart/CartIcon";

interface CartButtonProps {
  position?: 'header' | 'sidebar' | 'floating';
  className?: string;
}

export function CartButton({ position = 'header', className = "" }: CartButtonProps) {
  return (
    <CartIcon 
      className={`
        ${position === 'header' ? 'p-2 hover:bg-gray-100 rounded-lg transition-colors' : ''}
        ${className}
      `} 
    />
  );
}
