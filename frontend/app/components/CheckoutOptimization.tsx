import { Badge } from '@fafa/ui';
import { useEffect, useState, useMemo, useCallback } from 'react'
import { Button } from '~/components/ui/button';
import { useAdvancedAnalyticsComplete } from '../hooks/useAdvancedAnalyticsComplete'

interface CheckoutOptimizationProps {
  orderId?: string
  totalAmount: number
  pendingOrdersCount?: number
  onConversionComplete?: (variant: string, success: boolean) => void
}

export function CheckoutOptimization({ 
  orderId, 
  totalAmount, 
  pendingOrdersCount = 987,
  onConversionComplete 
}: CheckoutOptimizationProps) {
  
  const {
    startABTest,
    getABTestVariant,
    trackEvent
  } = useAdvancedAnalyticsComplete()
  
  const [variant, setVariant] = useState<string>('control')
  const [testActive, setTestActive] = useState(false)
  const [conversionInProgress, setConversionInProgress] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Mémoriser les valeurs calculées pour éviter les re-calculs
  const potentialRevenue = useMemo(() => 
    Math.round(pendingOrdersCount * 35.76), 
    [pendingOrdersCount]
  )

  // Configuration du test A/B - seulement au premier rendu
  useEffect(() => {
    if (initialized) return

    const initializeCheckoutTest = async () => {
      console.log('🧪 Initialisation test A/B Checkout - 987 commandes à convertir')
      
      try {
        // Démarrer le test A/B avec focus sur conversion
        await startABTest('checkout_conversion_987', {
          name: 'Checkout Optimization - Pending Orders',
          variants: ['control', 'urgency', 'simplified', 'social_proof'],
          traffic: 1.0,
          goal: 'convert_pending_orders',
          target_metric: 'checkout_completion'
        })
        
        // Obtenir la variante assignée
        const assignedVariant = getABTestVariant('checkout_conversion_987')
        setVariant(assignedVariant)
        setTestActive(true)
        
        // Tracking de démarrage
        trackEvent('ab_test_checkout_started', {
          variant: assignedVariant,
          pending_orders: pendingOrdersCount,
          order_value: totalAmount,
          test_goal: 'convert_987_pending'
        })
      } catch (error) {
        console.warn('Erreur initialisation test A/B:', error)
        setVariant('control')
      } finally {
        setInitialized(true)
      }
    }

    initializeCheckoutTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]) // Seulement 'initialized' comme dépendance - les autres sont des fonctions stables

  // Stabiliser la fonction de conversion
  const handleCheckoutAttempt = useCallback(async () => {
    if (conversionInProgress) return
    
    setConversionInProgress(true)
    
    // Tracker tentative de checkout
    trackEvent('checkout_attempt', {
      variant,
      order_id: orderId,
      amount: totalAmount,
      timestamp: new Date().toISOString()
    })
    
    // Simulation de conversion (70% succès pour test)
    const success = Math.random() > 0.3
    
    setTimeout(() => {
      if (success) {
        // Conversion réussie
        trackEvent('checkout_conversion_success', {
          variant,
          order_id: orderId,
          amount: totalAmount,
          from_pending: true,
          test_name: 'checkout_conversion_987'
        })

        alert(`✅ Commande convertie avec succès ! (Variante: ${variant})`)
      } else {
        // Échec de conversion
        trackEvent('checkout_conversion_failed', {
          variant,
          order_id: orderId,
          amount: totalAmount,
          failure_reason: 'user_abandoned'
        })

        alert(`❌ Conversion échouée`)
      }
      
      setConversionInProgress(false)
      onConversionComplete?.(variant, success)
    }, 2000)
  }, [variant, orderId, totalAmount, conversionInProgress, trackEvent, onConversionComplete])

  // Render selon la variante A/B
  const renderCheckoutInterface = () => {
    const baseClasses = "w-full max-w-md mx-auto p-6 rounded-lg shadow-lg"
    
    switch (variant) {
      case 'urgency':
        return (
          <div className={`${baseClasses} bg-destructive/5 border-2 border-red-200`}>
            <div className="text-center mb-4">
              <div className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-bold mb-3">
                ⚡ OFFRE LIMITÉE
              </div>
              <h3 className="text-xl font-bold text-red-900">
                Finalisez maintenant !
              </h3>
              <p className="text-red-700 text-sm mt-2">
                {pendingOrdersCount} commandes en attente - Ne ratez pas cette opportunité !
              </p>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-200 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total:</span>
                <span className="text-2xl font-bold text-red-600">€{totalAmount}</span>
              </div>
            </div>
            
            <Button className="w-full  font-bold py-4 px-6 rounded-lg" variant="red" onClick={handleCheckoutAttempt}
              disabled={conversionInProgress}>\n  {conversionInProgress ? '⏳ Finalisation...' : '🚀 COMMANDER MAINTENANT'}\n</Button>
            
            <p className="text-xs text-red-600 text-center mt-3">
              ✅ Paiement sécurisé • ✅ Livraison garantie
            </p>
          </div>
        )
      
      case 'simplified':
        return (
          <div className={`${baseClasses} bg-success/5 border border-green-200`}>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                🎯 Checkout Simplifié
              </h3>
              <p className="text-green-700">Une seule étape, c'est tout !</p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded border">
                <div className="text-3xl font-bold text-green-600 text-center">
                  €{totalAmount}
                </div>
              </div>
              
              <Button className="w-full  font-bold py-4 px-6 rounded-lg" variant="green" onClick={handleCheckoutAttempt}
                disabled={conversionInProgress}>\n  {conversionInProgress ? '⏳ Traitement...' : '✅ Valider & Payer'}\n</Button>
            </div>
            
            <div className="text-center mt-4 text-sm text-green-600">
              Processus simplifié - Conversion en 1 clic
            </div>
          </div>
        )
      
      case 'social_proof':
        return (
          <div className={`${baseClasses} bg-primary/5 border border-blue-200`}>
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-blue-900">
                🌟 Rejoignez 59,137 utilisateurs satisfaits
              </h3>
              <div className="flex justify-center items-center mt-2 text-sm text-blue-700">
                <Badge variant="info">📊 Taux de satisfaction: 95%</Badge>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded border mb-4">
              <div className="flex justify-between items-center mb-3">
                <span>Votre commande:</span>
                <span className="text-2xl font-bold text-blue-600">€{totalAmount}</span>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div>✅ Déjà 453 commandes complétées aujourd'hui</div>
                <div>✅ Chiffre d'affaires: €51,509 générés</div>
                <div>✅ 108 fournisseurs de confiance</div>
              </div>
            </div>
            
            <Button className="w-full  font-bold py-4 px-6 rounded-lg" variant="blue" onClick={handleCheckoutAttempt}
              disabled={conversionInProgress}>\n  {conversionInProgress ? '⏳ Finalisation...' : '🤝 Rejoindre la Communauté'}\n</Button>
            
            <div className="text-center mt-3 text-xs text-blue-600">
              🔒 Paiement sécurisé • 🚚 Livraison rapide • ⭐ Support 24/7
            </div>
          </div>
        )
      
      default: // control
        return (
          <div className={`${baseClasses} bg-gray-50 border border-gray-200`}>
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Finaliser la commande
              </h3>
            </div>
            
            <div className="bg-white p-4 rounded border mb-4">
              <div className="flex justify-between items-center">
                <span>Total:</span>
                <span className="text-xl font-bold">€{totalAmount}</span>
              </div>
            </div>
            
            <button
              onClick={handleCheckoutAttempt}
              disabled={conversionInProgress}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded"
            >
              {conversionInProgress ? 'Traitement...' : 'Payer'}
            </button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 py-12">
      <div className="container mx-auto px-6">
        
        {/* Header de test */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4">
            <span className="text-2xl">🧪</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test A/B Checkout - Mission 987 Commandes
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Test en cours pour optimiser les <strong>{pendingOrdersCount} commandes pendantes</strong> et maximiser le taux de conversion
          </p>
          
          {testActive && (
            <div className="mt-4">
              <Badge variant="success">✅ Test Actif - Variante: {variant.toUpperCase()}</Badge>
            </div>
          )}
        </div>

        {/* Interface de checkout selon variante */}
        <div className="flex justify-center">
          {renderCheckoutInterface()}
        </div>

        {/* Métriques de test */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-4">📊 Objectifs du Test</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{pendingOrdersCount}</div>
                <div className="text-sm text-gray-600">Commandes à Convertir</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">€{Math.round(pendingOrdersCount * 35.76).toLocaleString()}</div>
                <div className="text-sm text-gray-600">Potentiel de CA</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{variant}</div>
                <div className="text-sm text-gray-600">Variante Testée</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutOptimization
