import { Link } from "@remix-run/react";
import { Plus } from "lucide-react";

import { V5Badge, type V5BadgeVariant } from "./atoms";
import { type V5Product } from "./data";

type ProductCardProps = {
  product: V5Product;
  onAdd?: (product: V5Product) => void;
};

const stockClass = (stock: number): string => {
  if (stock === 0) return "v5-product-stock-out";
  if (stock < 5) return "v5-product-stock-low";
  return "";
};

const stockText = (stock: number): string => {
  if (stock === 0) return "Rupture";
  if (stock < 5) return `Plus que ${stock}`;
  return "En stock";
};

const badgeVariantOf = (variant: V5Product["badgeVariant"]): V5BadgeVariant =>
  variant ?? "promo";

export function V5ProductCard({ product, onAdd }: ProductCardProps) {
  const { ref, brand, name, price, priceOld, stock, badge } = product;
  const disabled = stock === 0;

  return (
    <Link
      to={`/v5/produit/${encodeURIComponent(ref)}`}
      className="v5-product"
      prefetch="intent"
    >
      <div className="v5-product-img">
        {badge && (
          <span className="v5-product-badge-tl">
            <V5Badge variant={badgeVariantOf(product.badgeVariant)}>
              {badge}
            </V5Badge>
          </span>
        )}
        <span className="v5-product-img-mono" aria-hidden="true">
          {ref}
        </span>
      </div>
      <div className="v5-product-body">
        <span className="v5-product-brand">{brand}</span>
        <span className="v5-product-name">{name}</span>
        <div className="flex items-baseline gap-2">
          <span className="v5-product-price">{price.toFixed(2)}€</span>
          {priceOld != null && (
            <span className="v5-product-price-old">{priceOld.toFixed(2)}€</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`v5-product-stock ${stockClass(stock)}`}>
            {stockText(stock)}
          </span>
          <button
            type="button"
            className="v5-btn v5-btn-primary v5-product-add"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) onAdd?.(product);
            }}
            disabled={disabled}
            aria-label={`Ajouter ${brand} ${name} au panier`}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Link>
  );
}
