/**
 * V5 Home — /v5
 * Port verbatim de v5/HomeV5.jsx.
 *
 * Ship 1 : données mock via ~/components/v5/data.
 */

import { type MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import {
  Bolt,
  ChevronRight,
  Filter,
  Flame,
  Package,
  Search as SearchIcon,
  Shield,
  ShoppingCart,
  Truck,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  V5HScroll,
  V5Pill,
  V5SectionHeading,
  V5StatsBand,
} from "~/components/v5/atoms";
import { CATEGORIES, PRODUCTS, type V5Product } from "~/components/v5/data";
import { V5Header } from "~/components/v5/Header";
import { useV5Cart } from "~/components/v5/hooks/useV5Cart";
import { useV5Vehicle } from "~/components/v5/hooks/useV5Vehicle";
import { V5Plaque } from "~/components/v5/Plaque";
import { V5ProductCard } from "~/components/v5/ProductCard";

export const meta: MetaFunction = () => [
  { title: "AutoMecanik · Accueil mobile" },
];

const CATEGORY_ICON: Record<string, LucideIcon> = {
  shield: Shield,
  bolt: Bolt,
  filter: Filter,
  wrench: Wrench,
  flame: Flame,
  truck: Truck,
};

export default function V5HomeRoute() {
  const navigate = useNavigate();
  const { label, sub } = useV5Vehicle();
  const cart = useV5Cart();
  const featured = PRODUCTS.slice(0, 4);
  const promos = PRODUCTS.filter((p) => p.priceOld);

  const handleAdd = (product: V5Product) => cart.add(product);

  return (
    <>
      <V5Header
        title="AUTOMECANIK"
        leftIcon="menu"
        rightIcons={[
          {
            icon: User,
            label: "Mon compte",
            onClick: () => navigate("/v5/compte"),
          },
          {
            icon: ShoppingCart,
            label: "Panier",
            badge: cart.count || null,
            onClick: () => navigate("/v5/panier"),
          },
        ]}
      />

      <main className="v5-main flex-1">
        <section className="v5-hero">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="v5-eyebrow v5-eyebrow-on-dark">
                Pièces auto · Compatibilité garantie
              </span>
              <h1 className="v5-h1">
                La bonne pièce,
                <br />
                du premier coup.
              </h1>
            </div>
            <V5Plaque vehicle={label} />
            {sub && <span className="v5-hero-sub">{sub}</span>}
            <div className="v5-search">
              <SearchIcon
                className="v5-search-icon"
                size={18}
                aria-hidden="true"
              />
              <input
                type="search"
                className="v5-input"
                placeholder="Référence, pièce, marque…"
                aria-label="Rechercher une pièce"
              />
            </div>
          </div>
        </section>

        <V5StatsBand
          items={[
            { num: "500K+", label: "Références" },
            { num: "24h", label: "Livraison" },
            { num: "30j", label: "Retours" },
          ]}
        />

        <V5SectionHeading
          eyebrow="01 · Catalogue"
          title="Par catégorie"
          action="Tout voir"
          onAction={() => navigate("/v5/liste")}
        />
        <V5HScroll>
          {CATEGORIES.map((c) => (
            <V5Pill
              key={c.key}
              icon={CATEGORY_ICON[c.icon] ?? Wrench}
              onClick={() => navigate("/v5/liste")}
            >
              {c.label}
            </V5Pill>
          ))}
        </V5HScroll>

        <V5SectionHeading
          eyebrow="02 · Pour votre véhicule"
          title="Sélection"
          action="Voir tout"
          onAction={() => navigate("/v5/liste")}
        />
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {featured.map((p) => (
              <V5ProductCard key={p.ref} product={p} onAdd={handleAdd} />
            ))}
          </div>
        </div>

        <V5SectionHeading
          eyebrow="03 · En ce moment"
          title="Promotions"
          action="Voir tout"
          onAction={() => navigate("/v5/liste")}
        />
        <V5HScroll>
          {promos.map((p) => (
            <div key={p.ref} className="w-44 shrink-0">
              <V5ProductCard product={p} onAdd={handleAdd} />
            </div>
          ))}
        </V5HScroll>

        <section className="px-4 py-6">
          <div className="v5-card v5-card-dark">
            <div className="v5-card-body flex flex-col gap-4">
              <span className="v5-eyebrow v5-eyebrow-on-dark">
                Pourquoi AutoMecanik
              </span>
              <ul className="flex flex-col gap-3">
                {[
                  {
                    icon: Shield,
                    t: "Compatibilité vérifiée",
                    d: "Recherche par véhicule, référence ou Mine.",
                  },
                  {
                    icon: Truck,
                    t: "Livraison 24–48h",
                    d: "Expédition soignée, suivi en temps réel.",
                  },
                  {
                    icon: Package,
                    t: "Retours 30 jours",
                    d: "Satisfait ou remboursé, pièce non montée.",
                  },
                ].map(({ icon: Icon, t, d }) => (
                  <li key={t} className="flex items-start gap-3">
                    <Icon
                      size={22}
                      className="shrink-0"
                      style={{ color: "var(--c-cta)" }}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold">{t}</span>
                      <span className="text-xs text-white/70">{d}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <V5SectionHeading eyebrow="04 · Tendances" title="Recherches" />
        <div className="px-4">
          <ul className="flex flex-col gap-2">
            {[
              "Plaquettes de frein 308",
              "Filtre à huile 1.6 BlueHDi",
              "Kit embrayage Valeo",
              "Disques avant Brembo",
            ].map((t) => (
              <li key={t} className="v5-card">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3"
                  onClick={() => navigate("/v5/liste")}
                >
                  <span className="flex items-center gap-2">
                    <SearchIcon
                      size={16}
                      style={{ color: "var(--c-ink-soft)" }}
                      aria-hidden="true"
                    />
                    <span style={{ color: "var(--c-ink)" }}>{t}</span>
                  </span>
                  <ChevronRight
                    size={16}
                    style={{ color: "var(--c-ink-soft)" }}
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
