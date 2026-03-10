// app/routes/legal.$pageKey.tsx - Pages légales dynamiques
// Fetches from ___META_TAGS_ARIANE via API with fallback to static content
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useParams,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import Container from "~/components/layout/Container";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    clusterId: "legal",
  }),
};

const API_URL = getInternalApiUrl("");

interface LegalPageFromDB {
  alias: string;
  title: string;
  description: string;
  keywords: string;
  h1: string;
  content: string;
  breadcrumb: string;
  indexable: boolean;
}

interface LegalPageStatic {
  title: string;
  content: string;
  lastUpdated: string;
  key: string;
}

// Mapping des routes vers les alias de la base de données
const routeToAliasMap: Record<string, string> = {
  cgv: "cgv",
  privacy: "cpuc", // Confidentialité/Privacy -> cpuc
  terms: "cdu", // Conditions d'utilisation -> cdu
  cookies: "cookies",
  "legal-notice": "ml", // Mentions légales -> ml
  shipping: "liv", // Livraison
  warranty: "gcrg", // Garantie
  faq: "faq",
  contact: "contact",
  concept: "concept",
  about: "us", // About us
  reclamations: "reclamations",
  paiement: "paiement",
  suivi: "suivi",
  devis: "devis",
  typemine: "typemine",
  avis: "avis",
};

// Contenu statique de fallback si l'API échoue
const staticPages: Record<string, LegalPageStatic> = {
  cgv: {
    key: "cgv",
    title: "Conditions Générales de Vente",
    lastUpdated: "2024-12-01",
    content: `<h1>Conditions Générales de Vente</h1>
<h2>1. Objet</h2>
<p>Les présentes conditions générales de vente s'appliquent à toutes les commandes passées sur le site www.automecanik.com.</p>
<h2>2. Prix</h2>
<p>Les prix sont indiqués en euros TTC. Les frais de livraison sont indiqués avant validation de la commande.</p>
<h2>3. Garantie</h2>
<p>Nos produits bénéficient de la garantie légale de conformité (2 ans).</p>
<h2>4. Droit de rétractation</h2>
<p>Vous disposez d'un délai de 14 jours pour exercer votre droit de rétractation.</p>
<h2>5. Contact</h2>
<p>Pour toute question, contactez-nous à contact@automecanik.com</p>`,
  },
  privacy: {
    key: "privacy",
    title: "Politique de Confidentialité",
    lastUpdated: "2024-12-01",
    content: `<h1>Politique de Confidentialité</h1>
<h2>1. Collecte des Informations</h2>
<p>Nous collectons les informations nécessaires au traitement de vos commandes.</p>
<h2>2. Utilisation des Données</h2>
<p>Vos données sont utilisées pour traiter vos commandes et améliorer nos services.</p>
<h2>3. Vos Droits</h2>
<p>Conformément au RGPD, vous disposez d'un droit d'accès, rectification et suppression de vos données.</p>
<h2>4. Contact</h2>
<p>Pour exercer vos droits, contactez-nous à contact@automecanik.com</p>`,
  },
  terms: {
    key: "terms",
    title: "Conditions Générales d'Utilisation",
    lastUpdated: "2024-12-01",
    content: `<h1>Conditions Générales d'Utilisation</h1>
<h2>1. Acceptation</h2>
<p>En utilisant le site www.automecanik.com, vous acceptez les présentes conditions.</p>
<h2>2. Service</h2>
<p>Automecanik est une plateforme de vente de pièces détachées automobiles.</p>
<h2>3. Propriété Intellectuelle</h2>
<p>Tous les contenus du site sont protégés par les lois sur la propriété intellectuelle.</p>`,
  },
  cookies: {
    key: "cookies",
    title: "Politique de Cookies",
    lastUpdated: "2024-12-01",
    content: `<h1>Politique de Cookies</h1>
<h2>1. Qu'est-ce qu'un Cookie ?</h2>
<p>Un cookie est un petit fichier texte stocké sur votre appareil lors de votre visite.</p>
<h2>2. Types de Cookies</h2>
<ul>
<li><strong>Cookies essentiels</strong> : fonctionnement du site</li>
<li><strong>Cookies de performance</strong> : amélioration du site</li>
<li><strong>Cookies de fonctionnalité</strong> : préférences utilisateur</li>
</ul>
<h2>3. Gestion</h2>
<p>Vous pouvez gérer les cookies via les paramètres de votre navigateur.</p>`,
  },
  "legal-notice": {
    key: "legal-notice",
    title: "Mentions Légales",
    lastUpdated: "2024-12-01",
    content: `<h1>Mentions Légales</h1>
<h2>Éditeur du Site</h2>
<p>Site : www.automecanik.com<br/>Email : contact@automecanik.com</p>
<h2>Hébergement</h2>
<p>Services cloud sécurisés conformes aux normes européennes.</p>
<h2>Propriété Intellectuelle</h2>
<p>Tous les contenus sont protégés. Toute reproduction est interdite sans autorisation.</p>`,
  },
};

// Liste des pages pour la navigation - groupées par catégorie
const legalPages = [
  { key: "cgv", title: "CGV", icon: "📄" },
  { key: "privacy", title: "Confidentialité", icon: "🔒" },
  { key: "terms", title: "CGU", icon: "📋" },
  { key: "cookies", title: "Cookies", icon: "🍪" },
  { key: "legal-notice", title: "Mentions légales", icon: "⚖️" },
];

const helpPages = [
  { key: "faq", title: "FAQ", icon: "❓" },
  { key: "suivi", title: "Suivi commande", icon: "📦" },
  { key: "reclamations", title: "Réclamations", icon: "📝" },
  { key: "devis", title: "Devis", icon: "💰" },
  { key: "typemine", title: "Type mine", icon: "🔍" },
];

const infoPages = [
  { key: "shipping", title: "Livraison", icon: "🚚" },
  { key: "paiement", title: "Paiement", icon: "💳" },
  { key: "warranty", title: "Garantie & Retours", icon: "✅" },
  { key: "avis", title: "Avis clients", icon: "⭐" },
  { key: "about", title: "Qui sommes-nous", icon: "🏢" },
  { key: "contact", title: "Contact", icon: "📞" },
];

const _availablePages = [...legalPages, ...helpPages, ...infoPages];

// Pages qui ne doivent PAS être indexées (contenu juridique standard)
const noIndexPages = ["cgv", "privacy", "terms", "cookies", "legal-notice"];

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || "error" in data) {
    return [
      { title: "Page non trouvée - Automecanik" },
      {
        name: "description",
        content: "La page légale demandée n'existe pas.",
      },
    ];
  }

  // Déterminer si la page doit être indexée
  const shouldIndex = !noIndexPages.includes(data.page.key);
  const robotsContent = shouldIndex ? "index, follow" : "noindex, follow";

  // Schema.org WebPage
  const schemaWebPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: data.page.title,
    description: data.page.description || `${data.page.title} - Automecanik`,
    url: `https://www.automecanik.com/legal/${data.page.key}`,
    publisher: {
      "@type": "Organization",
      name: "AUTO PIÈCES EQUIPEMENTS",
      url: "https://www.automecanik.com",
      logo: "https://www.automecanik.com/logo.png",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+33177695892",
        contactType: "customer service",
        availableLanguage: "French",
      },
    },
    mainEntity: {
      "@type": "Organization",
      name: "AUTO PIÈCES EQUIPEMENTS",
      legalName: "AUTO PIÈCES EQUIPEMENTS SASU",
      address: {
        "@type": "PostalAddress",
        streetAddress: "184 avenue Aristide Briand",
        addressLocality: "Les Pavillons-sous-Bois",
        postalCode: "93320",
        addressCountry: "FR",
      },
    },
  };

  // Schema.org BreadcrumbList
  const schemaBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://www.automecanik.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: data.page.title,
        item: `https://www.automecanik.com/legal/${data.page.key}`,
      },
    ],
  };

  return [
    { title: `${data.page.title} - Automecanik` },
    {
      name: "description",
      content: data.page.description || `${data.page.title} - Automecanik`,
    },
    ...(data.page.keywords
      ? [{ name: "keywords", content: data.page.keywords }]
      : []),
    { name: "robots", content: robotsContent },
    // Canonical
    {
      tagName: "link",
      rel: "canonical",
      href: `https://www.automecanik.com/legal/${data.page.key}`,
    },
    // Schema.org JSON-LD
    {
      "script:ld+json": schemaWebPage,
    },
    {
      "script:ld+json": schemaBreadcrumb,
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const pageKey = params.pageKey;

  if (!pageKey) {
    throw new Response("Page légale non trouvée", { status: 404 });
  }

  // Trouver l'alias correspondant pour la base de données
  const dbAlias = routeToAliasMap[pageKey];

  // Essayer de récupérer depuis l'API (___META_TAGS_ARIANE)
  if (dbAlias) {
    try {
      const response = await fetch(
        `${API_URL}/api/support/legal/ariane/${dbAlias}`,
        {
          headers: { Accept: "application/json" },
        },
      );

      if (response.ok) {
        const dbPage: LegalPageFromDB = await response.json();

        return json({
          page: {
            key: pageKey,
            title: dbPage.h1 || dbPage.title,
            content: dbPage.content,
            description: dbPage.description,
            keywords: dbPage.keywords,
            breadcrumb: dbPage.breadcrumb,
            indexable: dbPage.indexable,
          },
          fromDB: true,
        });
      }
    } catch (error) {
      logger.warn(`Failed to fetch legal page from API for ${pageKey}:`, error);
    }
  }

  // Fallback sur le contenu statique
  const staticPage = staticPages[pageKey];
  if (!staticPage) {
    throw new Response("Page légale non trouvée", { status: 404 });
  }

  return json({
    page: {
      key: staticPage.key,
      title: staticPage.title,
      content: staticPage.content,
      description: "",
      keywords: "",
      breadcrumb: staticPage.title,
      indexable: true,
    },
    fromDB: false,
  });
}

export default function LegalPage() {
  const { page } = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec bandeau coloré */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <Container size="default">
          {/* Breadcrumb */}
          <nav className="text-sm text-blue-200 mb-4">
            <Link to="/" className="hover:text-white transition-colors">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{page.breadcrumb || page.title}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold">{page.title}</h1>
        </Container>
      </div>

      <Container size="default" className="py-8">
        {/* Content - HTML from database */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 mb-8">
          <HtmlContent
            html={page.content}
            className="prose prose-lg max-w-none
              prose-headings:text-gray-900 prose-headings:font-bold
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-gray-600 prose-p:leading-relaxed
              prose-li:text-gray-600
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-gray-900
              prose-ul:my-4 prose-ol:my-4"
            trackLinks={false}
          />
        </div>

        {/* Section Contact */}
        <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            📞 Besoin d'aide ?
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <a
                  href="tel:+33177695892"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  01 77 69 58 92
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">✉️</span>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <a
                  href="mailto:contact@automecanik.com"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  contact@automecanik.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🕐</span>
              <div>
                <p className="text-sm text-gray-500">Horaires</p>
                <p className="font-semibold text-gray-900">Lun-Ven : 8h-18h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation groupée par catégorie */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Autres pages utiles
          </h3>

          {/* Pages légales */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Informations légales
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {legalPages
                .filter((p) => p.key !== params.pageKey)
                .map((legalPage) => (
                  <Link
                    key={legalPage.key}
                    to={`/legal/${legalPage.key}`}
                    className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-sm"
                  >
                    <span>{legalPage.icon}</span>
                    <span className="font-medium text-gray-700">
                      {legalPage.title}
                    </span>
                  </Link>
                ))}
            </div>
          </div>

          {/* Pages d'aide */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Aide & Support
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {helpPages
                .filter((p) => p.key !== params.pageKey)
                .map((helpPage) => (
                  <Link
                    key={helpPage.key}
                    to={`/legal/${helpPage.key}`}
                    className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all text-sm"
                  >
                    <span>{helpPage.icon}</span>
                    <span className="font-medium text-gray-700">
                      {helpPage.title}
                    </span>
                  </Link>
                ))}
            </div>
          </div>

          {/* Pages d'info */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Informations
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {infoPages
                .filter((p) => p.key !== params.pageKey)
                .map((infoPage) => (
                  <Link
                    key={infoPage.key}
                    to={`/legal/${infoPage.key}`}
                    className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-300 transition-all text-sm"
                  >
                    <span>{infoPage.icon}</span>
                    <span className="font-medium text-gray-700">
                      {infoPage.title}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
