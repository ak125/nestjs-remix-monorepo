// 🏷️ Types Partagés Architecture Modulaire V5.2

export interface VehicleData {
  marque: string;
  modele: string;
  type: string;
  typeId: number;
  marqueId: number;
  modeleId: number;
}

export interface GammeData {
  id: number;
  name: string;
  alias: string;
  description: string;
  image?: string;
}

export interface PieceData {
  pie_id: number;
  pie_designation: string;
  marque_nom: string;
  prix_unitaire: number;
  consigne: number;
  image_url?: string;
  disponibilite: boolean;
  oe_reference: string;
}

export interface FilterState {
  marque: string;
  search: string;
  sortBy: string;
}

export interface RiskAnalysis {
  component: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  probability: number;
  description: string;
  timeframe: string;
  prevention: string[];
}

export interface CostOptimization {
  potentialSavings: number;
  bundleRecommendation: string;
  optimalTiming: string;
}

export interface PredictiveMaintenance {
  nextService: string;
  estimatedDate: string;
  criticalComponents: string[];
}

export interface AIPredictions {
  riskAnalysis: RiskAnalysis[];
  costOptimization: CostOptimization;
  predictiveMaintenance: PredictiveMaintenance;
}

export interface BuyingGuide {
  title: string;
  content: string;
  tips?: string[];
}

export interface SmartRecommendation {
  title: string;
  description: string;
  price: number;
}

export interface CompatibilityInfo {
  engines: string[];
  years: string;
  notes: string[];
}