/**
 * 🎨 LAYOUT UNIFIÉ AMÉLIORÉ
 * 
 * Composant React principal pour le système de layout complet
 * ✅ Support Core/Massdoc layouts dédiés
 * ✅ Sections modulaires et réutilisables
 * ✅ Headers et footers dynamiques
 * ✅ Configuration centralisée
 */

import React, { useEffect, useState } from 'react';
import  { type LayoutData, type LayoutConfig, type ModularSection } from '../../types/layout';
import { FooterEnhanced } from './FooterEnhanced';
// TODO: Créer les fichiers Header.tsx et ModularSections.tsx
// import { Header } from './Header';
// import { SectionsContainer } from './ModularSections';

// Composants temporaires
const Header: React.FC<any> = () => null;
const SectionsContainer: React.FC<any> = () => null;

interface LayoutUnifiedProps {
  config: LayoutConfig;
  children?: React.ReactNode;
  isEditable?: boolean;
  onEditSection?: (section: ModularSection) => void;
  onAddSection?: () => void;
  className?: string;
}

export const LayoutUnified: React.FC<LayoutUnifiedProps> = ({
  config,
  children,
  isEditable = false,
  onEditSection,
  onAddSection,
  className = '',
}) => {
  const [layoutData, setLayoutData] = useState<LayoutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les données de layout
  useEffect(() => {
    loadLayoutData();
  }, [config]);

  const loadLayoutData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: config.type,
        ...(config.page && { page: config.page }),
        ...(config.version && { version: config.version }),
        ...(config.theme && { theme: config.theme }),
      });

      const response = await fetch(`/api/layout?${params}`);
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setLayoutData(result.data);
      } else {
        throw new Error(result.message || 'Erreur lors du chargement du layout');
      }
    } catch (err) {
      console.error('Erreur loadLayoutData:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      
      // Layout de fallback
      setLayoutData({
        header: {
          show: true,
          logo: { src: '/logo-fallback.svg', alt: 'Logo', link: '/' },
          navigation: { show: false, items: [] },
        },
        footer: { show: false },
        sections: [],
        navigation: { main: [], secondary: [] },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Affichage pendant le chargement
  if (isLoading) {
    return (
      <div className="layout-loading">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement du layout...</p>
          </div>
        </div>
      </div>
    );
  }

  // Affichage en cas d'erreur
  if (error && !layoutData) {
    return (
      <div className="layout-error">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Erreur de chargement
            </h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadLayoutData}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!layoutData) {
    return null;
  }

  // Classes CSS dynamiques basées sur la configuration
  const layoutClasses = [
    'layout-unified',
    `layout-type--${config.type}`,
    config.theme && `layout-theme--${config.theme}`,
    config.page && `layout-page--${config.page}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Header */}
      {config.showHeader !== false && layoutData.header?.show && (
        <Header
          config={layoutData.header}
          context={config.type}
          isEditable={isEditable}
        />
      )}

      {/* Contenu principal */}
      <main className="layout-main">
        {/* Sections modulaires avant le contenu */}
        {layoutData.sections && layoutData.sections.length > 0 && (
          <SectionsContainer
            sections={layoutData.sections}
            context={config.type}
            isEditable={isEditable}
            onEditSection={onEditSection}
            onAddSection={onAddSection}
            className="layout-sections"
          />
        )}

        {/* Contenu passé en props */}
        {children && (
          <div className="layout-content">
            {children}
          </div>
        )}
      </main>

      {/* Footer */}
      {config.showFooter !== false && layoutData.footer?.show && (
        <FooterEnhanced
          config={layoutData.footer}
          context={config.type}
          isEditable={isEditable}
        />
      )}

      {/* Métadonnées et scripts dynamiques */}
      {layoutData.metaTags && (
        <MetaTags tags={layoutData.metaTags} />
      )}

      {/* Styles personnalisés pour le layout */}
      <style>{getLayoutStyles(config, layoutData)}</style>

      {/* Indicateur de performance en mode debug */}
      {isEditable && layoutData.performance && (
        <PerformanceIndicator performance={layoutData.performance} />
      )}
    </div>
  );
};

/**
 * 🏷️ Composant pour les métadonnées
 */
interface MetaTagsProps {
  tags: any;
}

const MetaTags: React.FC<MetaTagsProps> = ({ tags }) => {
  useEffect(() => {
    // Mettre à jour le titre de la page
    if (tags.title) {
      document.title = tags.title;
    }

    // Mettre à jour les métadonnées
    if (tags.description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', tags.description);
    }
  }, [tags]);

  return null;
};

/**
 * 📊 Indicateur de performance pour le mode debug
 */
interface PerformanceIndicatorProps {
  performance: any;
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({ performance }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50">
      <div>Cache: {performance.cacheKey}</div>
      <div>Mis à jour: {new Date(performance.lastUpdated).toLocaleTimeString()}</div>
      <div>Expire: {performance.expires}s</div>
    </div>
  );
};

/**
 * 🎨 Génère les styles CSS personnalisés pour le layout
 */
function getLayoutStyles(config: LayoutConfig, layoutData: LayoutData): string {
  const styles: string[] = [];

  // Styles basés sur le type de layout
  switch (config.type) {
    case 'core':
      styles.push(`
        .layout-type--core {
          --primary-color: #3b82f6;
          --secondary-color: #64748b;
          --background-color: #f8fafc;
        }
      `);
      break;
    case 'massdoc':
      styles.push(`
        .layout-type--massdoc {
          --primary-color: #059669;
          --secondary-color: #6b7280;
          --background-color: #ffffff;
        }
      `);
      break;
    case 'admin':
      styles.push(`
        .layout-type--admin {
          --primary-color: #7c3aed;
          --secondary-color: #6b7280;
          --background-color: #f9fafb;
        }
      `);
      break;
  }

  // Styles basés sur le thème
  if (config.theme === 'dark') {
    styles.push(`
      .layout-theme--dark {
        --background-color: #1f2937;
        --text-color: #f9fafb;
        --border-color: #374151;
      }
    `);
  }

  // Styles responsive globaux
  styles.push(`
    .layout-unified {
      min-height: 100vh;
      background-color: var(--background-color, #ffffff);
      color: var(--text-color, #1f2937);
    }
    
    .layout-main {
      flex: 1;
    }
    
    .layout-sections {
      position: relative;
    }
    
    .layout-content {
      position: relative;
    }
  `);

  return styles.join('\n');
}

export default LayoutUnified;
