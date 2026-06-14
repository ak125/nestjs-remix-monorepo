/**
 * Route : /pieces/produits-universels
 * Section « Produits universels » (T2b) — gammes sans véhicule (consommables /
 * visserie / fluides / joints), vendables mais invisibles ailleurs.
 *
 * Data : GET /api/catalog/universal/section (flag SHOW_ACCESSORY… → ici
 * SHOW_UNIVERSAL_SECTION, défaut OFF → { enabled:false } → rien d'affiché).
 * Source produits = get_gamme_price_preview (sans véhicule), réutilisée.
 *
 * SEO : noindex/nofollow tant que la section n'est pas validée par l'owner.
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Boxes } from "lucide-react";
import { formatPrice } from "~/utils/format";
import { logger } from "~/utils/logger";

interface PreviewProduct {
  piece_id: number;
  name: string;
  ref: string;
  price: number;
  brand_name: string;
}
interface UniversalGamme {
  pgId: number;
  pgName: string;
  pgAlias: string | null;
  sellablePieces: number;
  preview: { min_price: number | null; products: PreviewProduct[] } | null;
}
interface SectionData {
  enabled: boolean;
  gammes: UniversalGamme[];
}

export async function loader(_args: LoaderFunctionArgs) {
  let section: SectionData = { enabled: false, gammes: [] };
  try {
    const res = await fetch(
      "http://127.0.0.1:3000/api/catalog/universal/section",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      section = (await res.json()) as SectionData;
    } else {
      logger.warn(`[UNIVERSAL_SECTION] API non-ok: ${res.status}`);
    }
  } catch (e) {
    // fail-soft observable (no silent fallback): logged, renders an empty section.
    logger.warn(
      `[UNIVERSAL_SECTION] fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return json(section);
}

// noindex tant que la section n'est pas validée (nouvelle URL publique).
export const headers = () => ({
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "public, max-age=300, s-maxage=600",
});

export const meta: MetaFunction = () => [
  { title: "Produits universels | Automecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function ProduitsUniversels() {
  const { enabled, gammes } = useLoaderData<typeof loader>();

  if (!enabled || gammes.length === 0) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="text-gray-500">Section produits universels indisponible.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8 flex items-center gap-3">
        <Boxes className="h-8 w-8 text-amber-600" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produits universels</h1>
          <p className="text-sm text-gray-600">
            Consommables, visserie, joints et fluides — vendus sans véhicule.
          </p>
        </div>
      </header>

      <div className="space-y-10">
        {gammes.map((g) => (
          <section key={g.pgId}>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              {g.pgName}{" "}
              <span className="text-sm font-normal text-gray-500">
                ({g.sellablePieces} réf.
                {g.preview?.min_price ? ` · dès ${formatPrice(g.preview.min_price)}` : ""})
              </span>
            </h2>
            {g.preview?.products?.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {g.preview.products.map((p) => (
                  <div
                    key={p.piece_id}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="line-clamp-2 text-sm font-medium text-gray-900">
                      {p.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {p.brand_name} · {p.ref}
                    </div>
                    <div className="mt-2 font-semibold text-gray-900">
                      {formatPrice(p.price)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Produits bientôt disponibles.</p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
