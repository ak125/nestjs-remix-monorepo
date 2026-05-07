/**
 * V5 Produit — /v5/produit/:ref
 * Fiche produit mock (ship 1).
 */

import {
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
} from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Check, Heart, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { V5Badge, V5StickyCTA } from "~/components/v5/atoms";
import { findProduct, PRODUCTS, type V5Product } from "~/components/v5/data";
import { V5Header } from "~/components/v5/Header";
import { useV5Cart } from "~/components/v5/hooks/useV5Cart";
import { useV5Vehicle } from "~/components/v5/hooks/useV5Vehicle";
import { V5ProductCard } from "~/components/v5/ProductCard";
import { V5QuantityStepper } from "~/components/v5/QuantityStepper";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.product) return [{ title: "Produit introuvable" }];
  return [{ title: `${data.product.name} · AutoMecanik` }];
};

export const loader = ({ params }: LoaderFunctionArgs) => {
  const ref = params.ref ?? "";
  const product = findProduct(decodeURIComponent(ref));
  if (!product) {
    throw new Response("Produit introuvable", { status: 404 });
  }
  const cross = PRODUCTS.filter(
    (p) => p.cat === product.cat && p.ref !== product.ref,
  ).slice(0, 3);
  return json({ product, cross });
};

export default function V5ProduitRoute() {
  const navigate = useNavigate();
  const { product, cross } = useLoaderData<typeof loader>();
  const { label, sub } = useV5Vehicle();
  const cart = useV5Cart();
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    cart.add(product, qty);
    navigate("/v5/panier");
  };

  const handleAddCross = (p: V5Product) => cart.add(p);

  const total = (product.price * qty).toFixed(2);
  const promoPct =
    product.priceOld != null
      ? Math.round(
          ((product.priceOld - product.price) / product.priceOld) * 100,
        )
      : null;

  return (
    <>
      <V5Header
        title=" "
        leftIcon="back"
        light
        onLeft={() => navigate("/v5/liste")}
        rightIcons={[
          { icon: Heart, label: "Ajouter aux favoris" },
          {
            icon: ShoppingCart,
            label: "Panier",
            badge: cart.count || null,
            onClick: () => navigate("/v5/panier"),
          },
        ]}
      />

      <main className="v5-main-with-cta flex-1">
        <div className="v5-gallery">
          <span className="v5-gallery-mono" aria-hidden="true">
            {product.ref}
          </span>
          {product.badge && (
            <span className="v5-gallery-badge">
              <V5Badge variant={product.badgeVariant ?? "promo"}>
                {product.badge}
              </V5Badge>
            </span>
          )}
          <span className="v5-gallery-dots" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`v5-gallery-dot${i === 0 ? " is-active" : ""}`}
              />
            ))}
          </span>
        </div>

        <div className="px-4 pt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <V5Badge variant="dark">{product.brand}</V5Badge>
              <V5Badge variant="success">
                <Check size={10} strokeWidth={3} aria-hidden="true" />{" "}
                Compatible
              </V5Badge>
            </div>
            <h1 className="v5-h2" style={{ fontSize: 22 }}>
              {product.name}
            </h1>
            <span
              className="v5-mono"
              style={{ fontSize: 12, color: "var(--c-ink-soft)" }}
            >
              Réf. OE · {product.ref}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="v5-num" style={{ fontSize: 32 }}>
              {product.price.toFixed(2)}€
            </span>
            {product.priceOld != null && (
              <>
                <span className="v5-product-price-old" style={{ fontSize: 14 }}>
                  {product.priceOld.toFixed(2)}€
                </span>
                {promoPct != null && promoPct > 0 && (
                  <V5Badge variant="promo">−{promoPct}%</V5Badge>
                )}
              </>
            )}
          </div>

          {label && (
            <div className="v5-card v5-card-dark">
              <div className="v5-card-body">
                <div className="flex items-center gap-3">
                  <Check
                    size={22}
                    strokeWidth={2.5}
                    style={{ color: "var(--c-yellow-500)" }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1">
                    <span
                      className="v5-eyebrow"
                      style={{ color: "var(--c-yellow-500)" }}
                    >
                      Compatible
                    </span>
                    <span className="text-sm font-bold">{label}</span>
                    {sub && (
                      <span className="text-xs text-white/70">{sub}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="v5-h3">Caractéristiques</h2>
            <div className="v5-card">
              <dl className="flex flex-col">
                {[
                  ["Fabricant", product.brand],
                  ["Référence OE", product.ref],
                  ["Type", "Plaquettes avant"],
                  ["Diamètre", "Ø 283 mm"],
                  ["Garantie", "2 ans"],
                ].map(([k, v]) => (
                  <div key={k} className="v5-spec-row">
                    <dt className="v5-spec-key">{k}</dt>
                    <dd className="v5-spec-val">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {cross.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="v5-h3">Souvent achetés ensemble</h2>
              <div className="grid grid-cols-3 gap-3">
                {cross.map((p) => (
                  <V5ProductCard
                    key={p.ref}
                    product={p}
                    onAdd={handleAddCross}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <V5StickyCTA>
        <V5QuantityStepper value={qty} onChange={setQty} />
        <button
          type="button"
          className="v5-btn v5-btn-primary v5-btn-md"
          style={{ flex: 1 }}
          onClick={handleAdd}
          disabled={product.stock === 0}
        >
          <ShoppingCart size={18} aria-hidden="true" />
          {product.stock === 0 ? "Indisponible" : `Ajouter — ${total}€`}
        </button>
      </V5StickyCTA>
    </>
  );
}
