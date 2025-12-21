import { Alert, Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";

export const meta: MetaFunction = () => {
  return [
    { title: "Monitoring Système - Admin FAFA AUTO" },
    { name: "description", content: "Dashboard de monitoring système en temps réel" },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Pour l'instant, on charge juste les données sans authentification complexe
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : process.env.API_URL || 'http://localhost:3000';
    
    const [healthResponse, metricsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/system/health`).catch(() => ({ json: () => Promise.resolve(null) })),
      fetch(`${baseUrl}/api/system/metrics`).catch(() => ({ json: () => Promise.resolve(null) }))
    ]);

    const healthData = healthResponse.json ? await healthResponse.json() : null;
    const metricsData = metricsResponse.json ? await metricsResponse.json() : null;

    return json({
      initialHealth: healthData,
      initialMetrics: metricsData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur lors du chargement des données système:', error);
    return json({
      initialHealth: null,
      initialMetrics: null,
      error: 'Impossible de charger les données système',
      timestamp: new Date().toISOString()
    });
  }
};

interface SystemMetrics {
  success: boolean;
  data: {
    memory: {
      used: number;
      total: number;
    };
    uptime: number;
    environment: string;
  };
  timestamp: string;
}

interface SystemHealth {
  success: boolean;
  status: string;
  timestamp: string;
  uptime: number;
}

export default function AdminSystem() {
  const loaderData = useLoaderData<typeof loader>();
  const { initialHealth, initialMetrics, timestamp } = loaderData;
  const error = 'error' in loaderData ? loaderData.error : null;
  
  const [health, setHealth] = useState<SystemHealth | null>(initialHealth);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(initialMetrics);
  const [lastUpdate, setLastUpdate] = useState(timestamp);

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const [healthRes, metricsRes] = await Promise.all([
          fetch('/api/system/health'),
          fetch('/api/system/metrics')
        ]);
        
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }
        
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }
        
        setLastUpdate(new Date().toISOString());
      } catch (err) {
        console.error('Erreur lors du rafraîchissement:', err);
      }
    };

    // Rafraîchir toutes les 15 secondes
    const interval = setInterval(fetchSystemData, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert 
          intent="error" 
          variant="solid"
          icon={<AlertCircle className="h-5 w-5" />}
          title="Erreur de connexion"
        >
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <AdminBreadcrumb currentPage="Monitoring Système" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitoring Système</h1>
          <p className="text-gray-600 mt-1">
            Surveillance en temps réel des performances du serveur
          </p>
        </div>
        
        <Alert 
          intent={health?.success ? "success" : "error"} 
          variant="solid"
          size="sm"
          icon={health?.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          className="max-w-xs"
        >
          {health?.success ? 'Système opérationnel' : 'Problème détecté'}
        </Alert>
      </div>

      <div className="text-xs text-gray-500 text-right">
        Dernière mise à jour: {new Date(lastUpdate).toLocaleString('fr-FR')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Status Système</h3>
            <span className="text-2xl">💚</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {health?.status || 'N/A'}
          </div>
          <p className="text-xs text-gray-500">
            Dernière vérification: {health?.timestamp 
              ? new Date(health.timestamp).toLocaleTimeString('fr-FR') 
              : 'N/A'}
          </p>
        </div>

        {/* Uptime Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Temps de fonctionnement</h3>
            <span className="text-2xl">⏰</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {health?.uptime ? formatUptime(health.uptime) : 'N/A'}
          </div>
          <p className="text-xs text-gray-500">
            Depuis le dernier redémarrage
          </p>
        </div>

        {/* Memory Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Utilisation mémoire</h3>
            <span className="text-2xl">🧠</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {metrics?.data?.memory ? formatMemory(metrics.data.memory.used) : 'N/A'}
          </div>
          <p className="text-xs text-gray-500">
            sur {metrics?.data?.memory ? formatMemory(metrics.data.memory.total) : 'N/A'}
            {metrics?.data?.memory && 
              ` (${Math.round((metrics.data.memory.used / metrics.data.memory.total) * 100)}%)`}
          </p>
        </div>

        {/* Environment Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Environnement</h3>
            <span className="text-2xl">⚙️</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1 capitalize">
            {metrics?.data?.environment || 'N/A'}
          </div>
          <p className="text-xs text-gray-500">
            Mode d'exécution actuel
          </p>
        </div>
      </div>

      {/* Memory Usage Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilisation mémoire</h3>
        {metrics?.data?.memory && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Utilisée: {formatMemory(metrics.data.memory.used)}</span>
              <span>Disponible: {formatMemory(metrics.data.memory.total - metrics.data.memory.used)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500 ease-in-out"
                style={{
                  width: `${Math.min(100, (metrics.data.memory.used / metrics.data.memory.total) * 100)}%`
                }}
              ></div>
            </div>
            <div className="text-center">
              <span className="text-lg font-semibold text-gray-700">
                {Math.round((metrics.data.memory.used / metrics.data.memory.total) * 100)}%
              </span>
              <span className="text-sm text-gray-500 ml-1">d'utilisation</span>
            </div>
          </div>
        )}
        {!metrics?.data?.memory && (
          <div className="text-center text-gray-500 py-8">
            Données non disponibles
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations système</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Backend</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Environment: <span className="font-mono bg-gray-100 px-1 rounded">{metrics?.data?.environment || 'N/A'}</span></div>
              <div>Node.js: <span className="font-mono bg-gray-100 px-1 rounded">{process.version || 'N/A'}</span></div>
              <div>Uptime: <span className="font-mono bg-gray-100 px-1 rounded">{health?.uptime ? formatUptime(health.uptime) : 'N/A'}</span></div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Métriques</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Mémoire heap: <span className="font-mono bg-gray-100 px-1 rounded">{metrics?.data?.memory ? formatMemory(metrics.data.memory.used) : 'N/A'}</span></div>
              <div>Mémoire totale: <span className="font-mono bg-gray-100 px-1 rounded">{metrics?.data?.memory ? formatMemory(metrics.data.memory.total) : 'N/A'}</span></div>
              <div className="flex items-center gap-2">
                Status: 
                <Badge variant={health?.success ? 'success' : 'error'} size="sm">
                  {health?.status || 'N/A'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
