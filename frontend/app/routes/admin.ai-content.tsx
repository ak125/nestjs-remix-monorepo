import { type MetaFunction } from "@remix-run/node";
import { useState, useEffect } from "react";
import { AiContentGenerator } from "~/components/ai/AiContentGenerator";
import { ProductDescriptionGenerator } from "~/components/ai/ProductDescriptionGenerator";
import { SEOMetaGenerator } from "~/components/ai/SEOMetaGenerator";

export const meta: MetaFunction = () => {
  return [
    { title: "Générateur de Contenu IA - Dashboard Admin" },
    {
      name: "description",
      content:
        "Générez du contenu intelligent avec IA pour vos produits et pages",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export default function AiContentDashboard() {
  const [activeTab, setActiveTab] = useState<"generic" | "product" | "seo">(
    "generic",
  );
  const [providerStatus, setProviderStatus] = useState<{
    ollama: boolean;
    groq: boolean;
    redis: boolean;
  } | null>(null);

  // Fonction pour vérifier le statut des providers
  const checkProvidersStatus = async () => {
    try {
      // Vérifier Ollama
      const ollamaCheck = await fetch("http://localhost:11434/api/tags")
        .then((r) => r.ok)
        .catch(() => false);

      // Vérifier Redis (via backend)
      const redisCheck = await fetch("/api/health")
        .then((r) => r.ok)
        .catch(() => false);

      setProviderStatus({
        ollama: ollamaCheck,
        groq: false, // On ne peut pas vérifier Groq depuis le frontend
        redis: redisCheck,
      });
    } catch (error) {
      console.error("Error checking providers:", error);
    }
  };

  // Vérifier le statut des providers au chargement
  useEffect(() => {
    checkProvidersStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                🤖 Générateur de Contenu IA
              </h1>
              <p className="mt-2 text-sm text-gray-700">
                Créez automatiquement des descriptions, du contenu SEO et des
                textes marketing
              </p>
            </div>

            {/* Status Indicators */}
            <div className="mt-4 flex space-x-3 md:ml-4 md:mt-0">
              {providerStatus && (
                <>
                  <StatusBadge
                    label="Ollama"
                    active={providerStatus.ollama}
                    tooltip="Génération IA locale"
                  />
                  <StatusBadge
                    label="Cache"
                    active={providerStatus.redis}
                    tooltip="Cache Redis"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Info Banner */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4 border border-blue-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                Système de génération IA 100% GRATUIT activé
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Ollama</strong> : Génération locale illimitée
                    (modèle Llama 3)
                  </li>
                  <li>
                    <strong>Groq</strong> : Ultra-rapide avec 14,400
                    requêtes/jour gratuites
                  </li>
                  <li>
                    <strong>Cache Redis</strong> : Économise 90% des requêtes
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("generic")}
                className={`
                  whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                  ${
                    activeTab === "generic"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }
                `}
              >
                ✨ Générateur Universel
              </button>
              <button
                onClick={() => setActiveTab("product")}
                className={`
                  whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                  ${
                    activeTab === "product"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }
                `}
              >
                📦 Descriptions Produits
              </button>
              <button
                onClick={() => setActiveTab("seo")}
                className={`
                  whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                  ${
                    activeTab === "seo"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }
                `}
              >
                🔍 SEO & Meta
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg bg-white shadow">
          <div className="p-6">
            {activeTab === "generic" && (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Générateur de Contenu Universel
                </h2>
                <p className="mb-6 text-sm text-gray-600">
                  Créez tout type de contenu : descriptions, articles, posts
                  sociaux, emails marketing, etc.
                </p>
                <AiContentGenerator
                  onContentGenerated={(content) => {
                    console.log("Contenu généré:", content);
                    // Vous pouvez ajouter ici une notification de succès
                  }}
                />
              </div>
            )}

            {activeTab === "product" && (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Générateur de Descriptions Produits
                </h2>
                <p className="mb-6 text-sm text-gray-600">
                  Générez des descriptions professionnelles et engageantes pour
                  vos produits. Optimisées pour la conversion et le SEO.
                </p>
                <ProductDescriptionGenerator
                  onGenerated={(description) => {
                    console.log("Description générée:", description);
                    // Vous pouvez ajouter ici la logique pour sauvegarder
                  }}
                />
              </div>
            )}

            {activeTab === "seo" && (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Générateur de Méta Descriptions SEO
                </h2>
                <p className="mb-6 text-sm text-gray-600">
                  Créez des méta-descriptions optimisées SEO (150-160
                  caractères) avec mots-clés et appel à l'action.
                </p>
                <SEOMetaGenerator
                  onGenerated={(meta) => {
                    console.log("Meta générée:", meta);
                    // Vous pouvez ajouter ici la logique pour sauvegarder
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats / Usage Info */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <InfoCard
            title="Types de Contenu"
            value="6"
            description="Produits, SEO, Marketing, Blog, Social, Email"
            icon="📝"
          />
          <InfoCard
            title="Coût"
            value="0€"
            description="100% gratuit avec Ollama et Groq"
            icon="💰"
          />
          <InfoCard
            title="Limites"
            value="Illimité"
            description="Génération locale sans restrictions"
            icon="🚀"
          />
        </div>

        {/* Setup Instructions (if needed) */}
        {providerStatus && !providerStatus.ollama && (
          <div className="mt-8 rounded-lg bg-yellow-50 p-6 border border-yellow-200">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3">
              ⚠️ Configuration Requise
            </h3>
            <p className="text-sm text-yellow-800 mb-4">
              Le système de génération IA n'est pas encore configuré. Suivez ces
              étapes :
            </p>
            <div className="space-y-3">
              <SetupStep
                number={1}
                title="Installer Ollama (5 minutes)"
                command="curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.1:8b"
              />
              <SetupStep
                number={2}
                title="Démarrer Ollama"
                command="ollama serve &"
              />
              <SetupStep
                number={3}
                title="Configurer .env"
                command='echo "AI_PROVIDER=ollama" >> .env'
              />
            </div>
            <div className="mt-4">
              <a
                href="/docs/ai-setup"
                className="text-sm font-medium text-yellow-700 hover:text-yellow-800"
              >
                📚 Voir la documentation complète →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function StatusBadge({
  label,
  active,
  tooltip,
}: {
  label: string;
  active: boolean;
  tooltip: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
      }`}
      title={tooltip}
    >
      <span
        className={`mr-1.5 h-2 w-2 rounded-full ${
          active ? "bg-green-400" : "bg-gray-400"
        }`}
      />
      {label}
    </span>
  );
}

function InfoCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-3xl">{icon}</span>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="truncate text-sm font-medium text-gray-500">
              {title}
            </dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {value}
            </dd>
            <dd className="mt-1 text-sm text-gray-500">{description}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

function SetupStep({
  number,
  title,
  command,
}: {
  number: number;
  title: string;
  command: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-200 text-sm font-semibold text-yellow-900">
          {number}
        </span>
      </div>
      <div className="ml-4 flex-1">
        <h4 className="text-sm font-semibold text-yellow-900">{title}</h4>
        <div className="mt-2 flex items-center">
          <code className="flex-1 rounded bg-yellow-100 px-3 py-2 text-xs text-yellow-900">
            {command}
          </code>
          <button
            onClick={copyCommand}
            className="ml-2 rounded bg-yellow-200 px-3 py-2 text-xs font-medium text-yellow-900 hover:bg-yellow-300"
          >
            {copied ? "✓ Copié" : "📋 Copier"}
          </button>
        </div>
      </div>
    </div>
  );
}
