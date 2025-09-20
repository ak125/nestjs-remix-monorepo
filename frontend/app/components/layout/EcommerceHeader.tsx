/**
 * 🛒 ECOMMERCE HEADER - Header pour pages e-commerce
 * 
 * Header complet avec toutes les fonctionnalités e-commerce
 */

import { Header } from './Header';

interface EcommerceHeaderProps {
  className?: string;
  showTopBar?: boolean;
  searchPlaceholder?: string;
}

export function EcommerceHeader({ 
  className, 
  showTopBar = true,
  searchPlaceholder: _searchPlaceholder 
}: EcommerceHeaderProps) {
  return (
    <Header 
      context="public"
      variant={showTopBar ? "default" : "simple"}
      theme="default"
      className={className}
    />
  );
}
