/**
 * Preview Mobile — Home (/preview-mobile)
 *
 * Validation visuelle de l'écran d'accueil mobile-V5 avec :
 * plaque jaune signature, hero navy, stats band, catégories scrollables,
 * sélection produits, why-card, recherches.
 */

import { useNavigate } from "@remix-run/react";
import {
  Bolt,
  ChevronRight,
  Filter as FilterIcon,
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
  MV5HScroll,
  MV5Pill,
  MV5SectionHeading,
  MV5StatsBand,
} from "~/components/mobile-v5/atoms";
import { MV5Header } from "~/components/mobile-v5/Header";
import { MV5Plaque } from "~/components/mobile-v5/Plaque";
import {
  MV5_CATEGORIES,
  MV5_PREVIEW_VEHICLE,
  MV5_PRODUCTS,
} from "~/components/mobile-v5/preview-fixtures";
import { MV5ProductCard } from "~/components/mobile-v5/ProductCard";
import { usePreviewCart } from "~/components/mobile-v5/usePreviewCart";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  shield: Shield,
  bolt: Bolt,
  filter: FilterIcon,
  wrench: Wrench,
  flame: Flame,
  truck: Truck,
};

export default function PreviewMobileHome() {
  const navigate = useNavigate();
  const cart = usePreviewCart();
  const featured = MV5_PRODUCTS.slice(0, 4);
  const promos = MV5_PRODUCTS.filter((p) => p.priceOld);
  const cartBadge = cart.count > 0 ? cart.count : null;

  return (
    <>
      <MV5Header
        title="AUTOMECANIK"
        leftIcon="menu"
        rightIcons={[
          {
            icon: User,
            label: "Mon compte",
            onClick: () => navigate("/preview-mobile/compte"),
          },
          {
            icon: ShoppingCart,
            label: "Panier",
            badge: cartBadge,
            onClick: () => navigate("/preview-mobile/panier"),
          },
        ]}
      />

      <main className="flex-1 pb-24">
        <section className="mv5-hero">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="mv5-eyebrow mv5-eyebrow-on-dark">
                Pièces auto · Compatibilité garantie
              </span>
              <h1 className="mv5-h1">
                La bonne pièce,
                <br />
                du premier coup.
              </h1>
            </div>
            <MV5Plaque vehicle={MV5_PREVIEW_VEHICLE.label} />
            <span className="mv5-hero-sub">{MV5_PREVIEW_VEHICLE.sub}</span>
            <div className="mv5-search">
              <SearchIcon
                className="mv5-search-icon"
                size={18}
                aria-hidden="true"
              />
              <input
                type="search"
                className="mv5-input"
                placeholder="Référence, pièce, marque…"
                aria-label="Rechercher une pièce"
              />
            </div>
          </div>
        </section>

        <MV5StatsBand
          items={[
            { num: "500K+", label: "Références" },
            { num: "24h", label: "Livraison" },
            { num: "30j", label: "Retours" },
          ]}
        />

        <MV5SectionHeading
          eyebrow="01 · Catalogue"
          title="Par catégorie"
          action="Tout voir"
          onAction={() => navigate("/preview-mobile/catalog")}
        />
        <MV5HScroll>
          {MV5_CATEGORIES.map((c) => (
            <MV5Pill
              key={c.key}
              icon={CATEGORY_ICON[c.iconKey] ?? Wrench}
              onClick={() => navigate("/preview-mobile/catalog")}
            >
              {c.label}
            </MV5Pill>
          ))}
        </MV5HScroll>

        <MV5SectionHeading
          eyebrow="02 · Pour votre véhicule"
          title="Sélection"
          action="Voir tout"
          onAction={() => navigate("/preview-mobile/catalog")}
        />
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {featured.map((p) => (
              <MV5ProductCard
                key={p.ref}
                product={p}
                onAdd={(prod) => cart.add(prod)}
              />
            ))}
          </div>
        </div>

        <MV5SectionHeading
          eyebrow="03 · En ce moment"
          title="Promotions"
          action="Voir tout"
          onAction={() => navigate("/preview-mobile/catalog")}
        />
        <MV5HScroll>
          {promos.map((p) => (
            <div key={p.ref} className="w-44 shrink-0">
              <MV5ProductCard product={p} onAdd={(prod) => cart.add(prod)} />
            </div>
          ))}
        </MV5HScroll>

        <section className="px-4 py-6">
          <div className="mv5-card mv5-card-dark">
            <div className="mv5-card-body flex flex-col gap-4">
              <span className="mv5-eyebrow mv5-eyebrow-on-dark">
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
                      className="shrink-0 text-cta"
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

        <MV5SectionHeading eyebrow="04 · Tendances" title="Recherches" />
        <div className="px-4">
          <ul className="flex flex-col gap-2">
            {[
              "Plaquettes de frein 308",
              "Filtre à huile 1.6 BlueHDi",
              "Kit embrayage Valeo",
              "Disques avant Brembo",
            ].map((t) => (
              <li key={t} className="mv5-card">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 mv5-text-soft"
                  onClick={() => navigate("/preview-mobile/catalog")}
                >
                  <span className="flex items-center gap-2">
                    <SearchIcon size={16} aria-hidden="true" />
                    <span className="mv5-h3">{t}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
