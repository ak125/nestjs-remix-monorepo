import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getInternalApiUrl } from "~/utils/internal-api.server";

export const meta: MetaFunction = () => [
  { title: "Plan du site - Automecanik" },
  {
    name: "description",
    content:
      "Plan du site Automecanik : catalogue complet de pièces détachées automobiles organisé par famille, constructeur et gamme.",
  },
  { name: "robots", content: "index, follow" },
];

interface Gamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
}

interface Family {
  mf_id: number;
  mf_name: string;
  mf_name_system?: string;
  gammes: Gamme[];
  gammes_count?: number;
}

interface Brand {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = getInternalApiUrl("");

  try {
    const [familiesRes, brandsRes] = await Promise.all([
      fetch(`${baseUrl}/api/catalog/families`, {
        headers: { "internal-call": "true" },
      }),
      fetch(`${baseUrl}/api/vehicles/brands?limit=50`, {
        headers: { "internal-call": "true" },
      }),
    ]);

    let families: Family[] = [];
    if (familiesRes.ok) {
      const data = await familiesRes.json();
      families = data.success && data.families ? data.families : [];
    }

    let brands: Brand[] = [];
    if (brandsRes.ok) {
      const data = await brandsRes.json();
      brands = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
    }

    const totalGammes = families.reduce(
      (sum, f) => sum + (f.gammes?.length || 0),
      0,
    );

    return json({ families, brands, totalGammes });
  } catch {
    return json({
      families: [] as Family[],
      brands: [] as Brand[],
      totalGammes: 0,
    });
  }
}

const quickNav = [
  { href: "#pages", label: "Pages principales" },
  { href: "#catalogue", label: "Catalogue pièces" },
  { href: "#constructeurs", label: "Constructeurs" },
  { href: "#blog", label: "Blog & Contenu" },
  { href: "#aide", label: "Aide & Services" },
  { href: "#legal", label: "Informations légales" },
];

const mainPages = [
  { to: "/", label: "Accueil" },
  { to: "/#catalogue", label: "Catalogue pièces" },
  { to: "/#toutes-les-marques", label: "Marques automobiles" },
  { to: "/blog-pieces-auto", label: "Blog & Conseils" },
  { to: "/contact", label: "Contact" },
];

const blogLinks = [
  { to: "/blog-pieces-auto", label: "Articles & Actualités" },
  { to: "/blog-pieces-auto/conseils", label: "Conseils par catégorie" },
  { to: "/blog-pieces-auto/guide", label: "Guides pratiques" },
  {
    to: "/blog-pieces-auto/constructeurs",
    label: "Fiches constructeurs",
  },
  { to: "/blog-pieces-auto/auto", label: "Par marque automobile" },
  { to: "/diagnostic-auto", label: "Diagnostic auto" },
  { to: "/reference-auto", label: "Référence technique" },
];

const aideLinks = [
  { to: "/legal/faq", label: "FAQ" },
  { to: "/legal/shipping", label: "Livraison" },
  { to: "/legal/warranty", label: "Garantie & Retours" },
  { to: "/legal/suivi", label: "Suivi de commande" },
  { to: "/legal/paiement", label: "Paiement" },
  { to: "/legal/devis", label: "Devis" },
  { to: "/legal/reclamations", label: "Réclamations" },
];

const legalLinks = [
  { to: "/legal/cgv", label: "Conditions générales de vente" },
  { to: "/legal/legal-notice", label: "Mentions légales" },
  {
    to: "/legal/privacy",
    label: "Politique de confidentialité",
  },
  { to: "/legal/cookies", label: "Gestion des cookies" },
  { to: "/legal/about", label: "Qui sommes-nous" },
];

export default function PlanDuSite() {
  const { families, brands, totalGammes } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Plan du site
          </h1>
          <p className="text-gray-500">
            {families.length} familles de pièces, {totalGammes} gammes,{" "}
            {brands.length}+ constructeurs automobiles.
          </p>
        </div>

        {/* Navigation rapide */}
        <nav className="mb-10 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Accès rapide
          </h2>
          <div className="flex flex-wrap gap-2">
            {quickNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-sm bg-white border rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Pages principales */}
        <section id="pages" className="mb-12 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Pages principales
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {mainPages.map((page) => (
              <li key={page.to}>
                <Link to={page.to} className="text-blue-600 hover:underline">
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Catalogue par famille */}
        {families.length > 0 && (
          <section id="catalogue" className="mb-12 scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-2 border-b pb-2">
              Catalogue pièces détachées
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {families.length} familles — {totalGammes} gammes de pièces
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {families.map((family) => {
                const validGammes = family.gammes?.filter(
                  (g) => g.pg_alias && g.pg_id,
                );
                if (!validGammes?.length) return null;

                return (
                  <div
                    key={family.mf_id}
                    className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <h3 className="font-bold text-gray-900 mb-1">
                      {family.mf_name_system || family.mf_name}
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">
                      {validGammes.length} gammes
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {validGammes.map((gamme) => (
                        <li key={gamme.pg_id}>
                          <Link
                            to={`/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`}
                            className="text-blue-600 hover:underline"
                          >
                            {gamme.pg_name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Constructeurs automobiles */}
        {brands.length > 0 && (
          <section id="constructeurs" className="mb-12 scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-2 border-b pb-2">
              Constructeurs automobiles
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {brands.length} constructeurs couverts
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {brands.map((brand) => (
                <Link
                  key={brand.marque_id}
                  to={`/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`}
                  className="px-3 py-2 text-sm text-center bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg border transition-colors"
                >
                  {brand.marque_name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Blog & Contenu */}
        <section id="blog" className="mb-12 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Blog & Contenu
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {blogLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-blue-600 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Aide & Services */}
        <section id="aide" className="mb-12 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Aide & Services
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {aideLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-blue-600 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Informations légales */}
        <section id="legal" className="mb-12 scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Informations légales
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {legalLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-blue-600 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
