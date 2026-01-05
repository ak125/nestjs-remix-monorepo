/**
 * ⚡ Optimisé INP: Utilise flushSync minimal et requestAnimationFrame pour animations
 */

import { ShoppingCart, Check, AlertCircle, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

import { Alert } from '~/components/ui';
import { useNotifications } from "../notifications/NotificationContainer";

interface PieceData {
  id: number;
  name: string;
  price: number;
  priceFormatted: string;
  brand: string;
  stock: string;
  reference: string;
  quality?: string;
}

interface AddToCartButtonProps {
  piece: PieceData;
  quantity?: number;
  variant?: "default" | "small" | "large";
  className?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  showQuantitySelector?: boolean;
}

export function AddToCartButton({
  piece,
  quantity: initialQuantity = 1,
  variant = "default",
  className = "",
  onSuccess,
  onError,
  showQuantitySelector = false
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { showSuccess, showError } = useNotifications();

    // ⚡ Utiliser fetch directement vers l'API NestJS au lieu de Remix fetcher
    // Optimisé: Réduction des state updates séquentiels
    const handleAddToCart = useCallback(async () => {
      if (quantity <= 0) {
        setErrorMessage("La quantité doit être supérieure à 0");
        return;
      }

      if (piece.stock !== "En stock" && quantity > 1) {
        setErrorMessage("Stock limité, veuillez réduire la quantité");
        return;
      }

      // ⚡ OPTIMISTIC UI: Combiner les state updates pour réduire les re-renders
      // React 18 batch automatiquement mais on reste explicite
      setIsOptimistic(true);
      setIsSuccess(true);
      setErrorMessage(null);
      setIsLoading(true);

      // 🎬 Animation flying to cart (déjà optimisée avec requestAnimationFrame)
      if (buttonRef.current) {
        createFlyingAnimation(buttonRef.current);
      }

      // 🔔 Notification immédiate
      showSuccess(`✅ ${piece.name} ajouté au panier (${quantity}x)`);

      // 🎯 Bounce du badge panier (si disponible)
      triggerCartBadgeBounce();

      try {
        const response = await fetch('/api/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',  // 🔥 Transmet les cookies de session
          body: JSON.stringify({
            product_id: piece.id.toString(),
            quantity: quantity,
            custom_price: piece.price
          })
        });

        if (response.ok) {
          await response.json(); // Consommer la réponse
          // ✅ Succès confirmé - garder l'état optimistic
          setIsOptimistic(false);
          onSuccess?.();
          
          // 🔄 Émettre l'événement pour synchroniser le panier partout
          window.dispatchEvent(new Event('cart:updated'));
        } else {
          // ❌ Échec - revert optimistic update
          const errorData = await response.json().catch(() => ({}));
          const error = errorData.message || "Erreur lors de l'ajout au panier";
          
          // Revert état
          setIsOptimistic(false);
          setIsSuccess(false);
          setErrorMessage(error);
          onError?.(error);

          // Notification d'erreur
          showError(`❌ ${error}`);

          console.error("❌ [AddToCart] Erreur HTTP:", response.status, error);
        }
      } catch (error) {
        // ❌ Erreur réseau - revert optimistic update
        console.error("❌ [AddToCart] Erreur réseau:", error);
        const errorMsg = error instanceof Error 
          ? `Erreur: ${error.message}` 
          : "Impossible de contacter le serveur";
        
        // Revert état
        setIsOptimistic(false);
        setIsSuccess(false);
        setErrorMessage(errorMsg);
        onError?.(errorMsg);

        // Notification d'erreur
        showError(`❌ ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    }, [quantity, piece, showSuccess, showError, onSuccess, onError]);

  /**
   * 🎬 Crée une animation de "flying" vers l'icône panier
   * 🚀 Optimisé pour éviter le layout thrashing (lecture avant écriture)
   */
  const createFlyingAnimation = (button: HTMLElement) => {
    // 📖 LECTURE D'ABORD - obtenir la position AVANT toute modification DOM
    const rect = button.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // ✏️ ÉCRITURE ENSUITE - dans un requestAnimationFrame pour batch
    requestAnimationFrame(() => {
      const clone = document.createElement('div');
      clone.innerHTML = '🛒';
      clone.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        font-size: 24px;
        pointer-events: none;
        z-index: 9999;
        animation: flyToCart 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      `;

      document.body.appendChild(clone);

      // Supprimer après l'animation
      setTimeout(() => clone.remove(), 600);
    });
  };

  /**
   * 🎯 Déclenche le bounce du badge panier
   */
  const triggerCartBadgeBounce = () => {
    const cartBadge = document.querySelector('[data-cart-badge]');
    if (cartBadge) {
      cartBadge.classList.add('animate-bounce-success');
      setTimeout(() => {
        cartBadge.classList.remove('animate-bounce-success');
      }, 600);
    }
  };

  // Auto-reset du message de succès après 2s
  useEffect(() => {
    if (isSuccess && !isOptimistic) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isOptimistic]);

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= 99) {
      setQuantity(newQuantity);
    }
  };

  // Classes CSS selon la variante
  const baseClasses = "font-medium transition-all duration-200 flex items-center gap-2 justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
  
  const variantClasses = {
    small: "text-sm px-3 py-1.5",
    default: "text-sm px-4 py-2",
    large: "text-base px-6 py-3"
  };

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Ajout...</span>
        </>
      );
    }

    if (isSuccess) {
      return (
        <>
          <Check className="w-4 h-4" />
          <span>Ajouté !</span>
        </>
      );
    }

    if (errorMessage) {
      return (
        <>
          <AlertCircle className="w-4 h-4" />
          <span>Erreur</span>
        </>
      );
    }

    return (
      <>
        <ShoppingCart className="w-4 h-4" />
        <span>Ajouter</span>
      </>
    );
  };

  const getButtonColor = () => {
    if (isSuccess) {
      return "bg-success hover:bg-success/90 text-white";
    }

    if (errorMessage) {
      return "bg-destructive hover:bg-destructive/90 text-white";
    }

    if (piece.stock === "En stock") {
      return "bg-primary hover:bg-primary/90 text-primary-foreground";
    }

    return "bg-warning hover:bg-warning/90 text-white";
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Sélecteur de quantité */}
      {showQuantitySelector && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Quantité:</span>
          <div className="flex items-center border border-gray-300 rounded">
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1 || isLoading}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              min="1"
              max="99"
              disabled={isLoading}
              className="w-16 text-center border-0 focus:ring-0 focus:outline-none py-1"
            />
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= 99 || isLoading}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Bouton d'ajout */}
      <button
        ref={buttonRef}
        onClick={handleAddToCart}
        disabled={isLoading || piece.stock === "Rupture de stock"}
        className={`${baseClasses} ${variantClasses[variant]} ${getButtonColor()} ${className} disabled:opacity-50 disabled:cursor-not-allowed button-press`}
        title={piece.stock === "Rupture de stock" ? "Produit en rupture de stock" : `Ajouter ${piece.name} au panier`}
      >
        {getButtonContent()}
      </button>

      {/* Message d'erreur */}
      {errorMessage && (
        <Alert intent="error">{errorMessage}</Alert>
      )}

      {/* Informations supplémentaires */}
      <div className="text-xs text-gray-500">
        {piece.stock === "En stock" ? (
          <span className="text-green-600">✓ Disponible immédiatement</span>
        ) : piece.stock === "Sur commande" ? (
          <span className="text-yellow-600">⚠ Délai de livraison prolongé</span>
        ) : (
          <span className="text-red-600">✗ Rupture de stock</span>
        )}
      </div>
    </div>
  );
}

export default AddToCartButton;