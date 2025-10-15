/**
 * 🎛️ INTERFACE CONFIGURATION SYSTÈME COMPLÈTE - Frontend Remix
 * 
 * Dashboard unifié pour la gestion de toutes les configurations système :
 * - Base de données (multi-environnement, tests)
 * - Analytics (multi-providers, validation)
 * - Email (SMTP, SendGrid, Mailgun, SES)
 * - Sécurité (politiques, chiffrement, audit)
 * - Monitoring en temps réel
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { 
  Settings, 
  Database, 
  BarChart3, 
  Mail, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw,
  TestTube,
  Eye,
  EyeOff,
  Download,
  Upload,
  Activity,
  RotateCcw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import SystemBreadcrumb from '../components/admin/SystemBreadcrumb';

// Types pour les configurations
interface SystemOverview {
  environment: string;
  lastUpdate: string;
  totalConfigurations: number;
  modules: {
    database: { enabled: boolean; status: string; };
    analytics: { enabled: boolean; providers: number; };
    email: { enabled: boolean; providers: number; };
    security: { enabled: boolean; score: number; };
  };
  health: {
    overall: 'healthy' | 'warning' | 'error';
    database: 'healthy' | 'warning' | 'error';
    analytics: 'healthy' | 'warning' | 'error';
    email: 'healthy' | 'warning' | 'error';
    security: 'healthy' | 'warning' | 'error';
  };
}

interface ConfigModule {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

// Configuration des modules
const CONFIG_MODULES: ConfigModule[] = [
  {
    name: 'database',
    icon: Database,
    color: 'blue',
    description: 'Gestion des connexions base de données multi-environnement'
  },
  {
    name: 'analytics',
    icon: BarChart3,
    color: 'green',
    description: 'Configuration analytics multi-providers et scripts optimisés'
  },
  {
    name: 'email',
    icon: Mail,
    color: 'purple',
    description: 'Configuration email SMTP, SendGrid, Mailgun, SES'
  },
  {
    name: 'security',
    icon: Shield,
    color: 'red',
    description: 'Politiques de sécurité, chiffrement et audit trail'
  }
];

// Loader pour récupérer les données
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const environment = url.searchParams.get('environment') || 'production';
  const module = url.searchParams.get('module') || 'overview';

  try {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    // Récupérer la vue d'ensemble
    const overviewResponse = await fetch(
      `${baseUrl}/api/admin/system-config/overview?environment=${environment}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
        },
      }
    );

    if (!overviewResponse.ok) {
      throw new Error('Erreur lors de la récupération de la vue d\'ensemble');
    }

    const overviewData = await overviewResponse.json();

    // Récupérer les données spécifiques au module si nécessaire
    let moduleData = null;
    if (module !== 'overview') {
      const moduleResponse = await fetch(
        `${baseUrl}/api/admin/system-config/${module}?environment=${environment}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
          },
        }
      );

      if (moduleResponse.ok) {
        moduleData = await moduleResponse.json();
      }
    }

    return json({
      overview: overviewData.data,
      moduleData,
      environment,
      currentModule: module,
    });
  } catch (error) {
    throw new Response('Erreur lors du chargement des configurations', {
      status: 500,
    });
  }
}

// Action pour les mises à jour
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action') as string;
  const environment = formData.get('environment') as string || 'production';
  const module = formData.get('module') as string;

  try {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    let endpoint = '';
    let method = 'POST';
    let body: any = {};

    switch (action) {
      case 'test-database':
        endpoint = `/api/admin/system-config/database/test?environment=${environment}`;
        break;
      
      case 'validate-analytics':
        endpoint = `/api/admin/system-config/analytics/validate?environment=${environment}`;
        break;
      
      case 'test-email':
        endpoint = `/api/admin/system-config/email/test?environment=${environment}`;
        body = { provider: formData.get('provider') };
        break;
      
      case 'validate-security':
        endpoint = `/api/admin/system-config/security/validate?environment=${environment}`;
        break;
      
      case 'validate-all':
        endpoint = `/api/admin/system-config/validate-all?environment=${environment}`;
        break;
      
      case 'initialize':
        endpoint = `/api/admin/system-config/initialize?environment=${environment}`;
        break;
      
      default:
        throw new Error(`Action non supportée: ${action}`);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de l'action ${action}`);
    }

    const result = await response.json();
    return json({ success: true, data: result });
  } catch (error) {
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      },
      { status: 400 }
    );
  }
}

// Composant principal
export default function SystemConfigurationDashboard() {
  const { overview, moduleData, environment, currentModule } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [selectedEnvironment, setSelectedEnvironment] = useState(environment);
  const [activeModule, setActiveModule] = useState<string>(currentModule);
  const [showSensitive, setShowSensitive] = useState(false);

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Fonction pour obtenir l'icône du statut
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircle;
      case 'warning':
        return AlertCircle;
      case 'error':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  // Mise à jour de l'URL lors du changement d'environnement ou de module
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('environment', selectedEnvironment);
    url.searchParams.set('module', activeModule);
    window.history.replaceState({}, '', url.toString());
  }, [selectedEnvironment, activeModule]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fil d'Ariane */}
      <SystemBreadcrumb
        environment={selectedEnvironment}
        onEnvironmentChange={setSelectedEnvironment}
        moduleStatuses={{
          database: overview.health.database,
          analytics: overview.health.analytics,
          email: overview.health.email,
          security: overview.health.security,
        }}
        customActions={
          <div className="flex items-center space-x-2">
            {/* Indicateur de statut global */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${getStatusColor(overview.health.overall)}`}>
              {(() => {
                const StatusIcon = getStatusIcon(overview.health.overall);
                return <StatusIcon className="h-4 w-4" />;
              })()}
              <span className="text-sm font-medium capitalize">
                {overview.health.overall}
              </span>
            </div>

            {/* Bouton de rafraîchissement */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
              title="Rafraîchir"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        }
      />

      {/* En-tête */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Settings className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Configuration Système
                </h1>
                <p className="text-sm text-gray-500">
                  Gestion centralisée des paramètres de l'application
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation latérale */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {/* Vue d'ensemble */}
              <button
                onClick={() => setActiveModule('overview')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeModule === 'overview'
                    ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Activity className="mr-3 h-5 w-5" />
                Vue d'ensemble
              </button>

              {/* Modules de configuration */}
              {CONFIG_MODULES.map((module) => {
                const Icon = module.icon;
                const status = overview.health[module.name as keyof typeof overview.health];
                const StatusIcon = getStatusIcon(status);
                
                return (
                  <button
                    key={module.name}
                    onClick={() => setActiveModule(module.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                      activeModule === module.name
                        ? `bg-${module.color}-100 text-${module.color}-700 border-r-2 border-${module.color}-500`
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      <span className="capitalize">{module.name}</span>
                    </div>
                    <StatusIcon className={`h-4 w-4 ${getStatusColor(status).split(' ')[0]}`} />
                  </button>
                );
              })}
            </nav>

            {/* Actions rapides */}
            <div className="mt-8 bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Actions rapides</h3>
              <div className="space-y-2">
                <fetcher.Form method="post">
                  <input type="hidden" name="action" value="validate-all" />
                  <input type="hidden" name="environment" value={selectedEnvironment} />
                  <button
                    type="submit"
                    disabled={fetcher.state === 'submitting'}
                    className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <TestTube className="mr-2 h-4 w-4" />
                    Valider tout
                  </button>
                </fetcher.Form>

                <fetcher.Form method="post">
                  <input type="hidden" name="action" value="initialize" />
                  <input type="hidden" name="environment" value={selectedEnvironment} />
                  <button
                    type="submit"
                    disabled={fetcher.state === 'submitting'}
                    className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Initialiser
                  </button>
                </fetcher.Form>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="lg:col-span-3">
            {activeModule === 'overview' ? (
              <OverviewPanel overview={overview} environment={selectedEnvironment} />
            ) : (
              <ModulePanel 
                module={activeModule} 
                data={moduleData} 
                environment={selectedEnvironment}
                showSensitive={showSensitive}
                onToggleSensitive={() => setShowSensitive(!showSensitive)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant Vue d'ensemble
function OverviewPanel({ overview, environment }: { 
  overview: SystemOverview; 
  environment: string; 
}) {
  return (
    <div className="space-y-6">
      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Database className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Base de données</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {overview.modules.database.enabled ? 'Activée' : 'Désactivée'}
              </p>
              <p className="text-sm text-gray-500">{overview.modules.database.status}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Analytics</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {overview.modules.analytics.providers}
              </p>
              <p className="text-sm text-gray-500">Providers actifs</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Mail className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Email</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {overview.modules.email.providers}
              </p>
              <p className="text-sm text-gray-500">Providers configurés</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Sécurité</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {overview.modules.security.score}%
              </p>
              <p className="text-sm text-gray-500">Score de sécurité</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statut des modules */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">État des modules</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {CONFIG_MODULES.map((module) => {
              const status = overview.health[module.name as keyof typeof overview.health];
              const moduleInfo = overview.modules[module.name as keyof typeof overview.modules];
              
              // Déterminons l'icône et la couleur selon le status
              const statusConfig = status === 'healthy' 
                ? { icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' }
                : status === 'warning'
                ? { icon: AlertCircle, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
                : status === 'error'
                ? { icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' }
                : { icon: AlertCircle, color: 'text-gray-600 bg-gray-50 border-gray-200' };
              
              return (
                <div key={module.name} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <module.icon className={`h-6 w-6 text-${module.color}-600`} />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 capitalize">
                        {module.name}
                      </h4>
                      <p className="text-sm text-gray-500">{module.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {typeof moduleInfo === 'object' && 'enabled' in moduleInfo
                          ? moduleInfo.enabled ? 'Activé' : 'Désactivé'
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {typeof moduleInfo === 'object' && 'providers' in moduleInfo
                          ? `${moduleInfo.providers} providers`
                          : typeof moduleInfo === 'object' && 'score' in moduleInfo
                          ? `Score: ${moduleInfo.score}%`
                          : typeof moduleInfo === 'object' && 'status' in moduleInfo
                          ? moduleInfo.status
                          : 'Configuration'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-full ${statusConfig.color}`}>
                      <statusConfig.icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Informations système */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Informations système</h3>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Environnement</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{environment}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total configurations</dt>
              <dd className="mt-1 text-sm text-gray-900">{overview.totalConfigurations}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Dernière mise à jour</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {overview.lastUpdate 
                  ? new Date(overview.lastUpdate).toLocaleString('fr-FR')
                  : 'Jamais'
                }
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Statut global</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  overview.health.overall === 'healthy' 
                    ? 'text-green-600 bg-green-50 border-green-200'
                    : overview.health.overall === 'warning'
                    ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
                    : overview.health.overall === 'error'
                    ? 'text-red-600 bg-red-50 border-red-200'
                    : 'text-gray-600 bg-gray-50 border-gray-200'
                }`}>
                  {overview.health.overall}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

// Composant pour les modules spécifiques
function ModulePanel({ 
  module, 
  data, 
  environment, 
  showSensitive, 
  onToggleSensitive 
}: { 
  module: string; 
  data: any; 
  environment: string;
  showSensitive: boolean;
  onToggleSensitive: () => void;
}) {
  const fetcher = useFetcher();

  return (
    <div className="space-y-6">
      {/* En-tête du module */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {(() => {
                const moduleConfig = CONFIG_MODULES.find(m => m.name === module);
                if (moduleConfig) {
                  const Icon = moduleConfig.icon;
                  return <Icon className={`h-6 w-6 text-${moduleConfig.color}-600`} />;
                }
                return <Settings className="h-6 w-6 text-gray-600" />;
              })()}
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                Configuration {module}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onToggleSensitive}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                title={showSensitive ? 'Masquer les données sensibles' : 'Afficher les données sensibles'}
              >
                {showSensitive ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
              
              <fetcher.Form method="post" className="inline">
                <input type="hidden" name="action" value={`test-${module}`} />
                <input type="hidden" name="environment" value={environment} />
                <input type="hidden" name="module" value={module} />
                <button
                  type="submit"
                  disabled={fetcher.state === 'submitting'}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Tester
                </button>
              </fetcher.Form>
            </div>
          </div>
        </div>
        
        {/* Contenu du module */}
        <div className="p-6">
          {data ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Configuration actuelle</h3>
                <pre className="text-xs text-gray-600 overflow-auto">
                  {JSON.stringify(data.data, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Settings className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Configuration {module}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Chargement des données de configuration...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions du module */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Actions disponibles</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <fetcher.Form method="post">
              <input type="hidden" name="action" value={`validate-${module}`} />
              <input type="hidden" name="environment" value={environment} />
              <input type="hidden" name="module" value={module} />
              <button
                type="submit"
                disabled={fetcher.state === 'submitting'}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Valider
              </button>
            </fetcher.Form>

            <button
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </button>

            <button
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
