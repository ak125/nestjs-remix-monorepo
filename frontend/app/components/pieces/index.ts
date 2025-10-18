// 🧩 Index des Composants Modulaires V5.2
// Facilite les imports centralisés

// Composants principaux
export { VehicleHeader } from './VehicleHeader';
export { PiecesGrid } from './PiecesGrid';

// Composants IA
export { AIPredictionsPanel } from './ai-predictions/AIPredictionsPanel';

// Sections spécialisées
export { default as GuideSection } from './GuideSection';
export { default as ConseilsSection } from './ConseilsSection';
export { default as MotorisationsSection } from './MotorisationsSection';
export { default as EquipementiersSection } from './EquipementiersSection';
export { default as CatalogueSection } from './CatalogueSection';
export { default as InformationsSection } from './InformationsSection';

// Composants utilitaires
export { default as PerformanceIndicator } from './PerformanceIndicator';
export { default as LoadingState } from './LoadingState';
export { default as ErrorState } from './ErrorState';
export { default as FadeIn } from './FadeIn';

// Types partagés
export type { PieceData, VehicleData, GammeData, FilterState } from './types';