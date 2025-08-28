import { useEffect, useState } from 'react'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useNavigation } from '@remix-run/react'
import { 
  Activity, 
  BarChart3, 
  Brain, 
  FlaskConical, 
  TrendingUp, 
  Users, 
  ShoppingCart,
  DollarSign,
  Target,
  Zap
} from 'lucide-react'
import { useAdvancedAnalytics } from '../hooks/useAdvancedAnalytics'
// import { useAIAssistant } from '../hooks/useAIAssistant' // Temporairement désactivé

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
    const response = await fetch('http://localhost:3000/dashboard/stats')
    const stats: DashboardStats = await response.json()
    
    return json({ 
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erreur lors du chargement des stats:', error)
    return json({ 
      stats: null, 
      error: 'Impossible de charger les statistiques',
      timestamp: new Date().toISOString()
    })
  }
}

export default function AnalyticsTestPage() {
  const { stats, timestamp } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  
  // Hooks d'analytics avancées
  const {
    trackEvent,
    startABTest,
    getABTestVariant,
    getInsights,
    getPerformanceMetrics,
    getRecommendations
  } = useAdvancedAnalytics()

  const {
    suggestions,
    learnFromAction,
    patterns,
    isLearning
  // } = useAIAssistant() // Temporairement désactivé
  } = {
    generateInsight: () => '',
    learnFromAction: () => {},
    patterns: [],
    isLearning: false,
    startABTest: () => {},
    getABTestVariant: () => 'A',
    getInsights: () => ({}),
    getPerformanceMetrics: () => ({}),
    getRecommendations: () => []
  }

  const [testResults, setTestResults] = useState<any>({})
  const [abTestActive, setAbTestActive] = useState(false)
  const [currentVariant, setCurrentVariant] = useState<string>('')

  // Initialisation des tests
  useEffect(() => {
    // Test automatique des analytics au chargement
    trackEvent('page_view', {
      page: 'analytics-test',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    })

    // Simulation d'un test A/B
    const variant = getABTestVariant('dashboard_layout')
    setCurrentVariant(variant)

    // Collecte des métriques de performance
    const performanceData = getPerformanceMetrics()
    const insights = getInsights()
    const recommendations = getRecommendations()

    setTestResults({
      performanceData,
      insights,
      recommendations,
      variant
    })
  }, [])

  const handleStartABTest = async () => {
    const testConfig = {
      name: 'dashboard_optimization',
      variants: ['control', 'improved', 'experimental'],
      traffic: 0.33
    }
    
    await startABTest('dashboard_layout', testConfig)
    setAbTestActive(true)
    
    trackEvent('ab_test_started', {
      testName: 'dashboard_optimization',
      timestamp: new Date().toISOString()
    })

    learnFromAction('ab_test_creation', { success: true })
  }

  const handleTrackEvent = (eventType: string) => {
    trackEvent(eventType, {
      timestamp: new Date().toISOString(),
      context: 'analytics_test',
      stats: stats ? {
        totalUsers: stats.totalUsers,
        totalOrders: stats.totalOrders,
        revenue: stats.totalRevenue
      } : null
    })

    learnFromAction('manual_event_tracking', { eventType })
  }

  const conversionRate = stats ? ((stats.completedOrders / stats.totalOrders) * 100).toFixed(1) : '0'
  const revenuePerUser = stats ? (stats.totalRevenue / stats.totalUsers).toFixed(2) : '0'

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🚀 Test Analytics Avancées</h1>
          <p className="text-muted-foreground mt-2">
            Validation des fonctionnalités d'analytics, A/B testing et IA assistant
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={navigation.state === 'loading' ? 'secondary' : 'default'}>
            {navigation.state === 'loading' ? 'Chargement...' : 'Live Data'}
          </Badge>
          <Badge variant={isLearning ? 'secondary' : 'outline'}>
            IA {isLearning ? 'Apprentissage...' : 'Prête'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
          <TabsTrigger value="abtesting">🧪 A/B Testing</TabsTrigger>
          <TabsTrigger value="ai-assistant">🤖 IA Assistant</TabsTrigger>
        </TabsList>

        {/* Dashboard avec données réelles */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs Total</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.activeUsers.toLocaleString()} actifs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalOrders.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground">
                  {conversionRate}% taux de conversion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats ? `€${stats.totalRevenue.toLocaleString()}` : '€0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  €{revenuePerUser} par utilisateur
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalSuppliers || '0'}</div>
                <p className="text-xs text-muted-foreground">
                  Actifs dans le système
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance en Temps Réel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Taux de Completion</span>
                    <span className="text-sm font-medium">{conversionRate}%</span>
                  </div>
                  <Progress value={parseFloat(conversionRate)} className="mt-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Engagement Utilisateur</span>
                    <span className="text-sm font-medium">87%</span>
                  </div>
                  <Progress value={87} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Testing */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Test des Événements
                </CardTitle>
                <CardDescription>
                  Testez le tracking d'événements en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleTrackEvent('button_click')} size="sm">
                    Click Event
                  </Button>
                  <Button onClick={() => handleTrackEvent('user_interaction')} size="sm">
                    Interaction
                  </Button>
                  <Button onClick={() => handleTrackEvent('feature_usage')} size="sm">
                    Feature Usage
                  </Button>
                  <Button onClick={() => handleTrackEvent('conversion')} size="sm">
                    Conversion
                  </Button>
                </div>
                
                {testResults.performanceData && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Métriques Collectées:</h4>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(testResults.performanceData, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Insights Automatiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                {testResults.insights && (
                  <div className="space-y-2">
                    {testResults.insights.map((insight: any, index: number) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm">{insight.message}</p>
                        <Badge variant="outline" className="mt-2">
                          {insight.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                
                {testResults.recommendations && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Recommandations:</h4>
                    <div className="space-y-2">
                      {testResults.recommendations.map((rec: any, index: number) => (
                        <div key={index} className="p-2 bg-green-50 rounded">
                          <p className="text-sm">{rec.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* A/B Testing */}
        <TabsContent value="abtesting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Test A/B - Optimisation Dashboard
              </CardTitle>
              <CardDescription>
                Testez différentes variantes pour optimiser l'expérience utilisateur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Variante Actuelle: <Badge>{currentVariant || 'control'}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Test automatiquement assigné au chargement
                  </p>
                </div>
                <Button 
                  onClick={handleStartABTest} 
                  disabled={abTestActive}
                  variant={abTestActive ? "secondary" : "default"}
                >
                  {abTestActive ? 'Test Actif' : 'Démarrer Test A/B'}
                </Button>
              </div>

              {abTestActive && (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-800">✅ Test A/B Activé</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Le système collecte maintenant les données pour optimiser l'interface
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Variante Control</span>
                      <span>33%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Variante Améliorée</span>
                      <span>33%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Variante Expérimentale</span>
                      <span>33%</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IA Assistant */}
        <TabsContent value="ai-assistant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Assistant IA - Suggestions Intelligentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {suggestion.icon}
                        </div>
                        <div className="flex-grow">
                          <h4 className="font-medium">{suggestion.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {suggestion.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{suggestion.category}</Badge>
                            <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}>
                              {suggestion.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>L'IA collecte des données pour générer des suggestions personnalisées</p>
                  </div>
                )}
              </div>

              {patterns.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Patterns Détectés:</h4>
                  <div className="grid gap-2">
                    {patterns.map((pattern, index) => (
                      <div key={index} className="p-3 bg-purple-50 rounded">
                        <p className="text-sm">{pattern.description}</p>
                        <Badge variant="outline" className="mt-2">
                          Confiance: {Math.round(pattern.confidence * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer avec timestamp */}
      <div className="text-center text-sm text-muted-foreground">
        Dernière mise à jour: {new Date(timestamp).toLocaleString('fr-FR')}
      </div>
    </div>
  )
}
