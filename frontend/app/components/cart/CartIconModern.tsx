/**
 * 🛒 CART ICON - Version moderne avec Fetch API
 */

import { Link } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "../ui/badge";

interface CartIconModernProps {
  className?: string;
}

export function CartIconModern({ className = "" }: CartIconModernProps) {
  const [itemCount, setItemCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const isRefreshingRef = useRef(false);

  // 🚀 Fonction moderne pour récupérer le panier avec Fetch API
  const refreshCartCount = useCallback(async () => {
    // Protection anti-spam : éviter les appels simultanés
    if (isRefreshingRef.current) {
      console.log("🛒 CartIconModern - Appel ignoré (déjà en cours)");
      return;
    }
    
    console.log("🛒 CartIconModern - Début refresh...");
    isRefreshingRef.current = true;
    
    // Éviter les appels simultanés
    setIsLoading(true);
    
    try {
      console.log("🛒 CartIconModern - Appel API /api/cart...");
      const response = await fetch("/api/cart", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      console.log("🛒 CartIconModern - Réponse reçue:", response.status, response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log("🛒 CartIconModern - Données panier:", result);
        
        // Calcul du nombre total d'articles basé sur la structure réelle de l'API
        const totalItems = result.items ? result.items.length : 0;
        console.log("🛒 CartIconModern - Total items calculé:", totalItems);
        setItemCount(totalItems);
      } else {
        console.log("🛒 CartIconModern - Impossible de récupérer le panier, status:", response.status);
        setItemCount(0);
      }
    } catch (error) {
      console.error("🛒 CartIconModern - Erreur lors de la récupération du panier:", error);
      setItemCount(0);
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
      console.log("🛒 CartIconModern - Refresh terminé");
    }
  }, []); // ✅ Pas de dépendances pour éviter la boucle infinie

  // Récupérer le compteur au chargement
  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  // Refresh automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(refreshCartCount, 30000); // 30 secondes
    return () => clearInterval(interval);
  }, [refreshCartCount]);

  // 🔄 Fonction publique pour rafraîchir le panier (appelée par AddToCartModern)
  const refreshCart = useCallback(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  // Exposer la fonction refresh globalement pour les autres composants
  useEffect(() => {
    // Stocker la fonction dans window pour un accès global
    (window as any).refreshCartIcon = refreshCart;
    
    return () => {
      delete (window as any).refreshCartIcon;
    };
  }, [refreshCart]);

  return (
    <Link 
      to="/cart-service" 
      className={`hover:text-blue-200 transition-colors relative ${className}`}
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
      {isLoading && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
      )}
    </Link>
  );
}