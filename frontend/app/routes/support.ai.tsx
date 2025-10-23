import { Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";

// Interfaces simplifiées pour éviter les problèmes d'import
interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface CompleteAIAnalysis {
  ticketId: string;
  analysis: {
    sentiment: SentimentAnalysis;
    categorization: any;
    smartResponse: any;
    escalationPrediction: any;
    workflowOptimization: any;
  };
  recommendations: {
    priority: string;
    assignTo?: string;
    estimatedTime: number;
    requiresHuman: boolean;
    nextActions: string[];
  };
  aiConfidence: {
    sentiment: number;
    categorization: number;
    response: number;
    escalation: number;
  };
}

interface _ContactTicket {
  msg_id: string;
  msg_cst_id: string;
  msg_subject: string;
  msg_content: string;
  msg_date: string;
  customer?: {
    cst_name: string;
    cst_mail: string;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Version simplifiée pour démo
  return json({
    tickets: [
      {
        msg_id: "demo-1",
        msg_cst_id: "cst-1", 
        msg_subject: "Problème technique avec mon véhicule",
        msg_content: "Mon véhicule ne démarre plus depuis ce matin, j'ai besoin d'aide urgente",
        msg_date: new Date().toISOString(),
        customer: { cst_name: "Jean Dupont", cst_mail: "jean@example.com" }
      },
      {
        msg_id: "demo-2",
        msg_cst_id: "cst-2",
        msg_subject: "Question sur ma facture", 
        msg_content: "Je ne comprends pas certains frais sur ma dernière facture",
        msg_date: new Date().toISOString(),
        customer: { cst_name: "Marie Martin", cst_mail: "marie@example.com" }
      }
    ],
    aiStats: {
      averageConfidence: 0.85,
      automationRate: 0.65,
      escalationPrevented: 0.35,
      responseTimeImprovement: 0.45
    },
    aiHealth: {
      status: 'operational',
      services: {
        sentiment: 'ok',
        categorization: 'ok',
        smartResponse: 'ok',
        predictive: 'ok'
      }
    }
  });
}

// Fonctions utilitaires simplifiées
function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return '😊';
    case 'negative': return '😞';
    case 'neutral': return '😐';
    default: return '🤔';
  }
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'text-green-600';
    case 'negative': return 'text-red-600';
    case 'neutral': return 'text-yellow-600';
    default: return 'text-gray-600';
  }
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'text-red-800 bg-red-100';
    case 'high': return 'text-orange-800 bg-orange-100';
    case 'medium': return 'text-yellow-800 bg-yellow-100';
    case 'low': return 'text-green-800 bg-green-100';
    default: return 'text-gray-800 bg-gray-100';
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'critical': return '🚨';
    case 'high': return '⚡';
    case 'medium': return '⚠️';
    case 'low': return '📝';
    default: return '📄';
  }
}

function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  } else if (minutes < 1440) {
    return `${Math.round(minutes / 60)}h`;
  } else {
    return `${Math.round(minutes / 1440)} jour(s)`;
  }
}

// Fonction de simulation de l'analyse IA
async function simulateAIAnalysis(ticketId: string): Promise<CompleteAIAnalysis> {
  // Simulation d'une analyse IA
  return {
    ticketId,
    analysis: {
      sentiment: {
        sentiment: 'negative',
        confidence: 0.85,
        emotions: ['frustration', 'inquiétude'],
        urgency: 'high'
      },
      categorization: {
        category: 'technical',
        subcategory: 'vehicle_issue',
        confidence: 0.90
      },
      smartResponse: {
        response: `Bonjour,\n\nNous comprenons votre frustration concernant ce problème technique.\n\nUn technicien spécialisé va vous contacter dans les 2 heures pour résoudre cette situation.\n\nCordialement,\nL'équipe support`,
        confidence: 0.75,
        tone: 'apologetic',
        requiresHuman: true
      },
      escalationPrediction: {
        riskLevel: 75,
        escalationProbability: 0.65,
        priority: 'high',
        timeToEscalation: 120,
        reasoning: 'Sentiment négatif et urgence élevée détectés'
      },
      workflowOptimization: {
        recommendedAgent: 'tech-senior',
        estimatedTime: 240
      }
    },
    recommendations: {
      priority: 'high',
      assignTo: 'tech-senior',
      estimatedTime: 240,
      requiresHuman: true,
      nextActions: [
        'Contacter le client par téléphone',
        'Assigner à un technicien senior',
        'Programmer intervention sous 2h'
      ]
    },
    aiConfidence: {
      sentiment: 0.85,
      categorization: 0.90,
      response: 0.75,
      escalation: 0.65
    }
  };
}

export default function AIDemoPage() {
  const { tickets, aiStats, aiHealth } = useLoaderData<typeof loader>();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompleteAIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyzeTicket = async (ticketId: string) => {
    setLoading(true);
    setSelectedTicket(ticketId);
    
    try {
      const result = await simulateAIAnalysis(ticketId);
      setAnalysis(result);
    } catch (error) {
      console.error('Erreur analyse:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                🤖 Intelligence Artificielle Support
              </h1>
              <p className="mt-2 text-gray-600">
                Démonstration des capacités IA de notre module support
              </p>
            </div>
            <Button className="px-4 py-2 rounded-lg" variant="blue" asChild><Link to="/support">← Retour Support</Link></Button>
          </div>
        </div>

        {/* Statuts IA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Santé des services */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              💊 Santé des Services IA
            </h3>
            {aiHealth ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Statut général</span>
                  <Badge 
                    variant={aiHealth.status === 'operational' ? 'success' : 'error'} 
                    size="sm"
                  >
                    {aiHealth.status === 'operational' ? '✅ Opérationnel' : '❌ Problème'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Sentiment: {aiHealth.services.sentiment === 'ok' ? '✅' : '❌'}</div>
                  <div>Catégorisation: {aiHealth.services.categorization === 'ok' ? '✅' : '❌'}</div>
                  <div>Réponses: {aiHealth.services.smartResponse === 'ok' ? '✅' : '❌'}</div>
                  <div>Prédictif: {aiHealth.services.predictive === 'ok' ? '✅' : '❌'}</div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Données non disponibles</p>
            )}
          </div>

          {/* Statistiques IA */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📊 Performance IA
            </h3>
            {aiStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Confiance moyenne</span>
                  <span className="font-medium">{formatConfidence(aiStats.averageConfidence)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taux d'automatisation</span>
                  <span className="font-medium">{formatConfidence(aiStats.automationRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Escalations évitées</span>
                  <span className="font-medium text-green-600">{formatConfidence(aiStats.escalationPrevented)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gain temps réponse</span>
                  <span className="font-medium text-blue-600">{formatConfidence(aiStats.responseTimeImprovement)}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Données non disponibles</p>
            )}
          </div>

          {/* Fonctionnalités */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🛠️ Fonctionnalités IA
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Analyse de sentiment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Catégorisation intelligente</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Réponses suggérées</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Prédiction d'escalation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Optimisation workflow</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Liste des tickets */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">🎫 Tickets Récents</h2>
              <p className="text-gray-600">Cliquez sur un ticket pour l'analyser avec l'IA</p>
            </div>
            <div className="p-6">
              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.msg_id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTicket === ticket.msg_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleAnalyzeTicket(ticket.msg_id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900 line-clamp-2">
                          {ticket.msg_subject}
                        </h3>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(ticket.msg_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {typeof ticket.msg_content === 'string' 
                          ? ticket.msg_content.substring(0, 100) + '...'
                          : 'Contenu du ticket...'}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">
                          Client: {ticket.customer?.cst_name || 'Inconnu'}
                        </span>
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          disabled={loading && selectedTicket === ticket.msg_id}
                        >
                          {loading && selectedTicket === ticket.msg_id 
                            ? '🔄 Analyse...' 
                            : '🤖 Analyser'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Aucun ticket disponible pour la démonstration
                </p>
              )}
            </div>
          </div>

          {/* Résultats d'analyse */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">🔍 Analyse IA</h2>
              <p className="text-gray-600">Résultats détaillés de l'intelligence artificielle</p>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Analyse en cours...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-6">
                  {/* Sentiment */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                      {getSentimentEmoji(analysis.analysis.sentiment.sentiment)} 
                      Analyse de Sentiment
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Sentiment:</span>
                        <span className={`font-medium ${getSentimentColor(analysis.analysis.sentiment.sentiment)}`}>
                          {analysis.analysis.sentiment.sentiment}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Confiance:</span>
                        <span className="font-medium">{formatConfidence(analysis.analysis.sentiment.confidence)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Urgence:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(analysis.analysis.sentiment.urgency)}`}>
                          {analysis.analysis.sentiment.urgency}
                        </span>
                      </div>
                      {analysis.analysis.sentiment.emotions.length > 0 && (
                        <div>
                          <span className="text-sm text-gray-600">Émotions détectées:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {analysis.analysis.sentiment.emotions.map((emotion, index) => (
                              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                {emotion}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Catégorisation */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                      🏷️ Catégorisation Intelligente
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Catégorie:</span>
                        <span className="font-medium">{analysis.analysis.categorization.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sous-catégorie:</span>
                        <span className="font-medium">{analysis.analysis.categorization.subcategory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Confiance:</span>
                        <span className="font-medium">{formatConfidence(analysis.analysis.categorization.confidence)}</span>
                      </div>
                      {analysis.analysis.categorization.suggestedAgent && (
                        <div className="flex justify-between">
                          <span>Agent suggéré:</span>
                          <span className="font-medium text-blue-600">{analysis.analysis.categorization.suggestedAgent}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prédiction d'escalation */}
                  <div className="border-l-4 border-orange-500 pl-4">
                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                      ⚡ Prédiction d'Escalation
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Niveau de risque:</span>
                        <span className="font-medium">{analysis.analysis.escalationPrediction.riskLevel}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Probabilité:</span>
                        <span className="font-medium">{formatConfidence(analysis.analysis.escalationPrediction.escalationProbability)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Priorité:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(analysis.analysis.escalationPrediction.priority)}`}>
                          {getPriorityIcon(analysis.analysis.escalationPrediction.priority)} {analysis.analysis.escalationPrediction.priority}
                        </span>
                      </div>
                      {analysis.analysis.escalationPrediction.timeToEscalation && (
                        <div className="flex justify-between">
                          <span>Temps estimé:</span>
                          <span className="font-medium">{formatEstimatedTime(analysis.analysis.escalationPrediction.timeToEscalation)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recommandations */}
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                      💡 Recommandations IA
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Temps estimé:</span>
                        <span className="font-medium">{formatEstimatedTime(analysis.recommendations.estimatedTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Intervention humaine:</span>
                        <span className={`font-medium ${analysis.recommendations.requiresHuman ? 'text-orange-600' : 'text-green-600'}`}>
                          {analysis.recommendations.requiresHuman ? '⚠️ Requise' : '✅ Non requise'}
                        </span>
                      </div>
                      {analysis.recommendations.nextActions.length > 0 && (
                        <div>
                          <span className="text-sm text-gray-600">Actions suggérées:</span>
                          <ul className="mt-1 space-y-1">
                            {analysis.recommendations.nextActions.slice(0, 3).map((action, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Réponse suggérée */}
                  {analysis.analysis.smartResponse.response && (
                    <div className="border-l-4 border-indigo-500 pl-4">
                      <h3 className="font-semibold flex items-center gap-2 mb-2">
                        💬 Réponse Suggérée
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">
                            Ton: {analysis.analysis.smartResponse.tone} | 
                            Confiance: {formatConfidence(analysis.analysis.smartResponse.confidence)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-line">
                          {analysis.analysis.smartResponse.response.substring(0, 300)}
                          {analysis.analysis.smartResponse.response.length > 300 && '...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🤖</div>
                  <p className="text-gray-600">
                    Sélectionnez un ticket à gauche pour voir l'analyse IA en action
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500">
          <p>🤖 Démonstration des capacités d'Intelligence Artificielle du module Support</p>
          <p className="text-sm mt-1">
            Cette IA analyse automatiquement les tickets, prédit les escalations et suggère des réponses optimales
          </p>
        </div>
      </div>
    </div>
  );
}
