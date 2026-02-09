/**
 * ModelContentV1Display - Composant d'affichage du contenu V1
 *
 * Affiche le contenu encyclopédique (800-1200 mots) pour une page modèle.
 * IMPORTANT: Ce composant doit être placé APRÈS le catalogue pièces (UX).
 *
 * Structure:
 * - Overview/Introduction
 * - Histoire du modèle
 * - Motorisations Diesel
 * - Motorisations Essence
 * - Tableau des motorisations
 * - Conseils d'entretien
 * - Conclusion
 *
 * @example
 * {modelContentV1 && <ModelContentV1Display content={modelContentV1} />}
 */

import {
  Book,
  History,
  Car,
  Wrench,
  FileText,
  ChevronDown,
} from "lucide-react";
import { useState, memo } from "react";
import { HtmlContent } from "~/components/seo/HtmlContent";
import {
  MotorisationsTable,
  type MotorisationEntry,
} from "./MotorisationsTable";

export interface ModelContentV1Data {
  id: number;
  marque: {
    id: number | null;
    name: string;
    alias: string;
  };
  modele: {
    id: number | null;
    name: string;
    alias: string;
    generation: string;
  };
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  histoire: string;
  dieselSection: string;
  essenceSection: string;
  motorisations: MotorisationEntry[];
  entretien: string;
  conclusion: string;
  fiabilite?: string;
  pointsForts?: string;
  pointsFaibles?: string;
  conseilsAchat?: string;
  keywords: string[];
  imageUrl: string | null;
  canonicalUrl: string | null;
  views: number;
  publishedAt: string;
  updatedAt: string;
}

interface ModelContentV1DisplayProps {
  content: ModelContentV1Data;
  /** Afficher en mode replié par défaut */
  collapsedByDefault?: boolean;
  /** Classe CSS personnalisée */
  className?: string;
}

export const ModelContentV1Display = memo(function ModelContentV1Display({
  content,
  collapsedByDefault = false,
  className = "",
}: ModelContentV1DisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsedByDefault);

  // Don't render if no content
  if (!content || (!content.intro && !content.histoire)) {
    return null;
  }

  const modelName = `${content.marque.name} ${content.modele.name}`;
  const generation = content.modele.generation
    ? ` ${content.modele.generation}`
    : "";

  return (
    <section
      className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}
      aria-label={`Guide ${modelName}`}
    >
      {/* Header avec bouton expand/collapse */}
      <div
        className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Book className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {content.h1 || `Guide ${modelName}${generation}`}
              </h2>
              <p className="text-sm text-gray-300 mt-0.5">
                Tout savoir sur votre {modelName}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-6 h-6 text-white transition-transform duration-300 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Contenu principal */}
      {isExpanded && (
        <div className="p-6 md:p-8 space-y-8">
          {/* Introduction */}
          {content.intro && (
            <ContentSection
              icon={<FileText className="w-5 h-5" />}
              title="Présentation"
              content={content.intro}
            />
          )}

          {/* Histoire */}
          {content.histoire && (
            <ContentSection
              icon={<History className="w-5 h-5" />}
              title={`Histoire de la ${modelName}`}
              content={content.histoire}
            />
          )}

          {/* Motorisations avec tableau */}
          {(content.dieselSection ||
            content.essenceSection ||
            content.motorisations?.length > 0) && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Car className="w-5 h-5 text-blue-600" />
                <span>Motorisations</span>
              </div>

              {/* Sections texte Diesel/Essence */}
              <div className="grid md:grid-cols-2 gap-6">
                {content.dieselSection && (
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-700"></span>
                      Motorisations Diesel
                    </h3>
                    <HtmlContent
                      html={content.dieselSection}
                      className="prose prose-sm prose-gray max-w-none"
                    />
                  </div>
                )}
                {content.essenceSection && (
                  <div className="bg-red-50 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Motorisations Essence
                    </h3>
                    <HtmlContent
                      html={content.essenceSection}
                      className="prose prose-sm prose-gray max-w-none"
                    />
                  </div>
                )}
              </div>

              {/* Tableau des motorisations */}
              {content.motorisations && content.motorisations.length > 0 && (
                <MotorisationsTable
                  motorisations={content.motorisations}
                  title={`Motorisations ${modelName}`}
                  showLegend
                />
              )}
            </div>
          )}

          {/* Fiabilité (optionnel) */}
          {content.fiabilite && (
            <ContentSection
              icon={<Wrench className="w-5 h-5" />}
              title="Fiabilité"
              content={content.fiabilite}
              bgColor="bg-green-50"
            />
          )}

          {/* Points forts / Points faibles */}
          {(content.pointsForts || content.pointsFaibles) && (
            <div className="grid md:grid-cols-2 gap-6">
              {content.pointsForts && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    Points forts
                  </h3>
                  <HtmlContent
                    html={content.pointsForts}
                    className="prose prose-sm prose-green max-w-none"
                  />
                </div>
              )}
              {content.pointsFaibles && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <span className="text-lg">✗</span>
                    Points faibles
                  </h3>
                  <HtmlContent
                    html={content.pointsFaibles}
                    className="prose prose-sm prose-red max-w-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Conseils d'entretien */}
          {content.entretien && (
            <ContentSection
              icon={<Wrench className="w-5 h-5" />}
              title="Conseils d'entretien"
              content={content.entretien}
              bgColor="bg-blue-50"
            />
          )}

          {/* Conseils d'achat (optionnel) */}
          {content.conseilsAchat && (
            <ContentSection
              icon={<FileText className="w-5 h-5" />}
              title="Conseils d'achat"
              content={content.conseilsAchat}
              bgColor="bg-yellow-50"
            />
          )}

          {/* Conclusion */}
          {content.conclusion && (
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">En résumé</h3>
              <HtmlContent
                html={content.conclusion}
                className="prose prose-sm prose-gray max-w-none"
              />
            </div>
          )}

          {/* Footer avec date de mise à jour */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
            <span>
              Mis à jour le{" "}
              {new Date(content.updatedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>{content.views.toLocaleString("fr-FR")} consultations</span>
          </div>
        </div>
      )}
    </section>
  );
});

// Helper component for content sections
function ContentSection({
  icon,
  title,
  content,
  bgColor = "bg-gray-50",
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  bgColor?: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-5`}>
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        {title}
      </h3>
      <HtmlContent
        html={content}
        className="prose prose-sm prose-gray max-w-none"
      />
    </div>
  );
}

export default ModelContentV1Display;
