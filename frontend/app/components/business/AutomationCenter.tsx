import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';

// 🤖 Types pour l'automation business
interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: 'inventory' | 'marketing' | 'customer' | 'finance' | 'operations';
  trigger: {
    type: 'threshold' | 'time' | 'event' | 'condition';
    condition: string;
    value?: number;
    schedule?: string;
  };
  actions: {
    type: 'notification' | 'email' | 'webhook' | 'task' | 'adjustment';
    target: string;
    parameters: Record<string, any>;
  }[];
  status: 'active' | 'paused' | 'draft';
  executionCount: number;
  lastExecution?: string;
  successRate: number;
  impact: {
    metric: string;
    improvement: number;
    period: string;
  };
}

interface WorkflowExecution {
  id: string;
  ruleName: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  duration: number;
  actions: number;
  result: string;
}

interface AutomationMetrics {
  totalRules: number;
  activeRules: number;
  executionsToday: number;
  successRate: number;
  timeSaved: number;
  costSavings: number;
}

// 🤖 Composant principal Automation Center
export function AutomationCenter() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'executions' | 'builder' | 'analytics'>('rules');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 Génération de données d'automation
  useEffect(() => {
    const generateAutomationData = () => {
      // Règles d'automation
      const mockRules: AutomationRule[] = [
        {
          id: 'rule-001',
          name: 'Alerte stock faible',
          description: 'Notification automatique quand le stock descend sous le seuil critique',
          category: 'inventory',
          trigger: {
            type: 'threshold',
            condition: 'stock_quantity < threshold',
            value: 10
          },
          actions: [
            {
              type: 'notification',
              target: 'inventory-manager',
              parameters: { urgency: 'high', message: 'Stock critique atteint' }
            },
            {
              type: 'email',
              target: 'purchasing@company.com',
              parameters: { template: 'reorder-alert', product: '{product_name}' }
            }
          ],
          status: 'active',
          executionCount: 156,
          lastExecution: '2024-09-05T10:30:00Z',
          successRate: 98.7,
          impact: {
            metric: 'Ruptures de stock évitées',
            improvement: 85,
            period: '30 jours'
          }
        },
        {
          id: 'rule-002',
          name: 'Réactivation clients inactifs',
          description: 'Campagne email automatique pour clients sans achat depuis 60 jours',
          category: 'marketing',
          trigger: {
            type: 'condition',
            condition: 'days_since_last_order > 60',
            value: 60
          },
          actions: [
            {
              type: 'email',
              target: 'inactive_customers',
              parameters: { template: 'reactivation', discount: 15 }
            },
            {
              type: 'task',
              target: 'marketing-team',
              parameters: { action: 'create_retargeting_campaign' }
            }
          ],
          status: 'active',
          executionCount: 45,
          lastExecution: '2024-09-04T14:00:00Z',
          successRate: 73.2,
          impact: {
            metric: 'Clients réactivés',
            improvement: 23,
            period: '90 jours'
          }
        },
        {
          id: 'rule-003',
          name: 'Ajustement prix dynamique',
          description: 'Optimisation automatique des prix basée sur la demande et concurrence',
          category: 'finance',
          trigger: {
            type: 'time',
            schedule: 'daily_6am',
            condition: 'market_analysis_complete'
          },
          actions: [
            {
              type: 'adjustment',
              target: 'product_prices',
              parameters: { max_change: 5, algorithm: 'competitive_pricing' }
            },
            {
              type: 'notification',
              target: 'pricing-team',
              parameters: { summary: true }
            }
          ],
          status: 'active',
          executionCount: 30,
          lastExecution: '2024-09-05T06:00:00Z',
          successRate: 95.0,
          impact: {
            metric: 'Marge augmentée',
            improvement: 12,
            period: '30 jours'
          }
        },
        {
          id: 'rule-004',
          name: 'Support client prioritaire',
          description: 'Escalade automatique pour clients VIP avec problème',
          category: 'customer',
          trigger: {
            type: 'event',
            condition: 'support_ticket_created AND customer_tier = VIP'
          },
          actions: [
            {
              type: 'task',
              target: 'senior_support',
              parameters: { priority: 'urgent', sla: '1_hour' }
            },
            {
              type: 'notification',
              target: 'customer_success_manager',
              parameters: { customer_id: '{customer_id}', issue: '{ticket_summary}' }
            }
          ],
          status: 'active',
          executionCount: 23,
          lastExecution: '2024-09-05T09:15:00Z',
          successRate: 100.0,
          impact: {
            metric: 'Satisfaction VIP',
            improvement: 35,
            period: '60 jours'
          }
        },
        {
          id: 'rule-005',
          name: 'Rapport financier automatique',
          description: 'Génération et envoi automatique des rapports financiers hebdomadaires',
          category: 'operations',
          trigger: {
            type: 'time',
            condition: 'schedule',
            schedule: 'weekly_monday_9am'
          },
          actions: [
            {
              type: 'task',
              target: 'report_generator',
              parameters: { type: 'financial_weekly', recipients: ['finance@company.com'] }
            }
          ],
          status: 'active',
          executionCount: 12,
          lastExecution: '2024-09-02T09:00:00Z',
          successRate: 91.7,
          impact: {
            metric: 'Temps économisé',
            improvement: 8,
            period: 'heures/semaine'
          }
        }
      ];

      // Exécutions récentes
      const mockExecutions: WorkflowExecution[] = [
        {
          id: 'exec-001',
          ruleName: 'Alerte stock faible',
          timestamp: '2024-09-05T10:30:00Z',
          status: 'success',
          duration: 250,
          actions: 2,
          result: 'Notification envoyée pour Filtre à huile XYZ'
        },
        {
          id: 'exec-002',
          ruleName: 'Support client prioritaire',
          timestamp: '2024-09-05T09:15:00Z',
          status: 'success',
          duration: 180,
          actions: 2,
          result: 'Ticket escaladé au support senior'
        },
        {
          id: 'exec-003',
          ruleName: 'Ajustement prix dynamique',
          timestamp: '2024-09-05T06:00:00Z',
          status: 'success',
          duration: 1200,
          actions: 1,
          result: '127 prix ajustés selon l\'analyse marché'
        },
        {
          id: 'exec-004',
          ruleName: 'Réactivation clients inactifs',
          timestamp: '2024-09-04T14:00:00Z',
          status: 'success',
          duration: 450,
          actions: 2,
          result: '89 emails de réactivation envoyés'
        },
        {
          id: 'exec-005',
          ruleName: 'Alerte stock faible',
          timestamp: '2024-09-04T11:45:00Z',
          status: 'failed',
          duration: 30,
          actions: 0,
          result: 'Erreur: Service email indisponible'
        }
      ];

      // Métriques d'automation
      const mockMetrics: AutomationMetrics = {
        totalRules: mockRules.length,
        activeRules: mockRules.filter(r => r.status === 'active').length,
        executionsToday: mockExecutions.filter(e => 
          new Date(e.timestamp).toDateString() === new Date().toDateString()
        ).length,
        successRate: 94.2,
        timeSaved: 42.5,
        costSavings: 12800
      };

      setRules(mockRules);
      setExecutions(mockExecutions);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    generateAutomationData();
  }, []);

  // 🎨 Fonctions utilitaires
  const getCategoryIcon = (category: string) => {
    const icons = {
      inventory: '📦',
      marketing: '📢',
      customer: '👥',
      finance: '💰',
      operations: '⚙️'
    };
    return icons[category as keyof typeof icons] || '🔧';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      inventory: 'info',
      marketing: 'success',
      customer: 'purple',
      finance: 'warning',
      operations: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'success',
      paused: 'warning',
      draft: 'bg-gray-100 text-gray-800',
      success: 'success',
      failed: 'error',
      pending: 'info',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const filteredRules = selectedCategory === 'all' 
    ? rules 
    : rules.filter(rule => rule.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du centre d'automation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🤖 Automation Center</h1>
              <p className="text-gray-600 mt-1">Centre de contrôle des processus automatisés</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button className="px-4 py-2 rounded-md text-sm" variant="green">\n  ➕ Nouvelle règle\n</Button>
              <Button className="px-4 py-2 rounded-md text-sm" variant="blue">\n  📊 Rapport complet\n</Button>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'rules', label: '🔧 Règles', icon: '🔧' },
                { id: 'executions', label: '⚡ Exécutions', icon: '⚡' },
                { id: 'builder', label: '🏗️ Constructeur', icon: '🏗️' },
                { id: 'analytics', label: '📊 Analytics', icon: '📊' }
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
        {/* Métriques rapides */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-blue-600">{metrics.totalRules}</div>
              <div className="text-sm text-gray-600">Règles totales</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">{metrics.activeRules}</div>
              <div className="text-sm text-gray-600">Règles actives</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-purple-600">{metrics.executionsToday}</div>
              <div className="text-sm text-gray-600">Exécutions aujourd'hui</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-yellow-600">{metrics.successRate}%</div>
              <div className="text-sm text-gray-600">Taux de succès</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-indigo-600">{metrics.timeSaved}h</div>
              <div className="text-sm text-gray-600">Temps économisé</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-red-600">{metrics.costSavings.toLocaleString()}€</div>
              <div className="text-sm text-gray-600">Économies</div>
            </div>
          </div>
        )}

        {/* Contenu selon l'onglet */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Filtrer par catégorie</h3>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toutes les catégories</option>
                  <option value="inventory">📦 Inventaire</option>
                  <option value="marketing">📢 Marketing</option>
                  <option value="customer">👥 Client</option>
                  <option value="finance">💰 Finance</option>
                  <option value="operations">⚙️ Opérations</option>
                </select>
              </div>
            </div>

            {/* Liste des règles */}
            <div className="grid gap-6">
              {filteredRules.map((rule) => (
                <div key={rule.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl">{getCategoryIcon(rule.category)}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                          <p className="text-gray-600 mt-1">{rule.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(rule.category)}`}>
                          {rule.category}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(rule.status)}`}>
                          {rule.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Déclencheur */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">🎯 Déclencheur</h4>
                        <div className="text-sm text-gray-600">
                          <div><strong>Type:</strong> {rule.trigger.type}</div>
                          <div><strong>Condition:</strong> {rule.trigger.condition}</div>
                          {rule.trigger.value && <div><strong>Valeur:</strong> {rule.trigger.value}</div>}
                          {rule.trigger.schedule && <div><strong>Planning:</strong> {rule.trigger.schedule}</div>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">⚡ Actions ({rule.actions.length})</h4>
                        <div className="space-y-1">
                          {rule.actions.map((action, index) => (
                            <div key={index} className="text-sm text-gray-600">
                              <span className="font-medium">{action.type}</span> → {action.target}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Métriques */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">📊 Performance</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div><strong>Exécutions:</strong> {rule.executionCount}</div>
                          <div><strong>Succès:</strong> {rule.successRate}%</div>
                          {rule.lastExecution && (
                            <div><strong>Dernière:</strong> {new Date(rule.lastExecution).toLocaleString('fr-FR')}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Impact */}
                    <div className="mt-4 p-3 bg-success/5 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-green-600 mr-2">📈</span>
                        <span className="text-sm text-green-800">
                          <strong>Impact:</strong> {rule.impact.metric} +{rule.impact.improvement}% sur {rule.impact.period}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ID: {rule.id}
                      </div>
                      <div className="space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm">✏️ Modifier</button>
                        <button className="text-yellow-600 hover:text-yellow-800 text-sm">
                          {rule.status === 'active' ? '⏸️ Pause' : '▶️ Activer'}
                        </button>
                        <button className="text-green-600 hover:text-green-800 text-sm">🔄 Tester</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'executions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">⚡ Exécutions récentes</h3>
                <p className="text-gray-600">Historique des exécutions d'automation</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Règle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Horodatage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Durée
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Résultat
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {executions.map((execution) => (
                      <tr key={execution.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{execution.ruleName}</div>
                          <div className="text-sm text-gray-500">ID: {execution.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(execution.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {execution.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {execution.duration}ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {execution.actions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                          {execution.result}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏗️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Constructeur de règles</h3>
              <p className="text-gray-600 mb-6">
                Interface glisser-déposer pour créer des règles d'automation personnalisées
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">🎯</div>
                  <h4 className="font-medium text-gray-900">Déclencheurs</h4>
                  <p className="text-sm text-gray-600 mt-1">Conditions qui activent la règle</p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">🔍</div>
                  <h4 className="font-medium text-gray-900">Conditions</h4>
                  <p className="text-sm text-gray-600 mt-1">Logique et filtres à appliquer</p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">⚡</div>
                  <h4 className="font-medium text-gray-900">Actions</h4>
                  <p className="text-sm text-gray-600 mt-1">Tâches à exécuter automatiquement</p>
                </div>
              </div>
              <Button className="mt-8  px-6 py-3 rounded-md" variant="blue">\n  🚀 Commencer à construire\n</Button>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Graphique d'exécutions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Exécutions par jour</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    { date: '01/09', executions: 45, success: 42 },
                    { date: '02/09', executions: 52, success: 49 },
                    { date: '03/09', executions: 38, success: 36 },
                    { date: '04/09', executions: 61, success: 58 },
                    { date: '05/09', executions: 48, success: 45 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="executions" stroke="#3b82f6" name="Total" />
                    <Line type="monotone" dataKey="success" stroke="#10b981" name="Succès" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Répartition par catégorie */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Exécutions par catégorie</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { category: 'Inventaire', executions: 89 },
                    { category: 'Marketing', executions: 45 },
                    { category: 'Client', executions: 23 },
                    { category: 'Finance', executions: 30 },
                    { category: 'Opérations', executions: 12 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="executions" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insights automation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">💡 Insights automation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
<Alert className="rounded-lg p-4" variant="info">
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3 text-xl">⚡</span>
                    <div>
                      <h4 className="font-medium text-blue-900">Efficacité élevée</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        L'automation a économisé 42.5h de travail ce mois-ci
                      </p>
                    </div>
                  </div>
                </Alert>
                
<Alert className="rounded-lg p-4" variant="success">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-3 text-xl">💰</span>
                    <div>
                      <h4 className="font-medium text-green-900">ROI positif</h4>
                      <p className="text-sm text-green-700 mt-1">
                        12,800€ d'économies générées par l'automation
                      </p>
                    </div>
                  </div>
                </Alert>
                
<Alert className="rounded-lg p-4" variant="warning">
                  <div className="flex items-center">
                    <span className="text-yellow-600 mr-3 text-xl">🎯</span>
                    <div>
                      <h4 className="font-medium text-yellow-900">Opportunité</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        3 processus manuels identifiés pour automation
                      </p>
                    </div>
                  </div>
                </Alert>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
