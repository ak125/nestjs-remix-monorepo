/**
 * Preview Mobile — Catalogue (/preview-mobile/catalog)
 *
 * Validation visuelle du catalogue avec FitmentBand sticky jaune,
 * pills filtres scrollables, grille 2-col mobile, ProductCard signature.
 */

import { useNavigate } from "@remix-run/react";
import {
  Bolt,
  ChevronDown,
  Filter as FilterIcon,
  Flame,
  Heart,
  ShoppingCart,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import {
  MV5FitmentBand,
  MV5HScroll,
  MV5Pill,
} from "~/components/mobile-v5/atoms";
import { MV5Header } from "~/components/mobile-v5/Header";
import {
  MV5_CATEGORIES,
  MV5_PREVIEW_VEHICLE,
  MV5_PRODUCTS,
} from "~/components/mobile-v5/preview-fixtures";
import { MV5ProductCard } from "~/components/mobile-v5/ProductCard";
import { usePreviewCart } from "~/components/mobile-v5/usePreviewCart";

const CATEGORY_PILL_ICON_MAP: Record<string, LucideIcon> = {
  bolt: Bolt,
  flame: Flame,
  truck: Truck,
  wrench: Wrench,
};

const pillIcon = (iconKey: string): LucideIcon =>
  CATEGORY_PILL_ICON_MAP[iconKey] ?? Wrench;

export default function PreviewMobileCatalog() {
  const navigate = useNavigate();
  const cart = usePreviewCart();
  const [filter, setFilter] = useState<string>("all");

  const items =
    filter === "all"
      ? MV5_PRODUCTS
      : MV5_PRODUCTS.filter((p) => p.cat === filter);

  const cartBadge = cart.count > 0 ? cart.count : null;

  return (
    <>
      <MV5Header
        title="Plaquettes de frein"
        leftIcon="back"
        light
        onLeft={() => navigate("/preview-mobile")}
        rightIcons={[
          { icon: Heart, label: "Mes favoris" },
          {
            icon: ShoppingCart,
            label: "Panier",
            badge: cartBadge,
            onClick: () => navigate("/preview-mobile/panier"),
          },
        ]}
      />

      <main className="flex-1 pb-24">
        <MV5FitmentBand
          label={MV5_PREVIEW_VEHICLE.label}
          sub={MV5_PREVIEW_VEHICLE.sub}
          action={{
            label: "Modifier",
            onClick: () => navigate("/preview-mobile"),
          }}
        />

        <MV5HScroll>
          <MV5Pill active={filter === "all"} onClick={() => setFilter("all")}>
            Tous
          </MV5Pill>
          {MV5_CATEGORIES.slice(0, 5).map((c) => (
            <MV5Pill
              key={c.key}
              icon={pillIcon(c.iconKey)}
              active={filter === c.key}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </MV5Pill>
          ))}
        </MV5HScroll>

        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="mv5-text-soft text-xs">
            {items.length} produit{items.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="mv5-btn mv5-btn-ghost mv5-btn-sm"
              aria-label="Filtrer les produits"
            >
              <FilterIcon size={14} aria-hidden="true" /> Filtrer
            </button>
            <button
              type="button"
              className="mv5-btn mv5-btn-ghost mv5-btn-sm"
              aria-label="Trier les produits"
            >
              Tri <ChevronDown size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 pb-4">
            <div className="mv5-card">
              <div className="mv5-card-body flex flex-col items-center gap-3 py-8 text-center">
                <span className="mv5-text-soft">
                  Aucun produit dans cette catégorie
                </span>
                <button
                  type="button"
                  className="mv5-btn mv5-btn-dark mv5-btn-sm"
                  onClick={() => setFilter("all")}
                >
                  Voir tout le catalogue
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4">
            <div className="grid grid-cols-2 gap-3">
              {items.map((p) => (
                <MV5ProductCard
                  key={p.ref}
                  product={p}
                  onAdd={(prod) => cart.add(prod)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
