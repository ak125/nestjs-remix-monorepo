/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛒 QUICK CART DRAWER - Panier Latéral Rapide
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Panier latéral slide-in optimisé e-commerce auto avec :
 * • Ajout instantané sans rechargement
 * • Résumé temps réel (prix, livraison, compatibilité)
 * • Animation slide depuis droite
 * • Modification quantités rapide
 * • Suppression produits
 * • CTA "Commander" direct
 * 
 * Design System intégré :
 * • Couleurs : Primary (CTA), Success (compatible), Error (incompatible), Neutral
 * • Typographie : Montserrat (headings), Inter (body), Roboto Mono (prix)
 * • Espacement : 8px grid
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { calculateDeliveryETA, formatDeliveryText, type DeliveryMode } from '../../utils/delivery-eta';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  oemRef: string;
  imageUrl: string;
  price: number;
  quantity: number;
  isCompatible: boolean;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
}

export interface DeliveryOption {
  id: string;
  name: string;
  price: number;
  estimatedDays: string;
  icon?: string;
}

export interface QuickCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  deliveryOptions?: DeliveryOption[];
  selectedDeliveryId?: string;
  onSelectDelivery?: (deliveryId: string) => void;
  savedVehicle?: {
    brand: string;
    model: string;
    year: number;
    engine?: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function QuickCartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  deliveryOptions = [
    { id: 'standard', name: 'Standard', price: 4.90, estimatedDays: '3-5 jours' },
    { id: 'express', name: 'Express', price: 9.90, estimatedDays: '1-2 jours' },
    { id: 'pickup', name: 'Retrait en magasin', price: 0, estimatedDays: 'Immédiat' },
  ],
  selectedDeliveryId = 'standard',
  onSelectDelivery,
  savedVehicle,
}: QuickCartDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // 🎬 EFFECTS
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ───────────────────────────────────────────────────────────────────────────
  // 💰 CALCULS
  // ───────────────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  // 🚚 Seuil de livraison gratuite
  const FREE_SHIPPING_THRESHOLD = 50;
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const amountUntilFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  
  const selectedDelivery = deliveryOptions.find((d) => d.id === selectedDeliveryId);
  const deliveryPrice = isFreeShipping && selectedDeliveryId !== 'express' ? 0 : (selectedDelivery?.price || 0);
  
  const total = subtotal + deliveryPrice;
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const hasIncompatibleItems = items.some((item) => !item.isCompatible);
  const incompatibleCount = items.filter((item) => !item.isCompatible).length;

  // 📦 ETA Livraison calculée
  const stockStatuses = items.map((item) => item.stockStatus);
  const eta = calculateDeliveryETA(stockStatuses, selectedDeliveryId as DeliveryMode);
  const deliveryText = formatDeliveryText(eta.estimatedDays, selectedDeliveryId as DeliveryMode);

  // ───────────────────────────────────────────────────────────────────────────
  // 🎬 HANDLERS
  // ───────────────────────────────────────────────────────────────────────────

  const handleClose = () => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleIncrement = (itemId: string, currentQty: number) => {
    onUpdateQuantity(itemId, currentQty + 1);
  };

  const handleDecrement = (itemId: string, currentQty: number) => {
    if (currentQty > 1) {
      onUpdateQuantity(itemId, currentQty - 1);
    }
  };

  const handleCheckout = () => {
    onCheckout();
    handleClose();
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🎨 RENDER
  // ───────────────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-50 transition-opacity duration-300
          ${isOpen && animating ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50
          transition-transform duration-300 ease-out
          flex flex-col
          ${isOpen && animating ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        {/* Header */}
        <div className="bg-neutral-900 text-white px-md py-md flex items-center justify-between">
          <div>
            <h2 id="cart-drawer-title" className="font-heading text-xl font-bold">
              Mon Panier
            </h2>
            <p className="font-sans text-sm text-neutral-300 mt-xs">
              {itemCount} {itemCount > 1 ? 'articles' : 'article'}
            </p>
          </div>
          
          <button
            onClick={handleClose}
            className="p-sm hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Fermer le panier"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Alerte véhicule configuré */}
        {savedVehicle && (
          <div className="bg-success-50 border-b border-success-200 px-md py-sm">
            <p className="font-sans text-xs text-success-800">
              <strong className="font-heading">✓ Véhicule:</strong>{' '}
              {savedVehicle.brand} {savedVehicle.model} {savedVehicle.engine} ({savedVehicle.year})
            </p>
          </div>
        )}

        {/* Alerte incompatibilités */}
        {hasIncompatibleItems && (
          <div className="bg-error-50 border-b border-error-200 px-md py-sm">
            <p className="font-sans text-xs text-error-800">
              <strong className="font-heading">⚠ Attention:</strong>{' '}
              {incompatibleCount} {incompatibleCount > 1 ? 'articles incompatibles' : 'article incompatible'} avec votre véhicule
            </p>
          </div>
        )}

        {/* Liste produits (scrollable) */}
        <div className="flex-1 overflow-y-auto px-md py-md">
          {items.length === 0 ? (
            <div className="text-center py-2xl">
              <div className="text-6xl mb-md">🛒</div>
              <p className="font-heading text-lg font-bold text-neutral-900 mb-sm">
                Votre panier est vide
              </p>
              <p className="font-sans text-sm text-neutral-600">
                Ajoutez des produits pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-md">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`
                    bg-neutral-50 rounded-lg p-sm border-2 transition-colors
                    ${item.isCompatible ? 'border-success-200' : 'border-error-200'}
                  `}
                >
                  <div className="flex gap-sm">
                    {/* Image */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg bg-white"
                    />

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      {/* Nom + Badge compatibilité */}
                      <div className="flex items-start justify-between gap-xs mb-xs">
                        <h3 className="font-heading text-sm font-bold text-neutral-900 line-clamp-2">
                          {item.name}
                        </h3>
                        
                        {item.isCompatible ? (
                          <span className="px-xs py-xs bg-success-500 text-white text-xs font-heading font-semibold rounded whitespace-nowrap">
                            ✓ OK
                          </span>
                        ) : (
                          <span className="px-xs py-xs bg-error-500 text-white text-xs font-heading font-semibold rounded whitespace-nowrap">
                            ⚠ Non
                          </span>
                        )}
                      </div>

                      {/* Réf OEM */}
                      <p className="font-mono text-xs text-neutral-600 mb-sm">
                        Réf. {item.oemRef}
                      </p>

                      {/* Prix + Quantité */}
                      <div className="flex items-center justify-between">
                        {/* Quantité */}
                        <div className="flex items-center gap-xs">
                          <button
                            onClick={() => handleDecrement(item.id, item.quantity)}
                            disabled={item.quantity <= 1}
                            className={`
                              w-7 h-7 flex items-center justify-center rounded-lg font-bold
                              transition-colors
                              ${item.quantity <= 1
                                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                : 'bg-neutral-300 text-neutral-900 hover:bg-neutral-400'
                              }
                            `}
                            aria-label="Diminuer quantité"
                          >
                            −
                          </button>
                          
                          <span className="font-mono text-sm font-bold text-neutral-900 w-8 text-center">
                            {item.quantity}
                          </span>
                          
                          <button
                            onClick={() => handleIncrement(item.id, item.quantity)}
                            className="w-7 h-7 flex items-center justify-center bg-neutral-300 text-neutral-900 rounded-lg font-bold hover:bg-neutral-400 transition-colors"
                            aria-label="Augmenter quantité"
                          >
                            +
                          </button>
                        </div>

                        {/* Prix */}
                        <p className="font-mono text-lg font-bold text-neutral-900">
                          {(item.price * item.quantity).toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bouton supprimer */}
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="w-full mt-sm px-sm py-xs bg-neutral-200 hover:bg-error-100 text-neutral-700 hover:text-error-700 rounded-lg font-sans text-xs font-semibold transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer (toujours visible) */}
        {items.length > 0 && (
          <div className="border-t border-neutral-200 bg-white px-md py-md space-y-md">
            {/* 🚚 Barre de progression livraison gratuite */}
            {!isFreeShipping && (
              <div className="bg-secondary-50 rounded-lg p-sm space-y-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-heading font-bold text-secondary-700">
                    🚚 Livraison gratuite dès 50€
                  </span>
                  <span className="font-mono font-bold text-secondary-900">
                    Plus que {amountUntilFreeShipping.toFixed(2)} €
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-secondary-500 to-secondary-600 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            {isFreeShipping && selectedDeliveryId === 'standard' && (
              <div className="bg-success-50 border-2 border-success-500 rounded-lg p-sm">
                <p className="font-heading text-sm font-bold text-success-700 text-center">
                  ✅ Livraison gratuite débloquée !
                </p>
              </div>
            )}

            {/* Options livraison */}
            <div>
              <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm">
                Livraison
              </h3>
              <div className="space-y-xs">
                {deliveryOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`
                      flex items-center justify-between p-sm rounded-lg cursor-pointer transition-colors
                      ${selectedDeliveryId === option.id
                        ? 'bg-secondary-50 border-2 border-secondary-500'
                        : 'bg-neutral-50 border-2 border-transparent hover:border-neutral-300'
                      }
                    `}
                  >
                    <div className="flex items-center gap-sm">
                      <input
                        type="radio"
                        name="delivery"
                        checked={selectedDeliveryId === option.id}
                        onChange={() => onSelectDelivery?.(option.id)}
                        className="w-4 h-4 text-secondary-500 focus:ring-secondary-500"
                      />
                      <div>
                        <p className="font-heading text-sm font-bold text-neutral-900">
                          {option.name}
                        </p>
                        <p className="font-sans text-xs text-neutral-600">
                          {selectedDeliveryId === option.id ? (
                            <>
                              📦 {deliveryText}
                              {eta.estimatedDays > 0 && (
                                <span className="block text-success-600 font-semibold mt-0.5">
                                  Livraison prévue: {eta.formattedDate}
                                </span>
                              )}
                            </>
                          ) : (
                            option.estimatedDays
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="font-mono text-sm font-bold text-neutral-900">
                      {option.price === 0 ? 'Gratuit' : `${option.price.toFixed(2)} €`}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            {/* Résumé prix */}
            <div className="space-y-xs">
              {/* Sous-total */}
              <div className="flex items-center justify-between font-sans text-sm">
                <span className="text-neutral-600">Sous-total ({itemCount} articles)</span>
                <span className="font-mono font-bold text-neutral-900">
                  {subtotal.toFixed(2)} €
                </span>
              </div>

              {/* Livraison */}
              <div className="flex items-center justify-between font-sans text-sm">
                <span className="text-neutral-600">Livraison</span>
                <span className="font-mono font-bold text-neutral-900">
                  {deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice.toFixed(2)} €`}
                </span>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-sm border-t border-neutral-300">
                <span className="font-heading text-lg font-bold text-neutral-900">Total</span>
                <span className="font-mono text-2xl font-bold text-primary-500">
                  {total.toFixed(2)} €
                </span>
              </div>
            </div>

            {/* 🎁 Produits recommandés */}
            <div className="mt-md">
              <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm">
                Vous aimerez aussi
              </h3>
              <div className="grid grid-cols-3 gap-xs">
                {/* Placeholder - Les vraies données viennent de l'API */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-neutral-50 rounded p-xs border border-neutral-200 hover:border-primary-300 cursor-pointer transition-colors"
                  >
                    <div className="aspect-square bg-neutral-200 rounded mb-xs" />
                    <p className="text-xs font-semibold text-neutral-900 line-clamp-2 mb-xs">
                      Produit {i}
                    </p>
                    <p className="text-xs font-mono font-bold text-primary-600">
                      {(Math.random() * 50 + 10).toFixed(2)} €
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Commander */}
            <button
              onClick={handleCheckout}
              className="w-full py-md bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-heading text-base font-bold transition-colors shadow-lg hover:shadow-xl"
            >
              Commander
            </button>

            {/* Continuer shopping */}
            <button
              onClick={handleClose}
              className="w-full py-sm text-neutral-600 hover:text-neutral-900 font-sans text-sm font-semibold transition-colors"
            >
              Continuer mes achats
            </button>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(drawerContent, document.body);
}

export default QuickCartDrawer;
