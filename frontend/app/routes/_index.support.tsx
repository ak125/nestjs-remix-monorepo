// app/routes/_index.support.tsx - Page Support principale
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Button } from '~/components/ui/button';

// Interface pour les données support
interface SupportData {
  categories: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    links: Array<{
      title: string;
      url: string;
      external?: boolean;
    }>;
  }>;
  userSession?: {
    isAuthenticated: boolean;
    user?: any;
  };
}

export const meta: MetaFunction = () => {
  return [
    { title: "Support & Aide - Centre d'assistance" },
    {
      name: "description",
      content:
        "Centre d'assistance et support technique. Trouvez de l'aide, consultez la documentation et contactez notre équipe.",
    },
    {
      name: "keywords",
      content: "support, aide, assistance, documentation, contact, FAQ",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Récupérer les informations de session si disponibles
    const userSession = {
      isAuthenticated: false,
      user: null,
    };

    // Configuration des catégories de support
    const supportData: SupportData = {
      categories: [
        {
          id: "documentation",
          title: "📚 Documentation",
          description: "Guides complets et documentation technique",
          icon: "📖",
          links: [
            { title: "Guide de démarrage", url: "/docs/getting-started" },
            { title: "API Documentation", url: "/docs/api" },
            { title: "FAQ", url: "/docs/faq" },
            { title: "Tutoriels", url: "/docs/tutorials" },
          ],
        },
        {
          id: "contact",
          title: "💬 Contact",
          description: "Contactez notre équipe support",
          icon: "📞",
          links: [
            { title: "Contact Support", url: "/support/contact" },
            { title: "Chat en direct", url: "/support/chat" },
            {
              title: "Email Support",
              url: "mailto:support@example.com",
              external: true,
            },
            { title: "Téléphone", url: "tel:+33123456789", external: true },
          ],
        },
        {
          id: "ai-assistance",
          title: "🤖 Assistant IA",
          description: "Support intelligent et automatisé",
          icon: "🧠",
          links: [
            { title: "Assistant IA", url: "/support/ai" },
            { title: "Chat Bot", url: "/support/chatbot" },
            { title: "Recherche Intelligente", url: "/support/search" },
            { title: "Solutions Automatiques", url: "/support/auto-solutions" },
          ],
        },
        {
          id: "community",
          title: "👥 Communauté",
          description: "Forums et ressources communautaires",
          icon: "🌐",
          links: [
            { title: "Forum Communauté", url: "/community/forum" },
            {
              title: "Discord",
              url: "https://discord.gg/example",
              external: true,
            },
            {
              title: "Stack Overflow",
              url: "https://stackoverflow.com/questions/tagged/your-product",
              external: true,
            },
            {
              title: "GitHub Issues",
              url: "https://github.com/your-org/your-repo/issues",
              external: true,
            },
          ],
        },
        {
          id: "status",
          title: "📊 Statut System",
          description: "État des services et maintenance",
          icon: "⚡",
          links: [
            { title: "Statut Services", url: "/status" },
            { title: "Maintenance Programmée", url: "/status/maintenance" },
            { title: "Historique Incidents", url: "/status/history" },
            {
              title: "Page Statut Publique",
              url: "https://status.example.com",
              external: true,
            },
          ],
        },
        {
          id: "advanced",
          title: "🔧 Support Avancé",
          description: "Outils et support technique avancé",
          icon: "⚙️",
          links: [
            { title: "Support Technique", url: "/support/technical" },
            { title: "API Support", url: "/support/api" },
            { title: "Développeurs", url: "/support/developers" },
            { title: "Entreprise", url: "/support/enterprise" },
          ],
        },
      ],
      userSession,
    };

    return json(supportData);
  } catch (error) {
    console.error("Erreur lors du chargement de la page support:", error);

    // Fallback en cas d'erreur
    return json({
      categories: [],
      error: "Une erreur s'est produite lors du chargement de la page support",
    });
  }
}

export default function SupportPage() {
  const data = useLoaderData<typeof loader>();

  if ("error" in data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erreur</h1>
          <p className="text-gray-600 mb-6">{data.error}</p>
          <Button className="px-6 py-2 rounded-lg" variant="blue" asChild><Link to="/">Retour à l'accueil</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              💬 Centre de Support
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Trouvez l'aide dont vous avez besoin. Documentation, support
              technique, et assistance communautaire à votre disposition.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation rapide */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">
            🚀 Accès Rapide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button className="px-4 py-2 rounded-lg text-center" variant="blue" asChild><Link to="/support/ai">🤖 Assistant IA</Link></Button>
            <Button className="px-4 py-2 rounded-lg text-center" variant="green" asChild><Link to="/support/contact">📞 Contact Direct</Link></Button>
            <Button className="px-4 py-2 rounded-lg text-center" variant="purple" asChild><Link to="/docs/faq">❓ FAQ</Link></Button>
            <Button className="px-4 py-2 rounded-lg text-center" variant="orange" asChild><Link to="/status">📊 Statut Services</Link></Button>
          </div>
        </div>

        {/* Grille des catégories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.categories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-center mb-4">
                <span className="text-3xl mr-3">{category.icon}</span>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {category.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {category.description}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {category.links.map((link, index) => (
                  <div key={index}>
                    {link.external ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-600 hover:text-blue-800 hover:underline transition-colors py-1"
                      >
                        {link.title} ↗
                      </a>
                    ) : (
                      <Link
                        to={link.url}
                        className="block text-blue-600 hover:text-blue-800 hover:underline transition-colors py-1"
                      >
                        {link.title}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-gray-500">
          <p className="mb-2">
            Besoin d'une assistance immédiate ?
            <Link
              to="/support/contact"
              className="text-blue-600 hover:underline ml-1"
            >
              Contactez-nous directement
            </Link>
          </p>
          <p className="text-sm">
            Notre équipe support est disponible 24h/24, 7j/7 pour vous aider
          </p>
        </div>
      </div>
    </div>
  );
}
