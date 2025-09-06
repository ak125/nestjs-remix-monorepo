import { Link } from "@remix-run/react";

export default function BusinessIndexRoute() {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <span className="text-2xl text-white">🧠</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Phase 5: Business Intelligence Dashboard
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Suite complète d'outils d'intelligence d'affaires pour transformer vos données en insights actionnables
          </p>
          <div className="mt-6 flex items-center justify-center space-x-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              ✅ Analytics Dashboard
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              ✅ Customer Intelligence
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              ✅ Automation Center
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              ✅ Reporting Module
            </span>
          </div>
        </div>

        {/* Grid des composants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Analytics Dashboard */}
          <Link
            to="/business/analytics"
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-blue-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-xl text-white">📊</span>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    Analytics Dashboard
                  </h3>
                  <p className="text-gray-500">Dashboard exécutif</p>
                </div>
              </div>
              <div className="text-blue-500 group-hover:text-blue-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              Tableaux de bord temps réel avec métriques business clés, KPIs de performance et analyses de tendances avancées.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Temps réel
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Recharts
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                KPIs
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Responsive
              </span>
            </div>
          </Link>

          {/* Customer Intelligence */}
          <Link
            to="/business/customer"
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-purple-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-xl text-white">🧠</span>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                    Customer Intelligence
                  </h3>
                  <p className="text-gray-500">Analyse client avancée</p>
                </div>
              </div>
              <div className="text-purple-500 group-hover:text-purple-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              Segmentation client intelligente, analyse de comportement, prédiction de churn et insights IA pour optimiser la relation client.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Segmentation
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Churn Prediction
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                IA Insights
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Journey Mapping
              </span>
            </div>
          </Link>

          {/* Automation Center */}
          <Link
            to="/business/automation"
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-green-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-xl text-white">🤖</span>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                    Automation Center
                  </h3>
                  <p className="text-gray-500">Processus automatisés</p>
                </div>
              </div>
              <div className="text-green-500 group-hover:text-green-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              Centre de contrôle pour l'automatisation business avec règles intelligentes, workflows personnalisés et monitoring en temps réel.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Règles Auto
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Workflows
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Monitoring
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ROI Tracking
              </span>
            </div>
          </Link>

          {/* Reporting Module */}
          <Link
            to="/business/reporting"
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-yellow-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-xl text-white">📋</span>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-yellow-600 transition-colors">
                    Reporting Module
                  </h3>
                  <p className="text-gray-500">Rapports avancés</p>
                </div>
              </div>
              <div className="text-yellow-500 group-hover:text-yellow-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              Générateur de rapports intelligents avec templates personnalisables, planification automatique et distribution multi-format.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Templates
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Auto-Schedule
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Multi-Format
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                IA Builder
              </span>
            </div>
          </Link>
        </div>

        {/* Stats rapides */}
        <div className="mt-16 bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            🎯 Phase 5 Business Intelligence - Statistiques
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">4</div>
              <div className="text-sm text-gray-600">Modules BI</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">25+</div>
              <div className="text-sm text-gray-600">Métriques KPI</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">15+</div>
              <div className="text-sm text-gray-600">Charts Interactifs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">∞</div>
              <div className="text-sm text-gray-600">Possibilités IA</div>
            </div>
          </div>
        </div>

        {/* Technologies utilisées */}
        <div className="mt-12 text-center">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Technologies utilisées</h4>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              React 18
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              TypeScript
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              Recharts
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              Tailwind CSS
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              React Hook Form
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              React Query
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              Enterprise BI
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-12 text-center">
          <Link
            to="/test-routes"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            ← Retour aux routes de test
          </Link>
        </div>
      </div>
    </div>
  );
}
