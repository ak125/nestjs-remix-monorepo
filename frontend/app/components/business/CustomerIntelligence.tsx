import React, { useState, useEffect } from 'react';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 🧠 Types pour l'intelligence client
interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  customerCount: number;
  averageValue: number;
  characteristics: {
    demographics: {
      ageRange: string;
      gender: Record<string, number>;
      location: Record<string, number>;
    };
    behavior: {
      purchaseFrequency: number;
      averageOrderValue: number;
      preferredCategories: Record<string, number>;
      sessionDuration: number;
    };
    preferences: {
      communicationChannel: Record<string, number>;
      paymentMethod: Record<string, number>;
      shippingPreference: Record<string, number>;
    };
  };
  insights: string[];
  recommendations: string[];
  lifetimeValue: number;
  churnRisk: 'low' | 'medium' | 'high';
  engagementScore: number;
}

interface CustomerJourney {
  stage: string;
  customers: number;
  conversionRate: number;
  avgTimeSpent: number;
  dropoffReasons?: string[];
}

interface ChurnPrediction {
  customerId: string;
  customerName: string;
  churnProbability: number;
  riskFactors: string[];
  recommendedActions: string[];
  customerValue: number;
  lastActivity: string;
}

// 🧠 Composant principal Customer Intelligence
export function CustomerIntelligence() {
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [customerJourney, setCustomerJourney] = useState<CustomerJourney[]>([]);
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'segments' | 'journey' | 'churn' | 'insights'>('segments');
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 Génération de données simulées
  useEffect(() => {
    const generateCustomerData = () => {
      // Segments clients
      const mockSegments: CustomerSegment[] = [
        {
          id: 'vip',
          name: 'Clients VIP',
          description: 'Clients premium avec forte valeur et fidélité',
          customerCount: 156,
          averageValue: 890,
          characteristics: {
            demographics: {
              ageRange: '35-55 ans',
              gender: { 'Homme': 65, 'Femme': 35 },
              location: { 'Paris': 30, 'Lyon': 20, 'Marseille': 15, 'Autres': 35 }
            },
            behavior: {
              purchaseFrequency: 8.5,
              averageOrderValue: 185,
              preferredCategories: { 'Premium': 45, 'Accessoires': 30, 'Services': 25 },
              sessionDuration: 450
            },
            preferences: {
              communicationChannel: { 'Email': 40, 'Téléphone': 35, 'SMS': 25 },
              paymentMethod: { 'Carte de crédit': 60, 'Virement': 25, 'PayPal': 15 },
              shippingPreference: { 'Express': 70, 'Standard': 25, 'Retrait': 5 }
            }
          },
          insights: [
            'Sensibles aux produits premium et aux services personnalisés',
            'Réagissent bien aux offres exclusives et aux événements VIP',
            'Forte propension au bouche-à-oreille positif'
          ],
          recommendations: [
            'Proposer un programme de fidélité premium',
            'Offrir des consultations personnalisées',
            'Organiser des événements exclusifs'
          ],
          lifetimeValue: 2840,
          churnRisk: 'low',
          engagementScore: 92
        },
        {
          id: 'loyal',
          name: 'Clients fidèles',
          description: 'Clients réguliers avec bonne rétention',
          customerCount: 892,
          averageValue: 340,
          characteristics: {
            demographics: {
              ageRange: '25-45 ans',
              gender: { 'Homme': 55, 'Femme': 45 },
              location: { 'Île-de-France': 25, 'Rhône-Alpes': 18, 'PACA': 12, 'Autres': 45 }
            },
            behavior: {
              purchaseFrequency: 5.2,
              averageOrderValue: 95,
              preferredCategories: { 'Pièces courantes': 50, 'Entretien': 30, 'Accessoires': 20 },
              sessionDuration: 280
            },
            preferences: {
              communicationChannel: { 'Email': 60, 'SMS': 25, 'App mobile': 15 },
              paymentMethod: { 'Carte bancaire': 55, 'PayPal': 30, 'Virement': 15 },
              shippingPreference: { 'Standard': 60, 'Express': 25, 'Point relais': 15 }
            }
          },
          insights: [
            'Recherchent un bon rapport qualité-prix',
            'Apprécient les rappels d\'entretien',
            'Sensibles aux promotions ciblées'
          ],
          recommendations: [
            'Programme de fidélité par points',
            'Rappels d\'entretien automatisés',
            'Offres groupées sur produits complémentaires'
          ],
          lifetimeValue: 1240,
          churnRisk: 'low',
          engagementScore: 78
        },
        {
          id: 'new',
          name: 'Nouveaux clients',
          description: 'Clients récents à fidéliser',
          customerCount: 445,
          averageValue: 85,
          characteristics: {
            demographics: {
              ageRange: '20-40 ans',
              gender: { 'Homme': 70, 'Femme': 30 },
              location: { 'Urbain': 60, 'Périurbain': 25, 'Rural': 15 }
            },
            behavior: {
              purchaseFrequency: 1.8,
              averageOrderValue: 68,
              preferredCategories: { 'Basique': 60, 'Urgent': 25, 'Accessoires': 15 },
              sessionDuration: 180
            },
            preferences: {
              communicationChannel: { 'Email': 45, 'SMS': 35, 'App mobile': 20 },
              paymentMethod: { 'Carte bancaire': 45, 'PayPal': 40, 'Mobile': 15 },
              shippingPreference: { 'Standard': 50, 'Point relais': 30, 'Express': 20 }
            }
          },
          insights: [
            'Découvrent la marque et testent les services',
            'Sensibles à l\'expérience d\'onboarding',
            'Besoin de guidage et de réassurance'
          ],
          recommendations: [
            'Parcours d\'accueil personnalisé',
            'Offre de bienvenue attractive',
            'Support client renforcé'
          ],
          lifetimeValue: 420,
          churnRisk: 'medium',
          engagementScore: 45
        },
        {
          id: 'occasional',
          name: 'Clients occasionnels',
          description: 'Achats ponctuels, potentiel de croissance',
          customerCount: 1234,
          averageValue: 45,
          characteristics: {
            demographics: {
              ageRange: '18-65 ans',
              gender: { 'Homme': 60, 'Femme': 40 },
              location: { 'Mixte': 100 }
            },
            behavior: {
              purchaseFrequency: 0.8,
              averageOrderValue: 35,
              preferredCategories: { 'Urgent': 50, 'Promotion': 30, 'Basique': 20 },
              sessionDuration: 120
            },
            preferences: {
              communicationChannel: { 'Email': 35, 'SMS': 25, 'Pub ciblée': 40 },
              paymentMethod: { 'Carte bancaire': 50, 'PayPal': 30, 'Espèces': 20 },
              shippingPreference: { 'Point relais': 45, 'Standard': 35, 'Retrait': 20 }
            }
          },
          insights: [
            'Achètent en cas de besoin urgent',
            'Sensibles aux promotions et prix',
            'Potentiel de réactivation important'
          ],
          recommendations: [
            'Campagnes de réactivation ciblées',
            'Offres promotionnelles attractives',
            'Rappels produits saisonniers'
          ],
          lifetimeValue: 180,
          churnRisk: 'high',
          engagementScore: 25
        }
      ];

      // Parcours client
      const mockJourney: CustomerJourney[] = [
        { stage: 'Découverte', customers: 10000, conversionRate: 15, avgTimeSpent: 45, dropoffReasons: ['Prix trop élevé', 'Produit non trouvé'] },
        { stage: 'Intérêt', customers: 1500, conversionRate: 35, avgTimeSpent: 120, dropoffReasons: ['Doutes sur qualité', 'Comparaison concurrence'] },
        { stage: 'Considération', customers: 525, conversionRate: 60, avgTimeSpent: 180, dropoffReasons: ['Processus trop complexe', 'Coût livraison'] },
        { stage: 'Achat', customers: 315, conversionRate: 85, avgTimeSpent: 240, dropoffReasons: ['Problème paiement', 'Stock indisponible'] },
        { stage: 'Fidélisation', customers: 268, conversionRate: 70, avgTimeSpent: 300, dropoffReasons: ['Service après-vente', 'Expérience décevante'] }
      ];

      // Prédictions de churn
      const mockChurnPredictions: ChurnPrediction[] = [
        {
          customerId: 'C001',
          customerName: 'Jean Dupont',
          churnProbability: 85,
          riskFactors: ['Pas d\'achat depuis 6 mois', 'Plainte récente', 'Baisse engagement email'],
          recommendedActions: ['Appel commercial personnalisé', 'Offre de réactivation', 'Enquête satisfaction'],
          customerValue: 1250,
          lastActivity: '2024-03-15'
        },
        {
          customerId: 'C002',
          customerName: 'Marie Martin',
          churnProbability: 72,
          riskFactors: ['Diminution fréquence achats', 'Concurrence active', 'Prix sensible'],
          recommendedActions: ['Offre prix préférentiel', 'Programme fidélité', 'Newsletter personnalisée'],
          customerValue: 890,
          lastActivity: '2024-08-22'
        },
        {
          customerId: 'C003',
          customerName: 'Pierre Durand',
          churnProbability: 68,
          riskFactors: ['Changement comportement', 'Retours produits', 'Support sollicité'],
          recommendedActions: ['Amélioration expérience', 'Formation produit', 'Suivi personnalisé'],
          customerValue: 650,
          lastActivity: '2024-08-28'
        }
      ];

      setSegments(mockSegments);
      setCustomerJourney(mockJourney);
      setChurnPredictions(mockChurnPredictions);
      setIsLoading(false);
    };

    generateCustomerData();
  }, []);

  // 🎨 Couleurs pour les graphiques
  const segmentColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const _riskColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyse de l'intelligence client...</p>
        </div>
      </div>
    );
  }

  const selectedSegmentData = segments.find(s => s.id === selectedSegment);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🧠 Customer Intelligence</h1>
              <p className="text-gray-600 mt-1">Analyse comportementale et segmentation client</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button className="px-4 py-2 rounded-md text-sm" variant="blue">\n  📊 Générer rapport\n</Button>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'segments', label: '🎯 Segments', icon: '🎯' },
                { id: 'journey', label: '🗺️ Parcours client', icon: '🗺️' },
                { id: 'churn', label: '⚠️ Prédiction churn', icon: '⚠️' },
                { id: 'insights', label: '💡 Insights IA', icon: '💡' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Contenu selon l'onglet actif */}
        {activeTab === 'segments' && (
          <div className="space-y-8">
            {/* Vue d'ensemble des segments */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {segments.map((segment, index) => (
                <div
                  key={segment.id}
                  onClick={() => setSelectedSegment(segment.id)}
                  className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedSegment === segment.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{segment.name}</h3>
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: segmentColors[index] }}
                    ></div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-gray-900">
                      {segment.customerCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">clients</div>
                    <div className="text-lg font-semibold text-green-600">
                      {segment.averageValue}€ moy.
                    </div>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      segment.churnRisk === 'low' ? 'bg-green-100 text-green-800' :
                      segment.churnRisk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      Risque: {segment.churnRisk}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Détails du segment sélectionné */}
            {selectedSegmentData && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Analyse détaillée : {selectedSegmentData.name}
                  </h3>
                  <p className="text-gray-600">{selectedSegmentData.description}</p>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Démographie */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">👥 Démographie</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-gray-600">Âge:</span>
                          <div className="font-medium">{selectedSegmentData.characteristics.demographics.ageRange}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Genre:</span>
                          <div className="mt-1">
                            {Object.entries(selectedSegmentData.characteristics.demographics.gender).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span>{key}</span>
                                <span className="font-medium">{value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comportement */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">🛒 Comportement</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Fréquence d'achat:</span>
                          <span className="font-medium">{selectedSegmentData.characteristics.behavior.purchaseFrequency}/an</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Panier moyen:</span>
                          <span className="font-medium">{selectedSegmentData.characteristics.behavior.averageOrderValue}€</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Durée session:</span>
                          <span className="font-medium">{selectedSegmentData.characteristics.behavior.sessionDuration}s</span>
                        </div>
                      </div>
                    </div>

                    {/* Métriques clés */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">📊 Métriques clés</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">LTV:</span>
                          <span className="font-medium text-green-600">{selectedSegmentData.lifetimeValue}€</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Engagement:</span>
                          <span className="font-medium">{selectedSegmentData.engagementScore}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Risque churn:</span>
                          <span className={`font-medium ${
                            selectedSegmentData.churnRisk === 'low' ? 'text-green-600' :
                            selectedSegmentData.churnRisk === 'medium' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {selectedSegmentData.churnRisk}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Insights et recommandations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">💡 Insights</h4>
                      <ul className="space-y-2">
                        {selectedSegmentData.insights.map((insight, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            <span className="text-sm text-gray-700">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">🎯 Recommandations</h4>
                      <ul className="space-y-2">
                        {selectedSegmentData.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-green-500 mr-2">→</span>
                            <span className="text-sm text-gray-700">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'journey' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">🗺️ Parcours client & conversion</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={customerJourney}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="customers" fill="#3b82f6" name="Clients" />
                  <Bar dataKey="conversionRate" fill="#10b981" name="Taux conversion %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Détails par étape */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {customerJourney.map((stage, index) => (
                <div key={stage.stage} className="bg-white rounded-lg shadow p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">{stage.stage}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Clients:</span>
                      <span className="font-medium">{stage.customers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Conversion:</span>
                      <span className="font-medium text-green-600">{stage.conversionRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Temps moyen:</span>
                      <span className="font-medium">{stage.avgTimeSpent}s</span>
                    </div>
                    {stage.dropoffReasons && (
                      <div className="mt-4">
                        <span className="text-sm text-gray-600">Causes d'abandon:</span>
                        <ul className="mt-1 text-xs text-gray-500">
                          {stage.dropoffReasons.map((reason, idx) => (
                            <li key={idx}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'churn' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">⚠️ Clients à risque de churn</h3>
                <p className="text-gray-600">Prédictions basées sur l'IA et recommandations d'action</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {churnPredictions.map((prediction) => (
                    <div key={prediction.customerId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{prediction.customerName}</h4>
                          <p className="text-sm text-gray-600">ID: {prediction.customerId} • Valeur: {prediction.customerValue}€</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            prediction.churnProbability >= 80 ? 'text-red-600' :
                            prediction.churnProbability >= 60 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {prediction.churnProbability}%
                          </div>
                          <div className="text-xs text-gray-500">Risque churn</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">🚨 Facteurs de risque</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {prediction.riskFactors.map((factor, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-red-500 mr-2">•</span>
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">💡 Actions recommandées</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {prediction.recommendedActions.map((action, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-500 mr-2">→</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Dernière activité: {new Date(prediction.lastActivity).toLocaleDateString('fr-FR')}
                        </span>
                        <div className="space-x-2">
                          <Button className="px-3 py-1 rounded text-xs" variant="blue">\n  Contacter\n</Button>
                          <Button className="px-3 py-1 rounded text-xs" variant="green">\n  Offre spéciale\n</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 Insights IA automatiques</h3>
                <div className="space-y-4">
<Alert className="rounded-lg p-4" variant="info">
                    <div className="flex items-start">
                      <span className="text-blue-600 mr-3 text-xl">🎯</span>
                      <div>
                        <h4 className="font-medium text-blue-900">Opportunité de cross-selling</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Les clients VIP qui achètent des filtres à huile ont 73% de chance d'acheter des bougies dans les 30 jours.
                        </p>
                      </div>
                    </div>
                  </Alert>
                  
<Alert className="rounded-lg p-4" variant="success">
                    <div className="flex items-start">
                      <span className="text-green-600 mr-3 text-xl">📈</span>
                      <div>
                        <h4 className="font-medium text-green-900">Tendance émergente</h4>
                        <p className="text-sm text-green-700 mt-1">
                          +35% d'intérêt pour les produits électriques chez les 25-35 ans ce mois-ci.
                        </p>
                      </div>
                    </div>
                  </Alert>
                  
<Alert className="rounded-lg p-4" variant="warning">
                    <div className="flex items-start">
                      <span className="text-yellow-600 mr-3 text-xl">⚠️</span>
                      <div>
                        <h4 className="font-medium text-yellow-900">Alerte saisonnière</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Les ventes de batteries augmentent de 45% en hiver. Préparer le stock.
                        </p>
                      </div>
                    </div>
                  </Alert>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔮 Prédictions IA</h3>
                <div className="space-y-4">
<Alert className="rounded-lg p-4" variant="default">
                    <div className="flex items-start">
                      <span className="text-purple-600 mr-3 text-xl">📊</span>
                      <div>
                        <h4 className="font-medium text-purple-900">Prévision de ventes</h4>
                        <p className="text-sm text-purple-700 mt-1">
                          +12% de croissance prévue le mois prochain basée sur les tendances actuelles.
                        </p>
                      </div>
                    </div>
                  </Alert>
                  
<Alert className="rounded-lg p-4" variant="error">
                    <div className="flex items-start">
                      <span className="text-red-600 mr-3 text-xl">🚨</span>
                      <div>
                        <h4 className="font-medium text-red-900">Risque inventaire</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Rupture de stock prévue sur 3 produits clés dans 15 jours.
                        </p>
                      </div>
                    </div>
                  </Alert>
                  
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-indigo-600 mr-3 text-xl">🎪</span>
                      <div>
                        <h4 className="font-medium text-indigo-900">Moment optimal</h4>
                        <p className="text-sm text-indigo-700 mt-1">
                          Jeudi 14h-16h est le moment optimal pour les campagnes email (35% d'ouverture).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
