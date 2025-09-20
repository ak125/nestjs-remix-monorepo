/**
 * 🧩 MODULAR SECTION COMPONENT
 * 
 * Composant React pour afficher les sections modulaires
 * ✅ Support des templates dynamiques
 * ✅ Gestion des props et styles
 * ✅ Responsive et accessible
 */

import React from 'react';
import { ModularSection } from '../types/layout';

// Templates de sections disponibles
import { HeroMinimal } from './templates/HeroMinimal';
import { HeroExtended } from './templates/HeroExtended';
import { FeaturesGrid } from './templates/FeaturesGrid';
import { CTASimple } from './templates/CTASimple';
import { ContentBlock } from './templates/ContentBlock';
import { Gallery } from './templates/Gallery';
import { Testimonials } from './templates/Testimonials';

interface ModularSectionComponentProps {
  section: ModularSection;
  className?: string;
  onEdit?: (section: ModularSection) => void;
  isEditable?: boolean;
}

// Mapping des templates
const TEMPLATE_COMPONENTS = {
  HeroMinimal,
  HeroExtended,
  FeaturesGrid,
  CTASimple,
  ContentBlock,
  Gallery,
  Testimonials,
} as const;

export const ModularSectionComponent: React.FC<ModularSectionComponentProps> = ({
  section,
  className = '',
  onEdit,
  isEditable = false,
}) => {
  // Récupérer le composant template correspondant
  const TemplateComponent = TEMPLATE_COMPONENTS[section.template as keyof typeof TEMPLATE_COMPONENTS];

  if (!TemplateComponent) {
    console.warn(`Template "${section.template}" non trouvé pour la section ${section.id}`);
    return (
      <div className={`modular-section unknown-template ${className}`}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Template "{section.template}" non disponible
          </p>
        </div>
      </div>
    );
  }

  // Générer les styles CSS personnalisés
  const customStyles = generateCustomStyles(section);

  return (
    <section
      id={`section-${section.id}`}
      className={`modular-section modular-section--${section.type} ${className}`}
      style={customStyles}
      data-section-id={section.id}
      data-section-type={section.type}
      data-section-category={section.category}
    >
      {/* Bouton d'édition si mode éditable */}
      {isEditable && onEdit && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => onEdit(section)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
            title={`Éditer ${section.name}`}
          >
            ✏️ Éditer
          </button>
        </div>
      )}

      {/* Rendu du template avec les props */}
      <TemplateComponent
        {...section.props}
        sectionId={section.id}
        sectionName={section.name}
      />

      {/* CSS personnalisé inline si défini */}
      {section.styles?.customCSS && (
        <style>
          {`#section-${section.id} { ${section.styles.customCSS} }`}
        </style>
      )}
    </section>
  );
};

/**
 * Génère les styles CSS personnalisés pour une section
 */
function generateCustomStyles(section: ModularSection): React.CSSProperties {
  const styles: React.CSSProperties = {};

  if (section.styles) {
    // Background
    if (section.styles.background) {
      styles.background = section.styles.background;
    }

    // Couleur du texte
    if (section.styles.textColor) {
      styles.color = section.styles.textColor;
    }

    // Espacement
    if (section.styles.spacing) {
      const spacingMap = {
        tight: '2rem 1rem',
        normal: '4rem 1rem',
        relaxed: '6rem 1rem',
      };
      styles.padding = spacingMap[section.styles.spacing] || spacingMap.normal;
    }
  }

  return styles;
}

/**
 * 📋 SECTIONS CONTAINER COMPONENT
 * 
 * Conteneur pour afficher plusieurs sections modulaires
 */

interface SectionsContainerProps {
  sections: ModularSection[];
  context: string;
  className?: string;
  isEditable?: boolean;
  onEditSection?: (section: ModularSection) => void;
  onAddSection?: () => void;
}

export const SectionsContainer: React.FC<SectionsContainerProps> = ({
  sections,
  context,
  className = '',
  isEditable = false,
  onEditSection,
  onAddSection,
}) => {
  // Trier les sections par position
  const sortedSections = [...sections].sort((a, b) => a.position - b.position);

  return (
    <div className={`sections-container sections-container--${context} ${className}`}>
      {/* Bouton d'ajout de section si mode éditable */}
      {isEditable && onAddSection && (
        <div className="mb-4">
          <button
            onClick={onAddSection}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
          >
            ➕ Ajouter une section
          </button>
        </div>
      )}

      {/* Affichage des sections */}
      {sortedSections.length > 0 ? (
        sortedSections.map((section) => (
          <ModularSectionComponent
            key={section.id}
            section={section}
            className="mb-6 last:mb-0"
            onEdit={onEditSection}
            isEditable={isEditable}
          />
        ))
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Aucune section disponible pour ce contexte.</p>
          {isEditable && onAddSection && (
            <button
              onClick={onAddSection}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Créer la première section
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 🎛️ SECTION PREVIEW COMPONENT
 * 
 * Composant pour prévisualiser une section avant de l'ajouter
 */

interface SectionPreviewProps {
  template: string;
  props: any;
  styles?: any;
  className?: string;
}

export const SectionPreview: React.FC<SectionPreviewProps> = ({
  template,
  props,
  styles,
  className = '',
}) => {
  const TemplateComponent = TEMPLATE_COMPONENTS[template as keyof typeof TEMPLATE_COMPONENTS];

  if (!TemplateComponent) {
    return (
      <div className={`section-preview section-preview--error ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Template "{template}" non disponible</p>
        </div>
      </div>
    );
  }

  const customStyles = generateCustomStyles({
    id: 'preview',
    name: 'Preview',
    type: 'content',
    category: 'shared',
    template,
    props,
    styles: styles || {},
    conditions: {},
    position: 0,
    is_active: true,
  });

  return (
    <div 
      className={`section-preview section-preview--${template} ${className}`}
      style={customStyles}
    >
      <TemplateComponent {...props} sectionId="preview" sectionName="Preview" />
    </div>
  );
};
