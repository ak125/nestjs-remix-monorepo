// 🤖 Composant IA Prédictions V5.2 - Architecture Modulaire
import React, { memo } from "react";

interface RiskAnalysis {
  component: string;
  level: "critical" | "high" | "medium" | "low";
  probability: number;
  description: string;
  timeframe: string;
  prevention: string[];
}

interface CostOptimization {
  potentialSavings: number;
  bundleRecommendation: string;
  optimalTiming: string;
}

interface PredictiveMaintenance {
  nextService: string;
  estimatedDate: string;
  criticalComponents: string[];
}

interface AIPredictions {
  riskAnalysis: RiskAnalysis[];
  costOptimization: CostOptimization;
  predictiveMaintenance: PredictiveMaintenance;
}

interface AIPredictionsPanelProps {
  predictions: AIPredictions;
  vehicle: {
    marque: string;
    modele: string;
  };
  piecesCount: number;
}

export const AIPredictionsPanel = memo(function AIPredictionsPanel({
  predictions,
  vehicle,
  piecesCount,
}: AIPredictionsPanelProps) {
  return (
    <div className="relative bg-gradient-to-br from-violet-50 via-indigo-50 to-cyan-50 rounded-2xl shadow-xl border border-violet-100 p-8 mt-8 overflow-hidden group hover:shadow-2xl transition-all duration-500">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 via-indigo-400/10 to-cyan-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center animate-pulse">
              <span className="text-white text-lg">🤖</span>
            </div>
            Analyse Prédictive IA - {vehicle.marque} {vehicle.modele}
          </h2>
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 border border-violet-200">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">IA Active</span>
          </div>
        </div>

        {/* Analyse des risques et optimisation */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Analyse des risques */}
          <RiskAnalysisCard risks={predictions.riskAnalysis} />

          {/* Optimisation des coûts */}
          <CostOptimizationCard
            optimization={predictions.costOptimization}
            maintenance={predictions.predictiveMaintenance}
          />
        </div>

        {/* Footer IA */}
        <AIFooter vehicle={vehicle} piecesCount={piecesCount} />
      </div>
    </div>
  );
});

// Composant Analyse des Risques
const RiskAnalysisCard: React.FC<{ risks: RiskAnalysis[] }> = ({ risks }) => (
  <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">🎯</span>
        </div>
        Analyse des Risques
      </h3>
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-full px-3 py-1">
        <span className="text-xs font-medium text-red-700">Temps Réel</span>
      </div>
    </div>

    <div className="space-y-4">
      {risks.map((risk, index) => (
        <RiskItem key={index} risk={risk} />
      ))}
    </div>
  </div>
);

// Composant Item de Risque
const RiskItem: React.FC<{ risk: RiskAnalysis }> = ({ risk }) => {
  const getRiskStyles = (level: string) =>
    ({
      critical: "from-red-50 to-red-100 border-red-500 shadow-red-200/50",
      high: "from-orange-50 to-orange-100 border-orange-500 shadow-orange-200/50",
      medium:
        "from-yellow-50 to-yellow-100 border-yellow-500 shadow-yellow-200/50",
      low: "from-green-50 to-green-100 border-green-500 shadow-green-200/50",
    })[level] || "from-gray-50 to-gray-100 border-gray-500";

  const getBadgeStyles = (level: string) =>
    ({
      critical: "bg-destructive text-white border-red-600 shadow-red-300/50",
      high: "bg-orange-600 text-white border-orange-600 shadow-orange-300/50",
      medium: "bg-warning text-white border-yellow-600 shadow-yellow-300/50",
      low: "bg-success text-white border-green-600 shadow-green-300/50",
    })[level] || "bg-gray-500 text-white border-gray-600";

  const getDotColor = (level: string) =>
    ({
      critical: "bg-destructive",
      high: "bg-orange-500",
      medium: "bg-warning",
      low: "bg-success",
    })[level] || "bg-gray-500";

  return (
    <div
      className={`relative p-4 rounded-xl border-l-4 bg-gradient-to-r transition-all duration-300 hover:scale-[1.02] ${getRiskStyles(risk.level)} shadow-lg`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full animate-pulse ${getDotColor(risk.level)}`}
          />
          <span className="font-semibold text-gray-900">{risk.component}</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${getBadgeStyles(risk.level)} shadow-lg transform hover:scale-110 transition-transform`}
          >
            {risk.level.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-600">
            {risk.probability}%
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-2">{risk.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>⏱️ Échéance: {risk.timeframe}</span>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
          📋 Voir les préventions recommandées
        </summary>
        <ul className="mt-2 pl-4 space-y-1">
          {risk.prevention.map((prev, i) => (
            <li key={i} className="text-xs text-gray-600">
              • {prev}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

// Composant Optimisation des Coûts
const CostOptimizationCard: React.FC<{
  optimization: CostOptimization;
  maintenance: PredictiveMaintenance;
}> = ({ optimization, maintenance }) => (
  <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">💰</span>
        </div>
        Optimisation Économique
      </h3>
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-full px-3 py-1">
        <span className="text-xs font-medium text-green-700">Intelligent</span>
      </div>
    </div>

    <div className="space-y-6">
      {/* Économies potentielles */}
      <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl p-6 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
              <span className="text-white text-xs">💸</span>
            </div>
            <span className="text-lg font-bold text-green-800">
              Économies potentielles
            </span>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {optimization.potentialSavings}€
            </div>
            <div className="text-xs text-green-600 font-medium">
              Sur 12 mois
            </div>
          </div>
        </div>
        <p className="text-sm text-green-700 mb-3">
          {optimization.bundleRecommendation}
        </p>
        <div className="bg-white rounded px-3 py-2">
          <span className="text-xs font-medium text-gray-600">
            Timing optimal :
          </span>
          <span className="ml-2 text-sm text-gray-900">
            {optimization.optimalTiming}
          </span>
        </div>
      </div>

      {/* Maintenance prédictive */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center animate-pulse">
            <span className="text-white text-sm">🔧</span>
          </div>
          <h4 className="text-lg font-bold text-blue-800">
            Maintenance Prédictive
          </h4>
          <div className="ml-auto bg-muted rounded-full px-2 py-1">
            <div className="w-2 h-2 bg-info rounded-full animate-ping" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Prochaine intervention :
            </span>
            <span className="text-sm font-medium text-blue-900">
              {maintenance.estimatedDate}
            </span>
          </div>
          <p className="text-sm text-blue-700">{maintenance.nextService}</p>
          <div className="mt-3">
            <span className="text-xs font-medium text-blue-600">
              Composants critiques :
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {maintenance.criticalComponents.map((comp, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-info/20 text-info text-xs rounded"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Composant Footer IA
const AIFooter: React.FC<{
  vehicle: { marque: string; modele: string };
  piecesCount: number;
}> = ({ vehicle, piecesCount }) => (
  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-gradient-to-r from-violet-200 to-indigo-200 shadow-xl mt-8">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white text-lg animate-bounce">🤖</span>
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Analyse IA V5.2 Ultimate
            </span>
            <div className="bg-gradient-to-r from-violet-100 to-indigo-100 rounded-full px-2 py-1">
              <span className="text-xs font-bold text-violet-700">PREMIUM</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <span>📊 {piecesCount} pièces analysées</span>
            <span>•</span>
            <span>🚗 Patterns {vehicle.marque}</span>
            <span>•</span>
            <span className="text-green-600 font-medium">Temps réel</span>
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">
            Fiabilité IA
          </span>
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="w-[87%] h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="text-2xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          87%
        </div>
        <div className="text-xs text-green-600 font-medium">Excellente</div>
      </div>
    </div>
  </div>
);

export default AIPredictionsPanel;
