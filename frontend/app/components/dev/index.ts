/**
 * 🧪 DEV COMPONENTS MODULE
 * 
 * Composants utilisés uniquement en développement
 * Pour debugging, monitoring et tests
 */

// Monitoring et debug
export { PerformanceMonitor } from './PerformanceMonitor';

// Configuration pour le mode développement
export const DEV_CONFIG = {
  // Affichage conditionnel en dev uniquement
  isDevMode: process.env.NODE_ENV === 'development',
  
  // Monitoring par défaut
  monitoring: {
    enabled: process.env.NODE_ENV === 'development',
    position: 'top-right' as const,
    updateInterval: 1000,
  },
  
  // Debug
  debug: {
    enableLogging: process.env.NODE_ENV === 'development',
    logLevel: 'info' as const,
  },
} as const;

// Utilitaire pour wrapper les composants dev
export const withDevOnly = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  return (props: P) => {
    if (!DEV_CONFIG.isDevMode) {
      return null;
    }
    return <Component {...props} />;
  };
};