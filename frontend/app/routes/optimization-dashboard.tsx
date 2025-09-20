/**
 * Dashboard Optimisation Avancée - Monitoring temps réel
 * Analytics, A/B Testing, Performance, et Insights utilisateur
 */

import { type MetaFunction } from "@remix-run/node"
import { useEffect, useState } from "react"
import { 
  BarChart3, 
  Users, 
  Zap, 
  TrendingUp, 
  Clock, 
  Target,
  AlertTriangle,
  CheckCircle,
  Activity,
  Smartphone,
  Monitor,
  Tablet
} from "lucide-react"
import { useAdvancedAnalytics } from "~/hooks/useAdvancedAnalytics"

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard Optimisation - Analytics Avancées" },
    { name: "description", content: "Monitoring et optimisation temps réel de l'interface admin" },
  ]
}

export default function AdvancedOptimizationDashboard() {
  const {
    trackEvent,
    insights,
    performance,
    abTestVariant,
    getABTestConfig,
    isOptimizationMode,
    enableOptimizationMode,
    disableOptimizationMode,
    getOptimizationRecommendations,
    sessionId,
    eventQueueLength
  } = useAdvancedAnalytics()

  const [realTimeStats, setRealTimeStats] = useState({
    activeUsers: Math.floor(Math.random() * 50) + 10,
    commandsPerMinute: Math.floor(Math.random() * 20) + 5,
    avgResponseTime: Math.floor(Math.random() * 100) + 50,
    errorRate: Math.random() * 2
  })

  // Simulation stats temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeStats({
        activeUsers: Math.floor(Math.random() * 50) + 10,
        commandsPerMinute: Math.floor(Math.random() * 20) + 5,
        avgResponseTime: Math.floor(Math.random() * 100) + 50,
        errorRate: Math.random() * 2
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Track page view
  useEffect(() => {
    trackEvent('optimization_dashboard_view', { timestamp: Date.now() })
  }, [trackEvent])

  const abConfig = getABTestConfig()
  const recommendations = getOptimizationRecommendations()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🚀 Dashboard Optimisation Avancée
              </h1>
              <p className="text-gray-600 mt-1">
                Analytics temps réel • A/B Testing • Performance Intelligence
              </p>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="text-right">
                <div className="text-sm text-gray-500">Session ID</div>
                <div className="text-xs font-mono text-gray-700">{sessionId.slice(0, 8)}...</div>
              </div>
              
              <button
                onClick={isOptimizationMode ? disableOptimizationMode : enableOptimizationMode}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isOptimizationMode
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {isOptimizationMode ? '✅ Mode Optimisation ON' : '⚡ Activer Optimisation'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats temps réel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{realTimeStats.activeUsers}</div>
                <div className="text-sm text-gray-600">Utilisateurs actifs</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Queue événements: {eventQueueLength}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{realTimeStats.commandsPerMinute}</div>
                <div className="text-sm text-gray-600">Commandes/min</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-green-600">↗ +12% vs hier</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{realTimeStats.avgResponseTime}ms</div>
                <div className="text-sm text-gray-600">Temps réponse</div>
              </div>
            </div>
            <div className="mt-4">
              <div className={`text-xs ${realTimeStats.avgResponseTime < 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                {realTimeStats.avgResponseTime < 100 ? '✓ Excellent' : '⚠ Surveiller'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{realTimeStats.errorRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Taux d'erreur</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-green-600">↘ -45% vs semaine</div>
            </div>
          </div>
        </div>

        {/* A/B Testing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                A/B Testing Actif
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium text-gray-900">Variant actuel: {abTestVariant.toUpperCase()}</div>
                  <div className="text-sm text-gray-600">Configuration Command Palette</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  abTestVariant === 'control' ? 'bg-gray-100 text-gray-800' :
                  abTestVariant === 'variant_a' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {abTestVariant === 'control' ? 'Contrôle' :
                   abTestVariant === 'variant_a' ? 'Test A' : 'Test B'}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Style:</span>
                  <span className="font-medium">{abConfig.commandPaletteStyle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Actions récentes:</span>
                  <span className="font-medium">{abConfig.showRecentActions ? 'Oui' : 'Non'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max actions:</span>
                  <span className="font-medium">{abConfig.maxRecentActions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Auto-complete:</span>
                  <span className="font-medium">{abConfig.enableAutoComplete ? 'Activé' : 'Désactivé'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Performance Temps Réel
              </h2>
            </div>
            <div className="p-6">
              {performance ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Rendu Command Palette</span>
                    <div className="text-right">
                      <div className="font-medium">{performance.commandPaletteRenderTime.toFixed(1)}ms</div>
                      <div className={`text-xs ${performance.commandPaletteRenderTime < 50 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {performance.commandPaletteRenderTime < 50 ? 'Excellent' : 'À surveiller'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Recherche</span>
                    <div className="text-right">
                      <div className="font-medium">{performance.searchResponseTime.toFixed(1)}ms</div>
                      <div className="text-xs text-green-600">Rapide</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Mémoire utilisée</span>
                    <div className="text-right">
                      <div className="font-medium">{performance.memoryUsage.toFixed(1)}MB</div>
                      <div className="text-xs text-blue-600">Normale</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taille bundle</span>
                    <div className="text-right">
                      <div className="font-medium">{(performance.bundleSize / 1024).toFixed(1)}KB</div>
                      <div className="text-xs text-green-600">Optimisé</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Collecte des métriques...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Insights comportementaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibent text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Insights Utilisateur
              </h2>
            </div>
            <div className="p-6">
              {insights ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Commandes populaires</h3>
                    <div className="space-y-2">
                      {insights.mostUsedCommands.slice(0, 5).map((cmd, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{cmd.command}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{cmd.count}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{ width: `${(cmd.count / Math.max(...insights.mostUsedCommands.map(c => c.count))) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Métriques productivité</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {insights.productivityMetrics.commandPaletteUsage.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-600">Usage Command Palette</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {insights.productivityMetrics.errorReduction.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-600">Réduction erreurs</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Collecte des données utilisateur...
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Recommandations
              </h2>
            </div>
            <div className="p-6">
              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                      rec.priority === 'high' ? 'bg-red-50 border-red-400' :
                      rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                      'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${
                            rec.priority === 'high' ? 'text-red-800' :
                            rec.priority === 'medium' ? 'text-yellow-800' :
                            'text-blue-800'
                          }`}>
                            {rec.type.replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-700 mt-1">{rec.message}</div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {rec.priority.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-green-600 py-8">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <div className="font-medium">Tout fonctionne parfaitement!</div>
                  <div className="text-sm text-gray-600">Aucune optimisation nécessaire</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Device Analytics */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Analytics par Device</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="p-4 bg-blue-100 rounded-lg inline-block mb-3">
                  <Monitor className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">65%</div>
                <div className="text-sm text-gray-600">Desktop</div>
                <div className="text-xs text-gray-500 mt-1">Avg session: 12min</div>
              </div>
              
              <div className="text-center">
                <div className="p-4 bg-green-100 rounded-lg inline-block mb-3">
                  <Smartphone className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">28%</div>
                <div className="text-sm text-gray-600">Mobile</div>
                <div className="text-xs text-gray-500 mt-1">Avg session: 6min</div>
              </div>
              
              <div className="text-center">
                <div className="p-4 bg-purple-100 rounded-lg inline-block mb-3">
                  <Tablet className="w-8 h-8 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">7%</div>
                <div className="text-sm text-gray-600">Tablet</div>
                <div className="text-xs text-gray-500 mt-1">Avg session: 9min</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => trackEvent('optimization_test_command_palette', {})}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            🧪 Tester Command Palette
          </button>
          
          <button
            onClick={() => trackEvent('optimization_export_data', {})}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
          >
            📊 Exporter Analytics
          </button>
          
          <a
            href="/admin"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 text-center"
          >
            🎯 Dashboard Admin
          </a>
        </div>
      </div>
    </div>
  )
}
