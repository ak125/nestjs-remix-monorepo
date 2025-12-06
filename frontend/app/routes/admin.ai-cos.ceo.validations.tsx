/**
 * AI-COS v2.30.0: CEO Validations Dashboard
 * 
 * Dashboard pour le Human CEO permettant de :
 * - Voir les validations en attente
 * - Approuver/Rejeter/Différer les actions
 * - Consulter l'historique des décisions
 * - Suivre l'impact des actions validées
 * 
 * @route /admin/ai-cos/ceo/validations
 * @version 2.30.0
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useFetcher, useSearchParams } from '@remix-run/react';
import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileText,
  Bell,
  Shield,
  DollarSign,
  Activity,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { requireAdminUser } from '~/services/auth.server';
import { cn } from '~/lib/utils';

// Types
interface Validation {
  id: string;
  escalation_id: string;
  created_at: string;
  escalation_level: 'CFO' | 'CEO' | 'BOARD';
  escalation_reason: string;
  agent_id: string;
  squad_id: string;
  action_type: string;
  action_description: string;
  budget_impact: number;
  risk_score: number;
  strategic_impact: boolean;
  deadline_at: string;
  time_remaining: string;
  urgency: 'EXPIRED' | 'URGENT' | 'HIGH' | 'NORMAL';
  projected_kpis: Record<string, number>;
  potential_risks: string[];
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'expired';
  decision?: string;
  decision_reasoning?: string;
}

interface DashboardStats {
  pendingTotal: number;
  urgent: number;
  high: number;
  normal: number;
  approvedLast30d: number;
  rejectedLast30d: number;
  avgResponseTimeHours: number;
  positiveImpactTotal: number;
  patternsLearned: number;
}

interface LoaderData {
  user: { email: string; role: string };
  pendingValidations: Validation[];
  recentDecisions: Validation[];
  stats: DashboardStats;
}

// Loader
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdminUser(request);
  
  // Simuler les données pour le moment
  // TODO: Remplacer par des appels API réels
  const pendingValidations: Validation[] = [
    {
      id: 'val-001',
      escalation_id: 'ESC-001',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      escalation_level: 'CEO',
      escalation_reason: 'Budget >€10K pour campagne marketing internationale',
      agent_id: 'IA-CMO',
      squad_id: 'MARKETING',
      action_type: 'campaign_launch',
      action_description: 'Lancement campagne Google Ads Allemagne - Budget €15,000',
      budget_impact: 15000,
      risk_score: 75,
      strategic_impact: true,
      deadline_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      time_remaining: '4h',
      urgency: 'URGENT',
      projected_kpis: { revenue_increase: 12, conversion_rate: 0.8, cac: -5 },
      potential_risks: ['ROI incertain marché DE', 'Concurrence élevée'],
      status: 'pending',
    },
    {
      id: 'val-002',
      escalation_id: 'ESC-002',
      created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      escalation_level: 'CEO',
      escalation_reason: 'Réduction prix -10% sur top 30 produits',
      agent_id: 'PRICING-BOT',
      squad_id: 'E-COMMERCE',
      action_type: 'pricing_adjustment',
      action_description: 'Ajustement pricing -10% pour 30 références à forte élasticité',
      budget_impact: 8500,
      risk_score: 68,
      strategic_impact: false,
      deadline_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      time_remaining: '12h',
      urgency: 'HIGH',
      projected_kpis: { volume_increase: 25, margin_delta: -2, revenue_net: 8 },
      potential_risks: ['Erosion marge si élasticité < prévue'],
      status: 'pending',
    },
    {
      id: 'val-003',
      escalation_id: 'ESC-003',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      escalation_level: 'CFO',
      escalation_reason: 'Nouveau fournisseur pièces EV',
      agent_id: 'IA-PARTNERS',
      squad_id: 'EXPANSION',
      action_type: 'supplier_onboarding',
      action_description: 'Onboarding fournisseur chinois batteries EV - Commande initiale €25K',
      budget_impact: 25000,
      risk_score: 62,
      strategic_impact: true,
      deadline_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      time_remaining: '36h',
      urgency: 'NORMAL',
      projected_kpis: { ev_catalog_coverage: 40, new_revenue: 15 },
      potential_risks: ['Qualité inconnue', 'Lead time 6 semaines'],
      status: 'pending',
    },
  ];

  const recentDecisions: Validation[] = [
    {
      id: 'val-010',
      escalation_id: 'ESC-010',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      escalation_level: 'CEO',
      escalation_reason: 'Partenariat B2B',
      agent_id: 'IA-SALES',
      squad_id: 'CUSTOMER',
      action_type: 'partnership',
      action_description: 'Contrat cadre garage réseau €50K/an',
      budget_impact: 50000,
      risk_score: 45,
      strategic_impact: true,
      deadline_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      time_remaining: '-48h',
      urgency: 'NORMAL',
      projected_kpis: { b2b_revenue: 25, recurring_revenue: 10 },
      potential_risks: [],
      status: 'approved',
      decision: 'APPROVED',
      decision_reasoning: 'Partenariat stratégique pour développement B2B',
    },
  ];

  const stats: DashboardStats = {
    pendingTotal: pendingValidations.length,
    urgent: pendingValidations.filter(v => v.urgency === 'URGENT').length,
    high: pendingValidations.filter(v => v.urgency === 'HIGH').length,
    normal: pendingValidations.filter(v => v.urgency === 'NORMAL').length,
    approvedLast30d: 45,
    rejectedLast30d: 8,
    avgResponseTimeHours: 6.2,
    positiveImpactTotal: 125000,
    patternsLearned: 23,
  };

  return json<LoaderData>({
    user,
    pendingValidations,
    recentDecisions,
    stats,
  });
}

// Action
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAdminUser(request);
  const formData = await request.formData();
  
  const validationId = formData.get('validationId') as string;
  const decision = formData.get('decision') as string;
  const reasoning = formData.get('reasoning') as string;

  // TODO: Appeler l'API backend
  // await fetch(`/api/ai-cos/feedback/ceo/validations/${validationId}/decision`, {
  //   method: 'PUT',
  //   body: JSON.stringify({ decision, reasoning }),
  // });

  console.log(`CEO Decision: ${decision} for ${validationId} - ${reasoning}`);

  return json({ success: true, decision, validationId });
}

// Components
function UrgencyBadge({ urgency }: { urgency: string }) {
  const config = {
    EXPIRED: { bg: 'bg-gray-500', text: 'Expiré' },
    URGENT: { bg: 'bg-red-500', text: 'Urgent' },
    HIGH: { bg: 'bg-orange-500', text: 'Élevé' },
    NORMAL: { bg: 'bg-green-500', text: 'Normal' },
  };
  const { bg, text } = config[urgency as keyof typeof config] || config.NORMAL;
  
  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium text-white', bg)}>
      {text}
    </span>
  );
}

function LevelBadge({ level }: { level: string }) {
  const config = {
    BOARD: { bg: 'bg-purple-100 text-purple-800', icon: Shield },
    CEO: { bg: 'bg-blue-100 text-blue-800', icon: Activity },
    CFO: { bg: 'bg-green-100 text-green-800', icon: DollarSign },
  };
  const { bg, icon: Icon } = config[level as keyof typeof config] || config.CFO;
  
  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1', bg)}>
      <Icon className="h-3 w-3" />
      {level}
    </span>
  );
}

function ValidationCard({ validation, onDecision }: { validation: Validation; onDecision: (id: string, decision: string, reasoning: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [reasoning, setReasoning] = useState('');
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);

  const handleSubmitDecision = () => {
    if (selectedDecision && reasoning) {
      onDecision(validation.id, selectedDecision, reasoning);
      setShowDecisionForm(false);
      setSelectedDecision(null);
      setReasoning('');
    }
  };

  const deadlineDate = new Date(validation.deadline_at);
  const isOverdue = deadlineDate < new Date();

  return (
    <div className={cn(
      'border rounded-lg p-4 shadow-sm transition-all',
      validation.urgency === 'URGENT' && 'border-red-300 bg-red-50',
      validation.urgency === 'HIGH' && 'border-orange-300 bg-orange-50',
      validation.urgency === 'NORMAL' && 'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm text-gray-500">#{validation.escalation_id}</span>
            <UrgencyBadge urgency={validation.urgency} />
            <LevelBadge level={validation.escalation_level} />
          </div>
          <h3 className="font-semibold text-gray-900">{validation.action_description}</h3>
          <p className="text-sm text-gray-600 mt-1">{validation.escalation_reason}</p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm">
            <Clock className={cn('h-4 w-4', isOverdue ? 'text-red-500' : 'text-gray-400')} />
            <span className={cn(isOverdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
              {validation.time_remaining} restant
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Deadline: {deadlineDate.toLocaleString('fr-FR')}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-gray-100 rounded-md">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Budget Impact</div>
          <div className="font-semibold text-lg">
            {validation.budget_impact >= 0 ? '+' : ''}€{validation.budget_impact.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Risk Score</div>
          <div className={cn(
            'font-semibold text-lg',
            validation.risk_score >= 70 ? 'text-red-600' : validation.risk_score >= 50 ? 'text-orange-600' : 'text-green-600'
          )}>
            {validation.risk_score}/100
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Agent</div>
          <div className="font-medium text-sm">{validation.agent_id}</div>
          <div className="text-xs text-gray-400">{validation.squad_id}</div>
        </div>
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-3"
      >
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {expanded ? 'Masquer détails' : 'Voir détails'}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Projected KPIs */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">📊 KPIs Projetés</h4>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(validation.projected_kpis).map(([key, value]) => (
                <div key={key} className="bg-white p-2 rounded border">
                  <div className="text-xs text-gray-500">{key.replace(/_/g, ' ')}</div>
                  <div className={cn(
                    'font-medium flex items-center gap-1',
                    value >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {value >= 0 ? '+' : ''}{value}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Potential Risks */}
          {validation.potential_risks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">⚠️ Risques Potentiels</h4>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {validation.potential_risks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Decision Buttons */}
      {validation.status === 'pending' && (
        <div className="mt-4 pt-4 border-t">
          {!showDecisionForm ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setSelectedDecision('APPROVED'); setShowDecisionForm(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Approuver
              </button>
              <button
                onClick={() => { setSelectedDecision('REJECTED'); setShowDecisionForm(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Rejeter
              </button>
              <button
                onClick={() => { setSelectedDecision('DEFERRED'); setShowDecisionForm(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <Clock className="h-4 w-4" />
                Différer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Décision:</span>
                <span className={cn(
                  'px-2 py-1 rounded text-sm font-medium',
                  selectedDecision === 'APPROVED' && 'bg-green-100 text-green-800',
                  selectedDecision === 'REJECTED' && 'bg-red-100 text-red-800',
                  selectedDecision === 'DEFERRED' && 'bg-gray-100 text-gray-800',
                )}>
                  {selectedDecision === 'APPROVED' && '✅ Approuvé'}
                  {selectedDecision === 'REJECTED' && '❌ Rejeté'}
                  {selectedDecision === 'DEFERRED' && '⏸️ Différé'}
                </span>
              </div>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Justification de votre décision (obligatoire)..."
                className="w-full p-3 border rounded-md text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmitDecision}
                  disabled={!reasoning}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => { setShowDecisionForm(false); setSelectedDecision(null); setReasoning(''); }}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision Display (if already decided) */}
      {validation.status !== 'pending' && (
        <div className={cn(
          'mt-4 p-3 rounded-md',
          validation.status === 'approved' && 'bg-green-50 border border-green-200',
          validation.status === 'rejected' && 'bg-red-50 border border-red-200',
          validation.status === 'deferred' && 'bg-gray-50 border border-gray-200',
        )}>
          <div className="flex items-center gap-2 mb-1">
            {validation.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {validation.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
            {validation.status === 'deferred' && <Clock className="h-4 w-4 text-gray-600" />}
            <span className="font-medium capitalize">{validation.status}</span>
          </div>
          {validation.decision_reasoning && (
            <p className="text-sm text-gray-600">{validation.decision_reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      {trend && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-sm',
          trend.positive ? 'text-green-600' : 'text-red-600'
        )}>
          {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend.positive ? '+' : ''}{trend.value}% vs mois dernier
        </div>
      )}
    </div>
  );
}

// Main Component
export default function CeoValidationsPage() {
  const { user, pendingValidations, recentDecisions, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'pending';

  const handleDecision = (validationId: string, decision: string, reasoning: string) => {
    fetcher.submit(
      { validationId, decision, reasoning },
      { method: 'post' }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Validation CEO</h1>
              <p className="text-sm text-gray-500">AI-COS v2.30.0 - Boucles de Feedback</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50">
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifications</span>
                {stats.urgent > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2">
                    {stats.urgent}
                  </span>
                )}
              </button>
              <div className="text-sm text-gray-600">
                {user.email}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="En attente"
            value={stats.pendingTotal}
            subtitle={`${stats.urgent} urgent(s)`}
            icon={Clock}
          />
          <StatsCard
            title="Approuvées (30j)"
            value={stats.approvedLast30d}
            icon={CheckCircle}
            trend={{ value: 12, positive: true }}
          />
          <StatsCard
            title="Temps réponse moy."
            value={`${stats.avgResponseTimeHours}h`}
            subtitle="Target: <12h"
            icon={Activity}
          />
          <StatsCard
            title="Impact positif"
            value={`+€${(stats.positiveImpactTotal / 1000).toFixed(0)}K`}
            subtitle="Post-approval 30j"
            icon={TrendingUp}
            trend={{ value: 8, positive: true }}
          />
        </div>

        {/* Urgency Summary */}
        <div className="flex gap-4 mb-6">
          <div className={cn(
            'flex-1 p-4 rounded-lg border-l-4',
            stats.urgent > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'
          )}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('h-5 w-5', stats.urgent > 0 ? 'text-red-500' : 'text-gray-400')} />
              <span className="font-medium">Urgent ({stats.urgent})</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Validation requise dans les 4h</p>
          </div>
          <div className="flex-1 p-4 rounded-lg bg-orange-50 border-l-4 border-orange-500">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Élevé ({stats.high})</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Validation requise dans les 24h</p>
          </div>
          <div className="flex-1 p-4 rounded-lg bg-green-50 border-l-4 border-green-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium">Normal ({stats.normal})</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Validation requise dans les 48h</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setSearchParams({ tab: 'pending' })}
              className={cn(
                'px-4 py-2 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'pending'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              En attente ({stats.pendingTotal})
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'history' })}
              className={cn(
                'px-4 py-2 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Historique
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'patterns' })}
              className={cn(
                'px-4 py-2 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'patterns'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Patterns appris
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingValidations.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Aucune validation en attente</h3>
                <p className="text-gray-500 mt-1">Toutes les actions ont été traitées.</p>
              </div>
            ) : (
              pendingValidations
                .sort((a, b) => {
                  const urgencyOrder = { EXPIRED: 0, URGENT: 1, HIGH: 2, NORMAL: 3 };
                  return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                })
                .map((validation) => (
                  <ValidationCard
                    key={validation.id}
                    validation={validation}
                    onDecision={handleDecision}
                  />
                ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-medium mb-4">Décisions récentes (30 derniers jours)</h3>
              {recentDecisions.map((validation) => (
                <ValidationCard
                  key={validation.id}
                  validation={validation}
                  onDecision={handleDecision}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-medium mb-4">📚 Patterns Appris ({stats.patternsLearned})</h3>
            <p className="text-gray-500 text-sm">
              Les patterns sont automatiquement appris à partir des actions avec un impact positif significatif.
              Ils sont réutilisés par les agents pour optimiser les décisions futures.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Patterns de succès</span>
                </div>
                <div className="text-2xl font-bold text-green-600">23</div>
                <p className="text-xs text-gray-500 mt-1">Success rate: 87%</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="font-medium">Patterns d'échec</span>
                </div>
                <div className="text-2xl font-bold text-red-600">5</div>
                <p className="text-xs text-gray-500 mt-1">Évités par les agents</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
