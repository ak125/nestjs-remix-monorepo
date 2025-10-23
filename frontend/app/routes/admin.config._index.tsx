/**
 * 🔧 Configuration Admin - Version Simplifiée Compatible
 */

import { Alert, Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { useLoaderData, useActionData, Form, Link } from "@remix-run/react";
import { 
  Settings, 
  Database, 
  Mail, 
  Activity, 
  Shield, 
  Zap,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Search
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { requireAdmin } from "~/auth/unified.server";

// Types simplifiés pour les configurations
interface ConfigItem {
  key: string;
  value: any;
  category: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  isSensitive?: boolean;
  requiresRestart?: boolean;
  isRequired?: boolean;
}

interface ConfigCategory {
  key: string;
  label: string;
  icon: any;
  description: string;
  color: string;
}

// Configuration des catégories
const CATEGORIES: ConfigCategory[] = [
  { 
    key: 'general', 
    label: 'Configuration Générale', 
    icon: Settings,
    description: 'Paramètres globaux de l\'application',
    color: 'bg-gray-500' 
  },
  { 
    key: 'database', 
    label: 'Base de données', 
    icon: Database,
    description: 'Configuration des connexions et pools',
    color: 'bg-primary' 
  },
  { 
    key: 'email', 
    label: 'Email & Notifications', 
    icon: Mail,
    description: 'Services d\'envoi et templates',
    color: 'bg-success' 
  },
  { 
    key: 'analytics', 
    label: 'Analytics & Tracking', 
    icon: Activity,
    description: 'Google Analytics, Matomo, métriques',
    color: 'bg-purple-500' 
  },
  { 
    key: 'security', 
    label: 'Sécurité', 
    icon: Shield,
    description: 'JWT, cryptage, permissions',
    color: 'bg-destructive' 
  },
  { 
    key: 'performance', 
    label: 'Performance & Cache', 
    icon: Zap,
    description: 'Redis, optimisations, CDN',
    color: 'bg-warning' 
  },
];

// Mock API pour démo (à remplacer par l'API réelle)
const mockConfigApi = {
  async getAllConfigs(): Promise<ConfigItem[]> {
    return [
      {
        key: 'app.name',
        value: 'MonApp Admin',
        category: 'general',
        type: 'string',
        description: 'Nom de l\'application'
      },
      {
        key: 'app.debug',
        value: true,
        category: 'general',
        type: 'boolean',
        description: 'Mode debug activé'
      },
      {
        key: 'database.host',
        value: 'localhost',
        category: 'database',
        type: 'string',
        description: 'Hôte de la base de données'
      },
      {
        key: 'database.password',
        value: '********',
        category: 'database',
        type: 'string',
        description: 'Mot de passe de la base de données',
        isSensitive: true
      },
      {
        key: 'analytics.google_id',
        value: 'GA_MEASUREMENT_ID_TEST',
        category: 'analytics',
        type: 'string',
        description: 'ID de mesure Google Analytics'
      },
      {
        key: 'cache.ttl',
        value: 3600,
        category: 'performance',
        type: 'number',
        description: 'Durée de vie du cache en secondes'
      }
    ];
  },

  async updateConfig(key: string, value: any): Promise<void> {
    console.log(`Mise à jour configuration: ${key} = ${value}`);
    // Simulation de l'API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

export async function loader({ context }: LoaderFunctionArgs) {
  await requireAdmin({ context });
  
  try {
    const configs = await mockConfigApi.getAllConfigs();
    const stats = {
      totalConfigs: configs.length,
      configsByCategory: configs.reduce((acc, config) => {
        acc[config.category] = (acc[config.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return json({ 
      categories: CATEGORIES, 
      configs,
      stats
    });
  } catch (error) {
    console.error('❌ Erreur chargement configurations:', error);
    
    return json({ 
      categories: CATEGORIES, 
      configs: [],
      stats: { totalConfigs: 0, configsByCategory: {} },
      error: 'Erreur lors du chargement des configurations'
    });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin({ context });
  
  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "update": {
        const key = formData.get("key") as string;
        const value = formData.get("value") as string;
        const type = formData.get("type") as string;
        
        // Conversion du type si nécessaire
        let processedValue: any = value;
        if (type === 'boolean') {
          processedValue = value === 'true';
        } else if (type === 'number') {
          processedValue = Number(value);
        } else if (type === 'json') {
          try {
            processedValue = JSON.parse(value);
          } catch {
            return json({ 
              error: "Format JSON invalide",
              field: key 
            }, { status: 400 });
          }
        }
        
        await mockConfigApi.updateConfig(key, processedValue);
        return json({ 
          success: true, 
          message: `Configuration "${key}" mise à jour avec succès`,
          timestamp: new Date().toISOString()
        });
      }
      
      case "backup": {
        return json({ 
          success: true, 
          backupId: 'backup-' + Date.now(),
          message: "Sauvegarde créée avec succès",
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error(`❌ Erreur action ${action}:`, error);
    return json({ 
      error: `Erreur lors de l'action ${action}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export default function AdminConfigIndexPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  // Type guards pour gérer les types de retour possibles
  const categories = 'categories' in data ? data.categories : CATEGORIES;
  const configs = useMemo(() => 'configs' in data ? data.configs : [], [data]);
  const stats = 'stats' in data ? data.stats : { totalConfigs: 0, configsByCategory: {} };
  const error = 'error' in data ? data.error : undefined;
  
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-sélectionner la première catégorie qui a des configurations
  useEffect(() => {
    if (configs && configs.length > 0) {
      const categoriesWithConfigs = categories.filter(cat => 
        configs.some(config => config.category === cat.key)
      );
      if (categoriesWithConfigs.length > 0) {
        setSelectedCategory(categoriesWithConfigs[0].key);
      }
    }
  }, [configs, categories]);

  const filteredConfigs = (configs?.filter(config => {
    if (!config) return false;
    const matchesCategory = config.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      config.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || []) as ConfigItem[];

  const selectedCategoryData = categories.find(cat => cat.key === selectedCategory);
  const configsInCategory = stats?.configsByCategory?.[selectedCategory] || 0;

  const toggleSensitiveVisibility = (key: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Erreur copie:', error);
    }
  };

  const hasSuccess = actionData && 'success' in actionData && actionData.success;
  const hasError = actionData && 'error' in actionData;
  const successMessage = (hasSuccess && 'message' in actionData ? actionData.message : '') as string;
  const errorMessage = (hasError && 'error' in actionData ? actionData.error : '') as string;
  const backupId = (hasSuccess && 'backupId' in actionData ? actionData.backupId : undefined) as string | undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header avec statistiques */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Settings className="mr-3 h-6 w-6 text-blue-600" />
                  Configuration Système
                </h1>
                <p className="text-gray-600 mt-1">
                  Gestion avancée des paramètres et configurations
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {/* Statistiques rapides */}
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total configurations</div>
                  <div className="text-2xl font-bold text-blue-600">{stats?.totalConfigs || 0}</div>
                </div>
                
                {/* Actions rapides */}
                <Form method="post" className="inline">
                  <input type="hidden" name="_action" value="backup" />
                  <Button className="px-4 py-2  rounded-md flex items-center" variant="blue" type="submit">
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder
                  </Button>
                </Form>
              </div>
            </div>
          </div>

          {/* Messages de statut */}
          {error && (
            <Alert intent="error" variant="solid" icon={<AlertCircle />}>
              {error}
            </Alert>
          )}

          {hasSuccess && (
            <Alert intent="success" variant="solid" icon={<CheckCircle />} title={successMessage}>
              {backupId && (
                <p className="text-sm mt-1">
                  ID de sauvegarde : <Badge variant="success" size="sm">{backupId}</Badge>
                </p>
              )}
            </Alert>
          )}

          {hasError && (
            <Alert intent="error" variant="solid" icon={<AlertCircle />}>
              {errorMessage}
            </Alert>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="flex">
            {/* Sidebar des catégories */}
            <div className="w-80 border-r border-gray-200">
              {/* Barre de recherche */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher une configuration..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Navigation des catégories */}
              <nav className="p-4">
                {categories.map(category => {
                  const Icon = category.icon;
                  const count = stats?.configsByCategory?.[category.key] || 0;
                  
                  return (
                    <button
                      key={category.key}
                      onClick={() => setSelectedCategory(category.key)}
                      className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-all duration-200 ${
                        selectedCategory === category.key
                          ? 'bg-primary/10 text-primary border border-blue-200 shadow-sm'
                          : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`p-2 rounded-md mr-3 ${category.color} bg-opacity-10`}>
                          <Icon className={`h-4 w-4 ${category.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{category.label}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {category.description}
                          </div>
                          {count > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {count} configuration{count > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Zone de contenu principal */}
            <div className="flex-1 p-6">
              {/* Header de la catégorie */}
              {selectedCategoryData && (
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg mr-4 ${selectedCategoryData.color} bg-opacity-10`}>
                        <selectedCategoryData.icon className={`h-6 w-6 ${selectedCategoryData.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          {selectedCategoryData.label}
                        </h2>
                        <p className="text-gray-600">{selectedCategoryData.description}</p>
                        {configsInCategory > 0 && (
                          <p className="text-sm text-blue-600 mt-1">
                            {configsInCategory} configuration{configsInCategory > 1 ? 's' : ''} disponible{configsInCategory > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des configurations */}
              {filteredConfigs.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune configuration trouvée
                  </h3>
                  <p className="text-gray-600">
                    {searchTerm 
                      ? "Aucune configuration ne correspond à votre recherche." 
                      : "Aucune configuration disponible dans cette catégorie."
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredConfigs.map(config => (
                    <div key={config.key} className="border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Header de la configuration */}
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <h3 className="font-medium text-gray-900">{config.key}</h3>
                            
                            {/* Badges */}
                            <div className="flex gap-2">
                              <Badge 
                                variant={
                                  config.type === 'boolean' ? 'success' :
                                  config.type === 'number' ? 'info' :
                                  config.type === 'json' ? 'purple' :
                                  'default'
                                }
                                size="sm"
                              >
                                {config.type}
                              </Badge>
                              
                              {config.isSensitive && (
                                <Badge variant="error" size="sm">
                                  Sensible
                                </Badge>
                              )}
                              
                              {config.requiresRestart && (
                                <Badge variant="warning" size="sm">
                                  Redémarrage requis
                                </Badge>
                              )}
                              
                              {config.isRequired && (
                                <Badge variant="orange" size="sm">
                                  Requis
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Description */}
                          {config.description && (
                            <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                          )}
                          
                          {/* Formulaire d'édition ou affichage de la valeur */}
                          {editingKey === config.key ? (
                            <Form method="post" className="mt-3">
                              <input type="hidden" name="_action" value="update" />
                              <input type="hidden" name="key" value={config.key} />
                              <input type="hidden" name="type" value={config.type} />
                              <div className="flex items-center space-x-2">
                                {config.type === 'boolean' ? (
                                  <select
                                    name="value"
                                    defaultValue={String(config.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="true">Activé</option>
                                    <option value="false">Désactivé</option>
                                  </select>
                                ) : config.type === 'number' ? (
                                  <input
                                    type="number"
                                    name="value"
                                    defaultValue={config.value}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                ) : config.type === 'json' ? (
                                  <textarea
                                    name="value"
                                    defaultValue={typeof config.value === 'object' ? JSON.stringify(config.value, null, 2) : config.value}
                                    rows={4}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                    placeholder="Format JSON valide"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    name="value"
                                    defaultValue={config.isSensitive && !showSensitive[config.key] ? '' : config.value}
                                    placeholder={config.isSensitive && !showSensitive[config.key] ? '••••••••' : ''}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                )}
                                <Button className="px-4 py-2  rounded-md flex items-center" variant="green" type="submit">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Valider
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => setEditingKey(null)}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-muted/50"
                                >
                                  Annuler
                                </button>
                              </div>
                            </Form>
                          ) : (
                            <div className="mt-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1">
                                  <code className="px-3 py-2 bg-gray-50 border rounded text-sm font-mono flex-1 break-all">
                                    {config.isSensitive && !showSensitive[config.key] 
                                      ? '••••••••••••••••' 
                                      : config.type === 'json' 
                                        ? JSON.stringify(config.value, null, 2)
                                        : String(config.value)
                                    }
                                  </code>
                                  
                                  {/* Actions sur la valeur */}
                                  <div className="flex space-x-1">
                                    {config.isSensitive && (
                                      <button
                                        onClick={() => toggleSensitiveVisibility(config.key)}
                                        className="p-2 text-gray-400 hover:text-gray-600 rounded"
                                        title={showSensitive[config.key] ? "Masquer" : "Afficher"}
                                      >
                                        {showSensitive[config.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={() => copyToClipboard(String(config.value))}
                                      className="p-2 text-gray-400 hover:text-gray-600 rounded"
                                      title="Copier la valeur"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                <button
                                  onClick={() => setEditingKey(config.key)}
                                  className="ml-3 px-3 py-1 text-sm bg-info/80 text-info-foreground hover:bg-info rounded  transition-colors"
                                >
                                  Modifier
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section des liens rapides */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/admin/config/database"
            className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center mb-3">
              <Database className="h-6 w-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Base de données</h3>
            </div>
            <p className="text-gray-600">Gérer les connexions et paramètres de base de données</p>
            <div className="text-sm text-blue-600 mt-2">
              {(stats?.configsByCategory as any)?.database || 0} configuration{((stats?.configsByCategory as any)?.database || 0) !== 1 ? 's' : ''}
            </div>
          </Link>
          
          <Link
            to="/admin/config/email"
            className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center mb-3">
              <Mail className="h-6 w-6 text-green-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Email</h3>
            </div>
            <p className="text-gray-600">Configurer les services d'envoi d'emails</p>
            <div className="text-sm text-green-600 mt-2">
              {(stats?.configsByCategory as any)?.email || 0} configuration{((stats?.configsByCategory as any)?.email || 0) !== 1 ? 's' : ''}
            </div>
          </Link>
          
          <Link
            to="/admin/config/analytics"
            className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center mb-3">
              <Activity className="h-6 w-6 text-purple-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
            </div>
            <p className="text-gray-600">Paramétrer le tracking et les analytics</p>
            <div className="text-sm text-purple-600 mt-2">
              {(stats?.configsByCategory as any)?.analytics || 0} configuration{((stats?.configsByCategory as any)?.analytics || 0) !== 1 ? 's' : ''}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
