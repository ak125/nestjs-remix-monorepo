/**
 * 🛒 CART ITEM COMPONENT - Affichage d'un article du panier
 * Version améliorée avec gestion du stock et validation
 */

import { Trash2, Plus, Minus, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { type CartItem } from "../../types/cart";

interface CartItemProps {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItem({ item, onQuantityChange, onRemove }: CartItemProps) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculs avec fallbacks
  const unitPrice = item.unit_price || item.price;
  const totalPrice = item.total_price || (unitPrice * quantity);
  const stockAvailable = item.stock_available || 999; // Fallback pour stock illimité
  const productRef = item.product_ref || item.product_sku || item.product_id;
  const productImage = item.product_image || "/images/no-image.png";
  const productName = item.product_name || `Produit ${item.product_id}`;

  const handleQuantityChange = async (newQuantity: number) => {
    // Validation
    if (newQuantity < 1) return;
    if (newQuantity > stockAvailable) return;
    
    setIsUpdating(true);
    setQuantity(newQuantity);
    
    try {
      if (newQuantity === 0) {
        onRemove();
      } else {
        onQuantityChange(newQuantity);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value) || 1;
    handleQuantityChange(newQuantity);
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Image produit */}
          <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
            <img
              src={productImage}
              alt={productName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/images/no-image.png";
              }}
            />
          </div>

          {/* Informations produit */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {productName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Réf: {productRef}
            </p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {formatPrice(unitPrice)}
            </p>
            
            {/* Alerte stock */}
            {stockAvailable < 10 && stockAvailable > 0 && (
              <div className="flex items-center gap-1 mt-2 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">
                  Plus que {stockAvailable} en stock
                </span>
              </div>
            )}
          </div>

          {/* Contrôles quantité */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1 || isUpdating}
              className="h-8 w-8 p-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
            
            <input
              type="number"
              value={quantity}
              onChange={handleQuantityInputChange}
              min="1"
              max={stockAvailable}
              disabled={isUpdating}
              className="w-16 h-8 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= stockAvailable || isUpdating}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Total ligne */}
          <div className="text-right min-w-[100px]">
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-semibold text-gray-900">
              {formatPrice(totalPrice)}
            </p>
          </div>

          {/* Bouton supprimer */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            disabled={isUpdating}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            aria-label="Supprimer l'article"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
