import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

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

export default function SystemMonitoring() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const [metricsRes, healthRes] = await Promise.all([
          fetch('/api/system/metrics'),
          fetch('/api/system/health')
        ]);
        
        const metricsData = await metricsRes.json();
        const healthData = await healthRes.json();
        
        setMetrics(metricsData);
        setHealth(healthData);
      } catch (error) {
        console.error('Erreur lors du chargement des données système:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemData();
    
    // Refresh toutes les 30 secondes
    const interval = setInterval(fetchSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Monitoring Système</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${health?.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium">
            {health?.success ? 'Système opérationnel' : 'Problème détecté'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <div className="w-4 h-4 text-green-600">💚</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.status || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Dernière vérification: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString('fr-FR') : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <div className="w-4 h-4 text-blue-600">⏰</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.uptime ? formatUptime(health.uptime) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Temps de fonctionnement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mémoire</CardTitle>
            <div className="w-4 h-4 text-purple-600">🧠</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.data?.memory ? formatMemory(metrics.data.memory.used) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              sur {metrics?.data?.memory ? formatMemory(metrics.data.memory.total) : 'N/A'} 
              {metrics?.data?.memory && ` (${Math.round((metrics.data.memory.used / metrics.data.memory.total) * 100)}%)`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environnement</CardTitle>
            <div className="w-4 h-4 text-orange-600">⚙️</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {metrics?.data?.environment || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Mode d'exécution
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Graphique mémoire (simulé)</CardTitle>
          <CardDescription>
            Utilisation mémoire en temps réel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.data?.memory && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Utilisée: {formatMemory(metrics.data.memory.used)}</span>
                <span>Disponible: {formatMemory(metrics.data.memory.total - metrics.data.memory.used)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(metrics.data.memory.used / metrics.data.memory.total) * 100}%`
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((metrics.data.memory.used / metrics.data.memory.total) * 100)}% d'utilisation
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
