/**
 * V5 Liste — /v5/liste
 * Catalogue filtrable mock (ship 1).
 */

import { type MetaFunction } from "@remix-run/node";
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

import { V5FitmentBand, V5HScroll, V5Pill } from "~/components/v5/atoms";
import { CATEGORIES, PRODUCTS, type V5Product } from "~/components/v5/data";
import { V5Header } from "~/components/v5/Header";
import { useV5Cart } from "~/components/v5/hooks/useV5Cart";
import { useV5Vehicle } from "~/components/v5/hooks/useV5Vehicle";
import { V5ProductCard } from "~/components/v5/ProductCard";

export const meta: MetaFunction = () => [
  { title: "AutoMecanik · Catalogue mobile" },
];

const CATEGORY_ICON: Record<string, LucideIcon> = {
  bolt: Bolt,
  flame: Flame,
  truck: Truck,
  wrench: Wrench,
};

const CATEGORY_PILL_ICON = (key: string): LucideIcon | null => {
  const c = CATEGORIES.find((cc) => cc.key === key);
  if (!c) return null;
  return CATEGORY_ICON[c.icon] ?? Wrench;
};

export default function V5ListeRoute() {
  const navigate = useNavigate();
  const { label, sub } = useV5Vehicle();
  const cart = useV5Cart();
  const [filter, setFilter] = useState<string>("all");

  const items =
    filter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === filter);

  const handleAdd = (product: V5Product) => cart.add(product);

  return (
    <>
      <V5Header
        title="Plaquettes de frein"
        leftIcon="back"
        light
        onLeft={() => navigate("/v5")}
        rightIcons={[
          { icon: Heart, label: "Mes favoris" },
          {
            icon: ShoppingCart,
            label: "Panier",
            badge: cart.count || null,
            onClick: () => navigate("/v5/panier"),
          },
        ]}
      />

      <main className="v5-main flex-1">
        {label && (
          <V5FitmentBand
            label={label}
            sub={sub}
            action={{
              label: "Modifier",
              onClick: () => navigate("/v5"),
            }}
          />
        )}

        <V5HScroll>
          <V5Pill active={filter === "all"} onClick={() => setFilter("all")}>
            Tous
          </V5Pill>
          {CATEGORIES.slice(0, 5).map((c) => (
            <V5Pill
              key={c.key}
              icon={CATEGORY_PILL_ICON(c.key)}
              active={filter === c.key}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </V5Pill>
          ))}
        </V5HScroll>

        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <span style={{ fontSize: 12, color: "var(--c-ink-soft)" }}>
            {items.length} produit{items.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="v5-btn v5-btn-ghost v5-btn-sm"
              aria-label="Filtrer les produits"
            >
              <FilterIcon size={14} aria-hidden="true" /> Filtrer
            </button>
            <button
              type="button"
              className="v5-btn v5-btn-ghost v5-btn-sm"
              aria-label="Trier les produits"
            >
              Tri <ChevronDown size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 pb-4">
            <div className="v5-card">
              <div className="v5-card-body flex flex-col items-center gap-3 py-8 text-center">
                <span style={{ color: "var(--c-ink-soft)" }}>
                  Aucun produit dans cette catégorie
                </span>
                <button
                  type="button"
                  className="v5-btn v5-btn-secondary v5-btn-sm"
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
                <V5ProductCard key={p.ref} product={p} onAdd={handleAdd} />
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
