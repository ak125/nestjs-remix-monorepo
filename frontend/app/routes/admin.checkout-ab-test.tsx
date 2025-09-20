import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { TrendingUp, Target, Zap, Users, DollarSign, BarChart3, RefreshCw } from 'lucide-react'
import { CheckoutOptimization } from '../components/CheckoutOptimization'

interface DashboardStats {
  totalOrders: number
  completedOrders: number
  pendingOrders: number
  totalRevenue: number
  totalUsers: number
  activeUsers: number
  totalSuppliers: number
  success: boolean
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Récupérer les stats dashboard
    const dashboardResponse = await fetch('http://localhost:3000/api/dashboard/stats')
    const stats: DashboardStats = await dashboardResponse.json()
    
    // Récupérer les données historiques de conversion (simulées pour l'instant)
    const conversionHistoryData = {
      dailyConversions: [
        { date: '2025-08-15', conversions: 23, tests: 156 },
        { date: '2025-08-16', conversions: 31, tests: 189 },
        { date: '2025-08-17', conversions: 28, tests: 167 },
        { date: '2025-08-18', conversions: 35, tests: 201 },
        { date: '2025-08-19', conversions: 42, tests: 234 },
        { date: '2025-08-20', conversions: 38, tests: 198 },
        { date: '2025-08-21', conversions: 45, tests: 256 },
        { date: '2025-08-22', conversions: 52, tests: 289 }
      ],
      bestPerformingVariant: 'social-proof',
      improvementPotential: 23.4
    }
    
    return json({ 
      stats,
      conversionHistory: conversionHistoryData,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erreur lors du chargement des stats:', error)
    return json({ 
      stats: null,
      conversionHistory: null, 
      error: 'Impossible de charger les statistiques',
      timestamp: new Date().toISOString()
    })
  }
}

export default function CheckoutABTestPage() {
  const { stats, conversionHistory } = useLoaderData<typeof loader>()
  const [conversions, setConversions] = useState<Array<{ variant: string; success: boolean; timestamp: number }>>([])
  const [totalTests, setTotalTests] = useState(0)
  const [isRealTimeMode, setIsRealTimeMode] = useState(false)

  // Stabiliser la fonction de callback
  const handleConversion = useCallback((variant: string, success: boolean) => {
    const conversion = { variant, success, timestamp: Date.now() }
    setConversions(prev => [...prev, conversion])
    setTotalTests(prev => prev + 1)
    
    console.log(`🎯 Conversion ${success ? 'réussie' : 'échouée'} avec variante ${variant}`)
  }, [])

  // Mémoriser les statistiques de test pour éviter les recalculs
  const testStats = useMemo(() => {
    return conversions.reduce((acc, conv) => {
      if (!acc[conv.variant]) {
        acc[conv.variant] = { total: 0, success: 0 }
      }
      acc[conv.variant].total++
      if (conv.success) acc[conv.variant].success++
      return acc
    }, {} as Record<string, { total: number; success: number }>)
  }, [conversions])

  // Mémoriser le taux de succès global
  const overallSuccessRate = useMemo(() => {
    return conversions.length > 0 
      ? ((conversions.filter(c => c.success).length / conversions.length) * 100).toFixed(1)
      : '0'
  }, [conversions])

  // Valeurs stables pour éviter les re-renders avec données temps réel
  const pendingOrders = useMemo(() => stats?.pendingOrders || 987, [stats])
  const potentialRevenue = useMemo(() => pendingOrders * 35.76, [pendingOrders])
  const randomAmount = useMemo(() => Math.round(Math.random() * 200 + 50), [])
  
  // Calcul de l'amélioration potentielle
  const improvementPotential = useMemo(() => {
    return conversionHistory?.improvementPotential || 23.4
  }, [conversionHistory])

  const handleResetTests = useCallback(() => {
    setConversions([])
    setTotalTests(0)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Modernisé */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-purple-600 rounded-2xl">
                <Target className="text-2xl text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Test A/B Checkout - Mission Conversion
                </h1>
                <p className="text-gray-600 mt-1">
                  Optimisation ciblée pour <strong className="text-red-600">{pendingOrders.toLocaleString()} commandes pendantes</strong>
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  €{potentialRevenue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Potentiel CA</div>
              </div>
              
              <button
                onClick={handleResetTests}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={conversions.length === 0}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Métriques principales modernisées */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-red-600" />
              <div className="text-xs text-red-600 font-medium px-2 py-1 bg-red-100 rounded-full">
                CRITIQUE
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600 mb-1">{pendingOrders.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Commandes à Convertir</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-8 h-8 text-green-600" />
              <div className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded-full">
                TESTS
              </div>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">{totalTests}</div>
            <div className="text-sm text-gray-600">Tests Réalisés</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded-full">
                TAUX
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{overallSuccessRate}%</div>
            <div className="text-sm text-gray-600">Conversion</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-purple-600" />
              <div className="text-xs text-purple-600 font-medium px-2 py-1 bg-purple-100 rounded-full">
                REVENUS
              </div>
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-1">
              €{Math.round((conversions.filter(c => c.success).length * 35.76)).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">CA Généré (Test)</div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Zap className="w-8 h-8 text-orange-600" />
              <div className="text-xs text-orange-600 font-medium px-2 py-1 bg-orange-100 rounded-full">
                POTENTIEL
              </div>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">+{improvementPotential}%</div>
            <div className="text-sm text-gray-600">Amélioration</div>
          </div>
        </div>

        {/* Performance Historique */}
        {conversionHistory && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="w-6 h-6 mr-3 text-blue-600" />
                Performance des 7 derniers jours
              </h3>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  Meilleure variante: <span className="font-semibold text-blue-600">{conversionHistory.bestPerformingVariant}</span>
                </div>
                <button
                  onClick={() => setIsRealTimeMode(!isRealTimeMode)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isRealTimeMode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isRealTimeMode ? '🟢 Live' : '⚪ Static'}
                </button>
              </div>
            </div>
            
            {/* Graphique simple en barres */}
            <div className="grid grid-cols-8 gap-2 mb-4">
              {conversionHistory.dailyConversions.map((day, index) => {
                const conversionRate = (day.conversions / day.tests * 100);
                const maxRate = 25; // Max pour normaliser les barres
                const barHeight = Math.max((conversionRate / maxRate) * 100, 5);
                
                return (
                  <div key={day.date} className="text-center">
                    <div className="h-32 flex items-end justify-center mb-2">
                      <div 
                        className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm w-full max-w-8 transition-all duration-300 hover:from-blue-700 hover:to-blue-500"
                        style={{ height: `${barHeight}%` }}
                        title={`${day.date}: ${conversionRate.toFixed(1)}% (${day.conversions}/${day.tests})`}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      {conversionRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(day.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Métriques de synthèse */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {(conversionHistory.dailyConversions.reduce((sum, day) => sum + day.conversions, 0) / 
                    conversionHistory.dailyConversions.reduce((sum, day) => sum + day.tests, 0) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Taux moyen 7j</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {conversionHistory.dailyConversions.reduce((sum, day) => sum + day.conversions, 0)}
                </div>
                <div className="text-sm text-gray-600">Total conversions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  +{conversionHistory.improvementPotential}%
                </div>
                <div className="text-sm text-gray-600">Potentiel d'amélioration</div>
              </div>
            </div>
          </div>
        )}

        {/* Résultats par variante modernisés */}
        {Object.keys(testStats).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-xl font-bold mb-6 flex items-center">
              <Target className="w-6 h-6 mr-3 text-purple-600" />
              Résultats par Variante
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(testStats).map(([variant, stats]) => {
                const rate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0'
                const isWinning = parseFloat(rate) === Math.max(...Object.values(testStats).map(s => s.total > 0 ? (s.success / s.total) * 100 : 0))
                
                // Variantes avec couleurs et icônes
                const variantConfig = {
                  control: { color: 'gray', icon: '📊', name: 'Control' },
                  urgency: { color: 'red', icon: '⚡', name: 'Urgence' },
                  simplified: { color: 'green', icon: '✨', name: 'Simplifié' },
                  'social-proof': { color: 'blue', icon: '👥', name: 'Social Proof' }
                }
                
                const config = variantConfig[variant as keyof typeof variantConfig] || { color: 'gray', icon: '🎯', name: variant }
                
                return (
                  <div key={variant} className={`relative p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                    isWinning && stats.total > 0 
                      ? `border-${config.color}-400 bg-${config.color}-50 ring-2 ring-${config.color}-200` 
                      : `border-gray-200 bg-white hover:border-${config.color}-300`
                  }`}>
                    {isWinning && stats.total > 0 && (
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-sm">👑</span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className="text-3xl mb-3">{config.icon}</div>
                      <div className="font-bold text-gray-900 mb-2 text-lg">
                        {config.name}
                      </div>
                      <div className={`text-3xl font-bold mb-2 text-${config.color}-600`}>
                        {rate}%
                      </div>
                      <div className="text-sm text-gray-600 mb-4">
                        {stats.success}/{stats.total} conversions
                      </div>
                      
                      {/* Barre de progression */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className={`bg-${config.color}-600 h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${Math.min(parseFloat(rate) * 2, 100)}%` }}
                        />
                      </div>
                      
                      {isWinning && stats.total > 0 && (
                        <div className="text-xs text-green-600 font-medium">
                          🏆 Meilleur performer
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Composant de test A/B */}
        <CheckoutOptimization
          orderId={`test_${Date.now()}`}
          totalAmount={randomAmount}
          pendingOrdersCount={pendingOrders}
          onConversionComplete={handleConversion}
        />

        {/* Historique des conversions */}
        {conversions.length > 0 && (
          <div className="mt-12">
            <div className="bg-white rounded-lg shadow border p-6">
              <h3 className="text-lg font-bold mb-4">📋 Historique des Tests</h3>
              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {conversions.slice().reverse().map((conv, index) => (
                    <div key={index} className={`p-3 rounded border-l-4 ${
                      conv.success ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Variante: {conv.variant}</span>
                          <span className={`ml-3 text-sm ${conv.success ? 'text-green-600' : 'text-red-600'}`}>
                            {conv.success ? '✅ Conversion' : '❌ Échec'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(conv.timestamp).toLocaleTimeString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions modernisées */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-8">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
                <Target className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                🎯 Guide d'utilisation du Test A/B
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                    <div>
                      <div className="font-semibold text-gray-900">Lancez un test</div>
                      <div className="text-gray-600 text-sm">Cliquez sur "Checkout" pour tester une variante aléatoire</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                    <div>
                      <div className="font-semibold text-gray-900">Analysez les résultats</div>
                      <div className="text-gray-600 text-sm">Les métriques se mettent à jour en temps réel</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                    <div>
                      <div className="font-semibold text-gray-900">Identifiez le gagnant</div>
                      <div className="text-gray-600 text-sm">La variante avec le meilleur taux apparaît avec une couronne 👑</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                    <div>
                      <div className="font-semibold text-gray-900">Maximisez les conversions</div>
                      <div className="text-gray-600 text-sm">Objectif: améliorer les {pendingOrders.toLocaleString()} commandes pendantes</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-white rounded-lg border-l-4 border-green-500">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Potentiel d'impact</span>
                </div>
                <div className="text-green-800 mt-1">
                  Une amélioration de +{improvementPotential}% pourrait générer <strong>€{Math.round(pendingOrders * 35.76 * (improvementPotential/100)).toLocaleString()}</strong> de revenus additionnels
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
