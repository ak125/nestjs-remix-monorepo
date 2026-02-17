import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Home,
  Wrench,
  Car,
  BookOpen,
  HelpCircle,
  Scale,
  ChevronRight,
  ScanLine,
  Newspaper,
  MapPin,
  Package,
  Search,
} from "lucide-react";
import { getInternalApiUrl } from "~/utils/internal-api.server";

export const meta: MetaFunction = () => [
  { title: "Plan du site - Automecanik | Pièces auto en ligne" },
  {
    name: "description",
    content:
      "Plan du site Automecanik : accédez facilement à notre catalogue complet de pièces détachées, constructeurs automobiles, guides et services.",
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
      fetch(`${baseUrl}/api/vehicles/brands?limit=200`, {
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
  { href: "#pages", label: "Pages principales", icon: Home },
  { href: "#catalogue", label: "Catalogue pièces", icon: Wrench },
  { href: "#constructeurs", label: "Constructeurs", icon: Car },
  { href: "#blog", label: "Blog & Contenu", icon: BookOpen },
  { href: "#aide", label: "Aide & Services", icon: HelpCircle },
  { href: "#legal", label: "Informations légales", icon: Scale },
];

const mainPages = [
  { to: "/", label: "Accueil", desc: "Page d'accueil du site" },
  {
    to: "/#catalogue",
    label: "Catalogue pièces",
    desc: "Toutes les familles de pièces",
  },
  {
    to: "/#toutes-les-marques",
    label: "Marques automobiles",
    desc: "Trouver par constructeur",
  },
  {
    to: "/blog-pieces-auto",
    label: "Blog & Conseils",
    desc: "Articles, guides et fiches",
  },
  {
    to: "/contact",
    label: "Contact",
    desc: "Nous contacter",
  },
];

const blogLinks = [
  {
    to: "/blog-pieces-auto",
    label: "Articles & Actualités",
    icon: Newspaper,
  },
  {
    to: "/blog-pieces-auto/conseils",
    label: "Conseils par catégorie",
    icon: BookOpen,
  },
  {
    to: "/blog-pieces-auto/guide-achat",
    label: "Guides pratiques",
    icon: MapPin,
  },
  {
    to: "/blog-pieces-auto/constructeurs",
    label: "Fiches constructeurs",
    icon: Car,
  },
  {
    to: "/blog-pieces-auto/auto",
    label: "Par marque automobile",
    icon: Search,
  },
  { to: "/diagnostic-auto", label: "Diagnostic auto", icon: ScanLine },
  {
    to: "/reference-auto",
    label: "Glossaire technique",
    icon: BookOpen,
  },
];

const aideLinks = [
  { to: "/legal/faq", label: "Foire aux questions" },
  { to: "/legal/shipping", label: "Livraison & Délais" },
  { to: "/legal/warranty", label: "Garantie & Retours" },
  { to: "/legal/suivi", label: "Suivi de commande" },
  { to: "/legal/paiement", label: "Moyens de paiement" },
  { to: "/legal/devis", label: "Demander un devis" },
  { to: "/legal/reclamations", label: "Réclamations" },
];

const legalLinks = [
  { to: "/legal/cgv", label: "Conditions générales de vente" },
  { to: "/legal/legal-notice", label: "Mentions légales" },
  { to: "/legal/privacy", label: "Politique de confidentialité" },
  { to: "/legal/cookies", label: "Gestion des cookies" },
  { to: "/legal/about", label: "Qui sommes-nous" },
];

export default function PlanDuSite() {
  const { families, brands, totalGammes } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Plan du site - Automecanik",
            description:
              "Plan du site complet Automecanik : catalogue de pièces détachées, constructeurs et services.",
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Accueil",
                  item: "https://www.automecanik.com/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Plan du site",
                  item: "https://www.automecanik.com/plan-du-site",
                },
              ],
            },
          }),
        }}
      />

      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <nav className="text-sm text-gray-500 mb-4">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">Plan du site</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Plan du site
          </h1>
          <p className="text-gray-500 text-lg">
            Naviguez facilement dans l&apos;ensemble du catalogue Automecanik
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full font-medium">
              <Package className="w-3.5 h-3.5" />
              {families.length} familles
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
              <Wrench className="w-3.5 h-3.5" />
              {totalGammes} gammes
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full font-medium">
              <Car className="w-3.5 h-3.5" />
              {brands.length} constructeurs
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Navigation rapide — sticky */}
        <nav className="mb-10 sticky top-0 z-10 bg-white/95 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {quickNav.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-50 border rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>

        {/* Pages principales */}
        <section id="pages" className="mb-12 scroll-mt-24">
          <SectionHeader icon={Home} title="Pages principales" color="blue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {mainPages.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className="group flex items-center gap-3 p-4 bg-white border rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {page.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{page.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
              </Link>
            ))}
          </div>
        </section>

        {/* Catalogue par famille */}
        {families.length > 0 && (
          <section id="catalogue" className="mb-12 scroll-mt-24">
            <SectionHeader
              icon={Wrench}
              title="Catalogue pièces détachées"
              color="emerald"
              subtitle={`${families.length} familles — ${totalGammes} gammes de pièces`}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {families.map((family) => {
                const validGammes = family.gammes?.filter(
                  (g) => g.pg_alias && g.pg_id,
                );
                if (!validGammes?.length) return null;

                return (
                  <div
                    key={family.mf_id}
                    className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900">
                        {family.mf_name_system || family.mf_name}
                      </h3>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                        {validGammes.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {validGammes.map((gamme) => (
                        <li key={gamme.pg_id}>
                          <Link
                            to={`/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`}
                            className="group flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors py-0.5"
                          >
                            <ChevronRight className="w-3 h-3 mr-1.5 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
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
          <section id="constructeurs" className="mb-12 scroll-mt-24">
            <SectionHeader
              icon={Car}
              title="Constructeurs automobiles"
              color="amber"
              subtitle={`${brands.length} constructeurs couverts`}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {brands.map((brand) => (
                <Link
                  key={brand.marque_id}
                  to={`/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`}
                  className="group flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-all text-center"
                >
                  {brand.marque_name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Blog & Contenu */}
        <section id="blog" className="mb-12 scroll-mt-24">
          <SectionHeader
            icon={BookOpen}
            title="Blog & Contenu"
            color="indigo"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {blogLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex items-center gap-3 p-4 bg-white border rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="p-2 bg-indigo-50 rounded-lg shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <Icon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
                    {link.label}
                  </p>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 ml-auto transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Aide & Services + Informations légales — side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Aide & Services */}
          <section id="aide" className="scroll-mt-24">
            <SectionHeader
              icon={HelpCircle}
              title="Aide & Services"
              color="purple"
            />
            <div className="bg-white border rounded-xl divide-y">
              {aideLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-sm text-gray-700 group-hover:text-purple-700 transition-colors">
                    {link.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* Informations légales */}
          <section id="legal" className="scroll-mt-24">
            <SectionHeader
              icon={Scale}
              title="Informations légales"
              color="gray"
            />
            <div className="bg-white border rounded-xl divide-y">
              {legalLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                    {link.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Section Header ──────────── */

const SECTION_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    border: "border-indigo-200",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
  },
  gray: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-200",
  },
};

function SectionHeader({
  icon: Icon,
  title,
  color,
  subtitle,
}: {
  icon: typeof Home;
  title: string;
  color: string;
  subtitle?: string;
}) {
  const c = SECTION_COLORS[color] || SECTION_COLORS.blue;

  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`p-2.5 ${c.bg} rounded-xl border ${c.border}`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
