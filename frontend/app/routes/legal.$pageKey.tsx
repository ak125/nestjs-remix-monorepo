// app/routes/legal.$pageKey.tsx - Pages légales dynamiques
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";

interface LegalPage {
  title: string;
  content: string;
  lastUpdated: string;
  key: string;
}

// Base de données simple des pages légales
const legalPages: Record<string, LegalPage> = {
  privacy: {
    key: "privacy",
    title: "Politique de Confidentialité",
    lastUpdated: "2024-01-15",
    content: `
# Politique de Confidentialité

## 1. Collecte des Informations
Nous collectons les informations que vous nous fournissez directement...

## 2. Utilisation des Informations
Les informations collectées sont utilisées pour...

## 3. Protection des Données
Nous mettons en place des mesures de sécurité appropriées...

## 4. Vos Droits
Vous avez le droit d'accéder, modifier ou supprimer vos données...

## 5. Contact
Pour toute question concernant cette politique, contactez-nous à privacy@example.com
    `,
  },
  terms: {
    key: "terms",
    title: "Conditions Générales d'Utilisation",
    lastUpdated: "2024-01-15",
    content: `
# Conditions Générales d'Utilisation

## 1. Acceptation des Conditions
En utilisant ce service, vous acceptez les présentes conditions...

## 2. Description du Service
Notre service vous permet de...

## 3. Comptes Utilisateur
Pour utiliser certaines fonctionnalités...

## 4. Contenu Utilisateur
Vous êtes responsable du contenu que vous publiez...

## 5. Limitation de Responsabilité
Dans les limites autorisées par la loi...
    `,
  },
  cookies: {
    key: "cookies",
    title: "Politique de Cookies",
    lastUpdated: "2024-01-15",
    content: `
# Politique de Cookies

## 1. Qu'est-ce qu'un Cookie ?
Un cookie est un petit fichier texte...

## 2. Types de Cookies Utilisés
- Cookies essentiels
- Cookies de performance
- Cookies de fonctionnalité

## 3. Gestion des Cookies
Vous pouvez contrôler et gérer les cookies...

## 4. Plus d'Informations
Pour plus d'informations sur les cookies...
    `,
  },
  "legal-notice": {
    key: "legal-notice",
    title: "Mentions Légales",
    lastUpdated: "2024-01-15",
    content: `
# Mentions Légales

## Éditeur du Site
Nom de l'entreprise: Example Corp
Adresse: 123 Rue Example, 75001 Paris
Téléphone: +33 1 23 45 67 89
Email: contact@example.com

## Hébergement
Hébergeur: Example Hosting
Adresse: 456 Rue Hosting, 75002 Paris

## Propriété Intellectuelle
Le contenu de ce site est protégé par le droit d'auteur...

## Responsabilité
L'éditeur ne peut être tenu responsable...
    `,
  },
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || "error" in data) {
    return [
      { title: "Page non trouvée - Legal" },
      { name: "description", content: "La page légale demandée n'existe pas." },
    ];
  }

  return [
    { title: `${data.page.title} - Legal` },
    {
      name: "description",
      content: `${data.page.title} - Informations légales importantes.`,
    },
    { name: "robots", content: "index, follow" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const pageKey = params.pageKey;

  if (!pageKey || !legalPages[pageKey]) {
    throw new Response("Page légale non trouvée", { status: 404 });
  }

  const page = legalPages[pageKey];

  return json({ page });
}

export default function LegalPage() {
  const { page } = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {page.title}
          </h1>
          <p className="text-sm text-gray-500">
            Dernière mise à jour:{" "}
            {new Date(page.lastUpdated).toLocaleDateString("fr-FR")}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="prose prose-gray max-w-none">
            {page.content.split("\n").map((line, index) => {
              if (line.startsWith("# ")) {
                return (
                  <h1
                    key={index}
                    className="text-2xl font-bold text-gray-900 mt-8 mb-4 first:mt-0"
                  >
                    {line.substring(2)}
                  </h1>
                );
              } else if (line.startsWith("## ")) {
                return (
                  <h2
                    key={index}
                    className="text-xl font-semibold text-gray-800 mt-6 mb-3"
                  >
                    {line.substring(3)}
                  </h2>
                );
              } else if (line.startsWith("### ")) {
                return (
                  <h3
                    key={index}
                    className="text-lg font-medium text-gray-700 mt-4 mb-2"
                  >
                    {line.substring(4)}
                  </h3>
                );
              } else if (line.startsWith("- ")) {
                return (
                  <li key={index} className="ml-4 text-gray-600">
                    {line.substring(2)}
                  </li>
                );
              } else if (line.trim() === "") {
                return <br key={index} />;
              } else {
                return (
                  <p key={index} className="text-gray-600 mb-3 leading-relaxed">
                    {line}
                  </p>
                );
              }
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Autres Pages Légales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(legalPages)
              .filter(([key]) => key !== params.pageKey)
              .map(([key, legalPage]) => (
                <a
                  key={key}
                  href={`/legal/${key}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h4 className="font-medium text-gray-900">
                    {legalPage.title}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Mis à jour le{" "}
                    {new Date(legalPage.lastUpdated).toLocaleDateString(
                      "fr-FR",
                    )}
                  </p>
                </a>
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-500">
          <p className="text-sm">
            Pour toute question concernant ces informations légales,
            <a
              href="/support/contact"
              className="text-blue-600 hover:underline ml-1"
            >
              contactez-nous
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
