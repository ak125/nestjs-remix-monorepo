import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useEffect } from "react";

export const loader = async () => {
  try {
    const baseUrl = 'http://localhost:3000';
    
    const [healthRes, metricsRes] = await Promise.all([
      fetch(`${baseUrl}/api/system/health`),
      fetch(`${baseUrl}/api/system/metrics`)
    ]);

    const health = await healthRes.json();
    const metrics = await metricsRes.json();

    return json({
      health,
      metrics,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({
      health: null,
      metrics: null,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

export default function SystemMonitoringDemo() {
  const data = useLoaderData();
  const fetcher = useFetcher();

  const formatMemory = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      fetcher.load('/admin/system-demo');
    }, 10000);
    return () => clearInterval(interval);
  }, [fetcher]);

  const currentData = fetcher.data || data;

  if (!currentData.success) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1>❌ Erreur de connexion</h1>
        <p>Impossible de charger les données système : {currentData.error}</p>
      </div>
    );
  }

  const { health, metrics } = currentData;

  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem' 
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#333' }}>🖥️ Monitoring Système FAFA AUTO</h1>
            <p style={{ margin: '0.5rem 0', color: '#666' }}>
              Surveillance en temps réel - Backend opérationnel
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: health?.success ? '#22c55e' : '#ef4444',
              animation: health?.success ? 'pulse 2s infinite' : 'none'
            }}></div>
            <span style={{ fontWeight: 'bold', color: health?.success ? '#22c55e' : '#ef4444' }}>
              {health?.success ? 'Système Opérationnel' : 'Problème Détecté'}
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* Status Card */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#666', fontSize: '14px' }}>Status Système</h3>
              <span style={{ fontSize: '24px' }}>💚</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem' }}>
              {health?.status || 'N/A'}
            </div>
            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
              Dernière vérification: {health?.timestamp 
                ? new Date(health.timestamp).toLocaleTimeString('fr-FR') 
                : 'N/A'}
            </p>
          </div>

          {/* Uptime Card */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#666', fontSize: '14px' }}>Temps de fonctionnement</h3>
              <span style={{ fontSize: '24px' }}>⏰</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem' }}>
              {formatUptime(health?.uptime)}
            </div>
            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
              Depuis le dernier redémarrage
            </p>
          </div>

          {/* Memory Card */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#666', fontSize: '14px' }}>Utilisation mémoire</h3>
              <span style={{ fontSize: '24px' }}>🧠</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem' }}>
              {metrics?.data?.memory ? formatMemory(metrics.data.memory.used) : 'N/A'}
            </div>
            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
              sur {metrics?.data?.memory ? formatMemory(metrics.data.memory.total) : 'N/A'}
              {metrics?.data?.memory && 
                ` (${Math.round((metrics.data.memory.used / metrics.data.memory.total) * 100)}%)`}
            </p>
          </div>

          {/* Environment Card */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#666', fontSize: '14px' }}>Environnement</h3>
              <span style={{ fontSize: '24px' }}>⚙️</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
              {metrics?.data?.environment || 'N/A'}
            </div>
            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
              Mode d'exécution actuel
            </p>
          </div>
        </div>

        {/* Memory Usage Chart */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>📊 Utilisation mémoire en temps réel</h3>
          {metrics?.data?.memory && (
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '14px', 
                color: '#666',
                marginBottom: '10px'
              }}>
                <span>Utilisée: {formatMemory(metrics.data.memory.used)}</span>
                <span>Disponible: {formatMemory(metrics.data.memory.total - metrics.data.memory.used)}</span>
              </div>
              <div style={{ 
                width: '100%', 
                backgroundColor: '#e5e7eb', 
                borderRadius: '10px', 
                height: '12px',
                marginBottom: '10px'
              }}>
                <div style={{
                  height: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#3b82f6',
                  width: `${Math.min(100, (metrics.data.memory.used / metrics.data.memory.total) * 100)}%`,
                  transition: 'width 0.5s ease-in-out'
                }}></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                  {Math.round((metrics.data.memory.used / metrics.data.memory.total) * 100)}%
                </span>
                <span style={{ fontSize: '14px', color: '#666', marginLeft: '5px' }}>
                  d'utilisation
                </span>
              </div>
            </div>
          )}
        </div>

        {/* System Stats */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>📈 Statistiques système</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>Backend NestJS</h4>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div>Environment: <span style={{ fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>{metrics?.data?.environment || 'N/A'}</span></div>
                <div>Uptime: <span style={{ fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>{formatUptime(health?.uptime)}</span></div>
              </div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>Métriques mémoire</h4>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div>Heap utilisé: <span style={{ fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>{formatMemory(metrics?.data?.memory?.used)}</span></div>
                <div>Heap total: <span style={{ fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>{formatMemory(metrics?.data?.memory?.total)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '12px', color: '#999' }}>
          🔄 Actualisation automatique toutes les 10 secondes - 
          Dernière mise à jour: {new Date(currentData.timestamp).toLocaleString('fr-FR')}
        </div>
      </div>
    </div>
  );
}
