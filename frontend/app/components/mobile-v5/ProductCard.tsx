import { Link } from "@remix-run/react";
import { Plus } from "lucide-react";

import { MV5Badge, type MV5BadgeVariant } from "./atoms";

export type MV5Product = {
  ref: string;
  brand: string;
  name: string;
  price: number;
  priceOld?: number;
  stock: number;
  badge?: string;
  badgeVariant?: MV5BadgeVariant;
};

const stockClass = (stock: number): string => {
  if (stock === 0) return "mv5-product-stock-out";
  if (stock < 5) return "mv5-product-stock-low";
  return "";
};

const stockText = (stock: number): string => {
  if (stock === 0) return "Rupture";
  if (stock < 5) return `Plus que ${stock}`;
  return "En stock";
};

export function MV5ProductCard({
  product,
  onAdd,
  href,
}: {
  product: MV5Product;
  onAdd?: (product: MV5Product) => void;
  /** Lien cible — par défaut /preview-mobile/produit/:ref pour la preview. Migration vers /pieces/* en V4. */
  href?: string;
}) {
  const { ref, brand, name, price, priceOld, stock, badge } = product;
  const disabled = stock === 0;
  const target = href ?? `/preview-mobile/produit/${encodeURIComponent(ref)}`;

  return (
    <Link to={target} className="mv5-product" prefetch="intent">
      <div className="mv5-product-img">
        {badge && (
          <span className="mv5-product-badge-tl">
            <MV5Badge variant={product.badgeVariant ?? "promo"}>
              {badge}
            </MV5Badge>
          </span>
        )}
        <span className="mv5-product-img-mono" aria-hidden="true">
          {ref}
        </span>
      </div>
      <div className="mv5-product-body">
        <span className="mv5-product-brand">{brand}</span>
        <span className="mv5-product-name">{name}</span>
        <div className="flex items-baseline gap-2">
          <span className="mv5-product-price">{price.toFixed(2)}€</span>
          {priceOld != null && (
            <span className="mv5-product-price-old">
              {priceOld.toFixed(2)}€
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`mv5-product-stock ${stockClass(stock)}`}>
            {stockText(stock)}
          </span>
          <button
            type="button"
            className="mv5-btn mv5-btn-primary mv5-product-add"
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
