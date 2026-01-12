import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "~/components/ui/button";

// 📊 Types pour le reporting avancé
interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: "financial" | "sales" | "marketing" | "operations" | "custom";
  frequency:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | "on-demand";
  recipients: string[];
  lastGenerated?: string;
  nextScheduled?: string;
  status: "active" | "paused" | "draft";
  dataSource: string[];
  visualizations: {
    type: "chart" | "table" | "kpi" | "trend";
    config: Record<string, any>;
  }[];
  metrics: {
    name: string;
    value: number;
    trend: "up" | "down" | "stable";
    change: number;
  }[];
}

interface ReportExecution {
  id: string;
  templateName: string;
  generatedAt: string;
  status: "completed" | "failed" | "processing";
  format: "pdf" | "excel" | "dashboard" | "email";
  size: string;
  recipients: number;
  downloadUrl?: string;
}

interface ReportMetrics {
  totalReports: number;
  scheduledReports: number;
  avgGenerationTime: number;
  successRate: number;
  dataVolume: string;
  activeRecipients: number;
}

// 📊 Composant principal Reporting Module
export function ReportingModule() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<
    "templates" | "executions" | "builder" | "analytics" | "insights"
  >("templates");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 Génération de données de reporting
  useEffect(() => {
    const generateReportingData = () => {
      // Templates de rapport
      const mockTemplates: ReportTemplate[] = [
        {
          id: "tpl-001",
          name: "Rapport financier mensuel",
          description:
            "Analyse complète des performances financières avec KPIs et tendances",
          category: "financial",
          frequency: "monthly",
          recipients: ["cfo@company.com", "finance-team@company.com"],
          lastGenerated: "2024-09-01T09:00:00Z",
          nextScheduled: "2024-10-01T09:00:00Z",
          status: "active",
          dataSource: ["accounting", "sales", "expenses"],
          visualizations: [
            { type: "chart", config: { chartType: "line", metric: "revenue" } },
            {
              type: "kpi",
              config: { metrics: ["profit_margin", "cash_flow"] },
            },
            { type: "table", config: { data: "expense_breakdown" } },
          ],
          metrics: [
            {
              name: "Chiffre d'affaires",
              value: 145600,
              trend: "up",
              change: 12.3,
            },
            { name: "Marge brute", value: 58240, trend: "up", change: 8.7 },
            {
              name: "Coûts opérationnels",
              value: 32100,
              trend: "down",
              change: -5.2,
            },
          ],
        },
        {
          id: "tpl-002",
          name: "Dashboard ventes hebdomadaire",
          description:
            "Suivi des performances commerciales et objectifs équipe",
          category: "sales",
          frequency: "weekly",
          recipients: ["sales-manager@company.com", "sales-team@company.com"],
          lastGenerated: "2024-09-02T08:00:00Z",
          nextScheduled: "2024-09-09T08:00:00Z",
          status: "active",
          dataSource: ["crm", "orders", "customers"],
          visualizations: [
            {
              type: "chart",
              config: { chartType: "bar", metric: "sales_by_rep" },
            },
            { type: "trend", config: { metric: "conversion_rate" } },
            {
              type: "kpi",
              config: { metrics: ["total_sales", "new_customers"] },
            },
          ],
          metrics: [
            { name: "Ventes totales", value: 89400, trend: "up", change: 15.6 },
            { name: "Nouveaux clients", value: 23, trend: "up", change: 21.1 },
            {
              name: "Taux conversion",
              value: 12.8,
              trend: "stable",
              change: 0.3,
            },
          ],
        },
        {
          id: "tpl-003",
          name: "Analyse marketing performance",
          description: "ROI des campagnes et métriques d'engagement digital",
          category: "marketing",
          frequency: "weekly",
          recipients: ["marketing-manager@company.com"],
          lastGenerated: "2024-09-01T10:00:00Z",
          nextScheduled: "2024-09-08T10:00:00Z",
          status: "active",
          dataSource: ["analytics", "social_media", "email_campaigns"],
          visualizations: [
            {
              type: "chart",
              config: { chartType: "pie", metric: "channel_performance" },
            },
            { type: "trend", config: { metric: "engagement_rate" } },
          ],
          metrics: [
            { name: "ROI campagnes", value: 285, trend: "up", change: 18.9 },
            { name: "Taux engagement", value: 6.4, trend: "up", change: 12.3 },
            { name: "Leads qualifiés", value: 156, trend: "up", change: 9.8 },
          ],
        },
        {
          id: "tpl-004",
          name: "Rapport opérationnel quotidien",
          description: "Indicateurs clés d'activité et alertes système",
          category: "operations",
          frequency: "daily",
          recipients: ["operations@company.com", "cto@company.com"],
          lastGenerated: "2024-09-05T07:00:00Z",
          nextScheduled: "2024-09-06T07:00:00Z",
          status: "active",
          dataSource: ["system_logs", "inventory", "support_tickets"],
          visualizations: [
            {
              type: "kpi",
              config: { metrics: ["system_uptime", "response_time"] },
            },
            {
              type: "chart",
              config: { chartType: "area", metric: "ticket_volume" },
            },
          ],
          metrics: [
            {
              name: "Uptime système",
              value: 99.8,
              trend: "stable",
              change: 0.1,
            },
            { name: "Temps réponse", value: 245, trend: "down", change: -8.3 },
            {
              name: "Tickets ouverts",
              value: 12,
              trend: "down",
              change: -15.2,
            },
          ],
        },
        {
          id: "tpl-005",
          name: "Analyse client personnalisée",
          description: "Segmentation avancée et prédictions comportementales",
          category: "custom",
          frequency: "on-demand",
          recipients: ["strategy@company.com"],
          lastGenerated: "2024-08-28T14:30:00Z",
          status: "draft",
          dataSource: [
            "customer_data",
            "purchase_history",
            "support_interactions",
          ],
          visualizations: [
            {
              type: "chart",
              config: { chartType: "scatter", metric: "customer_segments" },
            },
            { type: "table", config: { data: "churn_prediction" } },
          ],
          metrics: [
            {
              name: "Satisfaction client",
              value: 8.6,
              trend: "up",
              change: 4.2,
            },
            { name: "Risque churn", value: 15.3, trend: "down", change: -7.1 },
            {
              name: "Valeur vie client",
              value: 2450,
              trend: "up",
              change: 11.8,
            },
          ],
        },
      ];

      // Exécutions récentes
      const mockExecutions: ReportExecution[] = [
        {
          id: "exec-001",
          templateName: "Rapport opérationnel quotidien",
          generatedAt: "2024-09-05T07:00:00Z",
          status: "completed",
          format: "email",
          size: "2.3 MB",
          recipients: 2,
          downloadUrl: "/reports/daily-ops-2024-09-05.pdf",
        },
        {
          id: "exec-002",
          templateName: "Dashboard ventes hebdomadaire",
          generatedAt: "2024-09-02T08:00:00Z",
          status: "completed",
          format: "dashboard",
          size: "1.8 MB",
          recipients: 12,
          downloadUrl: "/dashboards/weekly-sales-2024-w36",
        },
        {
          id: "exec-003",
          templateName: "Rapport financier mensuel",
          generatedAt: "2024-09-01T09:00:00Z",
          status: "completed",
          format: "pdf",
          size: "4.7 MB",
          recipients: 2,
          downloadUrl: "/reports/financial-monthly-2024-08.pdf",
        },
        {
          id: "exec-004",
          templateName: "Analyse marketing performance",
          generatedAt: "2024-09-01T10:00:00Z",
          status: "completed",
          format: "excel",
          size: "3.2 MB",
          recipients: 1,
          downloadUrl: "/reports/marketing-analysis-2024-w35.xlsx",
        },
        {
          id: "exec-005",
          templateName: "Analyse client personnalisée",
          generatedAt: "2024-08-28T14:30:00Z",
          status: "failed",
          format: "pdf",
          size: "0 MB",
          recipients: 0,
        },
      ];

      // Métriques de reporting
      const mockMetrics: ReportMetrics = {
        totalReports: mockTemplates.length,
        scheduledReports: mockTemplates.filter(
          (t) => t.frequency !== "on-demand",
        ).length,
        avgGenerationTime: 42,
        successRate: 96.4,
        dataVolume: "847 GB",
        activeRecipients: 28,
      };

      setTemplates(mockTemplates);
      setExecutions(mockExecutions);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    generateReportingData();
  }, []);

  // 🎨 Fonctions utilitaires
  const getCategoryIcon = (category: string) => {
    const icons = {
      financial: "💰",
      sales: "📈",
      marketing: "📢",
      operations: "⚙️",
      custom: "🎯",
    };
    return icons[category as keyof typeof icons] || "📊";
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      financial: "success",
      sales: "info",
      marketing: "purple",
      operations: "warning",
      custom: "bg-indigo-100 text-indigo-800",
    };
    return (
      colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: "success",
      paused: "warning",
      draft: "bg-gray-100 text-gray-800",
      completed: "success",
      failed: "error",
      processing: "info",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getTrendIcon = (trend: string) => {
    const icons = {
      up: "📈",
      down: "📉",
      stable: "➡️",
    };
    return icons[trend as keyof typeof icons] || "➡️";
  };

  const getTrendColor = (trend: string) => {
    const colors = {
      up: "text-green-600",
      down: "text-red-600",
      stable: "text-gray-600",
    };
    return colors[trend as keyof typeof colors] || "text-gray-600";
  };

  const filteredTemplates =
    selectedCategory === "all"
      ? templates
      : templates.filter((template) => template.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Chargement du module de reporting...
          </p>
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
              <h1 className="text-3xl font-bold text-gray-900">
                📊 Reporting Module
              </h1>
              <p className="text-gray-600 mt-1">
                Générateur de rapports et analytics avancés
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button className="px-4 py-2 rounded-md text-sm" variant="green">
                \n ➕ Nouveau rapport\n
              </Button>
              <Button className="px-4 py-2 rounded-md text-sm" variant="blue">
                \n 🚀 Générer maintenant\n
              </Button>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: "templates", label: "📋 Templates", icon: "📋" },
                { id: "executions", label: "⚡ Exécutions", icon: "⚡" },
                { id: "builder", label: "🏗️ Builder", icon: "🏗️" },
                { id: "analytics", label: "📊 Analytics", icon: "📊" },
                { id: "insights", label: "💡 Insights", icon: "💡" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
              <div className="text-2xl font-bold text-blue-600">
                {metrics.totalReports}
              </div>
              <div className="text-sm text-gray-600">Rapports totaux</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">
                {metrics.scheduledReports}
              </div>
              <div className="text-sm text-gray-600">Rapports planifiés</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-purple-600">
                {metrics.avgGenerationTime}s
              </div>
              <div className="text-sm text-gray-600">Temps génération</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {metrics.successRate}%
              </div>
              <div className="text-sm text-gray-600">Taux de succès</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-indigo-600">
                {metrics.dataVolume}
              </div>
              <div className="text-sm text-gray-600">Volume données</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-red-600">
                {metrics.activeRecipients}
              </div>
              <div className="text-sm text-gray-600">Destinataires</div>
            </div>
          </div>
        )}

        {/* Contenu selon l'onglet */}
        {activeTab === "templates" && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Filtrer par catégorie
                </h3>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toutes les catégories</option>
                  <option value="financial">💰 Financier</option>
                  <option value="sales">📈 Ventes</option>
                  <option value="marketing">📢 Marketing</option>
                  <option value="operations">⚙️ Opérations</option>
                  <option value="custom">🎯 Personnalisé</option>
                </select>
              </div>
            </div>

            {/* Liste des templates */}
            <div className="grid gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl">
                          {getCategoryIcon(template.category)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {template.name}
                          </h3>
                          <p className="text-gray-600 mt-1">
                            {template.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}
                        >
                          {template.category}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}
                        >
                          {template.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Configuration */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          ⚙️ Configuration
                        </h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <strong>Fréquence:</strong> {template.frequency}
                          </div>
                          <div>
                            <strong>Sources:</strong>{" "}
                            {template.dataSource.length} connectées
                          </div>
                          <div>
                            <strong>Destinataires:</strong>{" "}
                            {template.recipients.length}
                          </div>
                          {template.nextScheduled && (
                            <div>
                              <strong>Prochaine:</strong>{" "}
                              {new Date(template.nextScheduled).toLocaleString(
                                "fr-FR",
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visualisations */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          📊 Visualisations ({template.visualizations.length})
                        </h4>
                        <div className="space-y-1">
                          {template.visualizations.map((viz, index) => (
                            <div key={index} className="text-sm text-gray-600">
                              <span className="font-medium">{viz.type}</span>
                              {viz.config.chartType &&
                                ` (${viz.config.chartType})`}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Métriques clés */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          📈 Métriques clés
                        </h4>
                        <div className="space-y-2">
                          {template.metrics.slice(0, 3).map((metric, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-600">
                                {metric.name}
                              </span>
                              <div className="flex items-center space-x-1">
                                <span className="font-medium">
                                  {metric.value.toLocaleString()}
                                </span>
                                <span
                                  className={`text-xs ${getTrendColor(metric.trend)}`}
                                >
                                  {getTrendIcon(metric.trend)}{" "}
                                  {Math.abs(metric.change)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ID: {template.id} • Dernière génération:{" "}
                        {template.lastGenerated
                          ? new Date(template.lastGenerated).toLocaleString(
                              "fr-FR",
                            )
                          : "Jamais"}
                      </div>
                      <div className="space-x-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✏️ Modifier
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-green-600 hover:text-green-800"
                        >
                          🚀 Générer
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-purple-600 hover:text-purple-800"
                        >
                          👁️ Aperçu
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-yellow-600 hover:text-yellow-800"
                        >
                          {template.status === "active"
                            ? "⏸️ Pause"
                            : "▶️ Activer"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "executions" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  ⚡ Exécutions récentes
                </h3>
                <p className="text-gray-600">
                  Historique des générations de rapports
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rapport
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Généré le
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Format
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Taille
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Destinataires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {executions.map((execution) => (
                      <tr key={execution.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {execution.templateName}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {execution.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(execution.generatedAt).toLocaleString(
                            "fr-FR",
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}
                          >
                            {execution.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {execution.format.toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {execution.size}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {execution.recipients}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {execution.downloadUrl &&
                          execution.status === "completed" ? (
                            <div className="space-x-2">
                              <Button
                                variant="link"
                                size="sm"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                📥 Télécharger
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-green-600 hover:text-green-800"
                              >
                                📤 Renvoyer
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-400">
                              Non disponible
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "builder" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏗️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Constructeur de rapports
              </h3>
              <p className="text-gray-600 mb-6">
                Interface glisser-déposer pour créer des rapports personnalisés
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">🗃️</div>
                  <h4 className="font-medium text-gray-900">
                    Sources de données
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Connecter aux bases de données
                  </p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">📊</div>
                  <h4 className="font-medium text-gray-900">Visualisations</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Graphiques et tableaux
                  </p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">🎨</div>
                  <h4 className="font-medium text-gray-900">Mise en forme</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Templates et styles
                  </p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-3xl mb-2">📅</div>
                  <h4 className="font-medium text-gray-900">Planification</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Automatisation et diffusion
                  </p>
                </div>
              </div>
              <Button className="mt-8  px-6 py-3 rounded-md" variant="blue">
                \n 🚀 Commencer à construire\n
              </Button>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Générations par jour */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📊 Générations de rapports
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={[
                      { date: "01/09", total: 12, success: 11, failed: 1 },
                      { date: "02/09", total: 15, success: 14, failed: 1 },
                      { date: "03/09", total: 8, success: 8, failed: 0 },
                      { date: "04/09", total: 18, success: 17, failed: 1 },
                      { date: "05/09", total: 14, success: 13, failed: 1 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      name="Total"
                    />
                    <Area
                      type="monotone"
                      dataKey="success"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      name="Succès"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Distribution par catégorie */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🎯 Répartition par catégorie
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Financier", value: 35, color: "#10b981" },
                        { name: "Ventes", value: 25, color: "#3b82f6" },
                        { name: "Marketing", value: 20, color: "#8b5cf6" },
                        { name: "Opérations", value: 15, color: "#f59e0b" },
                        { name: "Personnalisé", value: 5, color: "#6366f1" },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${((Number(percent) || 0) * 100).toFixed(0)}%`
                      }
                    >
                      {[
                        { name: "Financier", value: 35, color: "#10b981" },
                        { name: "Ventes", value: 25, color: "#3b82f6" },
                        { name: "Marketing", value: 20, color: "#8b5cf6" },
                        { name: "Opérations", value: 15, color: "#f59e0b" },
                        { name: "Personnalisé", value: 5, color: "#6366f1" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance des rapports */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ⚡ Performance des rapports
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    {
                      template: "Financier mensuel",
                      generations: 12,
                      avgTime: 45,
                      successRate: 100,
                    },
                    {
                      template: "Ventes hebdo",
                      generations: 16,
                      avgTime: 28,
                      successRate: 98,
                    },
                    {
                      template: "Marketing perf",
                      generations: 8,
                      avgTime: 35,
                      successRate: 95,
                    },
                    {
                      template: "Ops quotidien",
                      generations: 30,
                      avgTime: 15,
                      successRate: 97,
                    },
                    {
                      template: "Client custom",
                      generations: 3,
                      avgTime: 85,
                      successRate: 67,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="template" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="avgTime"
                    fill="#8b5cf6"
                    name="Temps moyen (s)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-8">
            {/* Insights principaux */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                <div className="flex items-center">
                  <span className="text-green-600 mr-3 text-2xl">💰</span>
                  <div>
                    <h4 className="font-semibold text-green-900">ROI élevé</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Les rapports automatisés économisent 15h/semaine
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center">
                  <span className="text-blue-600 mr-3 text-2xl">📊</span>
                  <div>
                    <h4 className="font-semibold text-blue-900">
                      Adoption élevée
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                      96% des utilisateurs consultent leurs rapports
                      régulièrement
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center">
                  <span className="text-purple-600 mr-3 text-2xl">🎯</span>
                  <div>
                    <h4 className="font-semibold text-purple-900">
                      Opportunité
                    </h4>
                    <p className="text-sm text-purple-700 mt-1">
                      5 nouveaux KPIs identifiés pour améliorer les performances
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommandations IA */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                🤖 Recommandations IA
              </h3>
              <div className="space-y-4">
                <div className="border-l-4 border-primary bg-primary/10 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900">
                        Optimisation des rapports financiers
                      </h4>
                      <p className="mt-1 text-sm text-blue-700">
                        Ajouter des métriques de cash flow prédictif pour
                        améliorer la planification budgétaire. Impact estimé:
                        +25% de précision des prévisions.
                      </p>
                      <div className="mt-2">
                        <Button
                          className="text-sm  px-3 py-1 rounded"
                          variant="blue"
                        >
                          \n Implémenter\n
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l-4 border-success bg-success/10 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-900">
                        Automatisation supplémentaire
                      </h4>
                      <p className="mt-1 text-sm text-green-700">
                        Créer un rapport de cohorts clients automatique pour
                        identifier les tendances de rétention. Économie de temps
                        estimée: 8h/mois.
                      </p>
                      <div className="mt-2">
                        <Button
                          className="text-sm  px-3 py-1 rounded"
                          variant="green"
                        >
                          \n Créer le template\n
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l-4 border-warning bg-warning/10 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-900">
                        Amélioration de la performance
                      </h4>
                      <p className="mt-1 text-sm text-yellow-700">
                        Le rapport "Analyse client personnalisée" échoue
                        souvent. Recommandation: Optimiser les requêtes de
                        données pour réduire le temps de traitement.
                      </p>
                      <div className="mt-2">
                        <Button
                          className="text-sm  px-3 py-1 rounded"
                          variant="yellow"
                        >
                          \n Diagnostiquer\n
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Métriques détaillées */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📈 Tendances d'utilisation
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      Rapports consultés/semaine
                    </span>
                    <span className="font-semibold text-green-600">+23%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      Temps de génération moyen
                    </span>
                    <span className="font-semibold text-blue-600">-15%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taux de succès</span>
                    <span className="font-semibold text-green-600">+2.1%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      Nouveaux utilisateurs/mois
                    </span>
                    <span className="font-semibold text-purple-600">+8</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  💾 Utilisation des ressources
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Stockage utilisé</span>
                    <span className="font-semibold">847 GB / 1 TB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: "84.7%" }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">CPU moyen</span>
                    <span className="font-semibold">23%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Bande passante/jour</span>
                    <span className="font-semibold">156 GB</span>
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
