/**
 * 📄 Section SEO principale pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 *
 * Contenu SEO enrichi avec H1, sections H2, description longue
 * ✨ Utilise HtmlContent pour le maillage interne (liens SPA + tracking)
 */

import { memo, useState } from "react";
import { Alert } from "~/components/ui/alert";
import { type SEOEnrichedContent } from "../../types/pieces-route.types";
import {
  cleanOrphanParagraphs,
  cleanInlineStyles,
} from "../../utils/seo-clean.utils";
// SEO Components - HtmlContent pour maillage interne
import { HtmlContent } from "../seo/HtmlContent";

interface PiecesSEOSectionProps {
  content: SEOEnrichedContent;
  vehicleName: string;
  gammeName: string;
}

/**
 * Section SEO principale avec contenu structuré
 */
export const PiecesSEOSection = memo(function PiecesSEOSection({
  content,
  vehicleName,
  gammeName,
}: PiecesSEOSectionProps) {
  // 🧹 Nettoyer les balises <p> orphelines dans tout le contenu SEO
  const cleanH1 = cleanOrphanParagraphs(content.h1);
  // 🎨 Nettoyer les styles inline (font-family:Calibri, font-size:11pt) qui écrasent font-heading
  const cleanLongDescription = cleanInlineStyles(
    cleanOrphanParagraphs(content.longDescription),
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* En-tête SEO */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
        <h2 className="text-3xl font-bold text-gray-900 leading-tight">
          {cleanH1}
        </h2>
      </div>

      <div className="p-6 space-y-8">
        {/* Description longue — collapsible pour scan-friendly */}
        <SeoDescriptionBlock html={cleanLongDescription} />

        {/* Sections H2 */}
        {content.h2Sections.length > 0 && (
          <div className="space-y-6">
            {content.h2Sections.map((section, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {section}
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  {generateSectionContent(section, vehicleName, gammeName)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Spécifications techniques */}
        {content.technicalSpecs.length > 0 && (
          <Alert className="rounded-lg p-6" variant="info">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Spécifications techniques
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {content.technicalSpecs.map((spec, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Notes de compatibilité */}
        {content.compatibilityNotes && (
          <Alert className="rounded-lg p-6" variant="warning">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Important - Compatibilité
            </h3>
            <p className="text-sm text-yellow-800 leading-relaxed">
              {content.compatibilityNotes}
            </p>
          </Alert>
        )}

        {/* Conseils d'installation */}
        {content.installationTips.length > 0 && (
          <Alert className="rounded-lg p-6" variant="success">
            <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Conseils d'installation
            </h3>
            <ul className="space-y-2">
              {content.installationTips.map((tip, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-green-800"
                >
                  <span className="text-green-600 font-bold mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </div>
    </div>
  );
});

/**
 * Description SEO collapsible — affiche un aperçu court + "Lire la suite"
 * Le contenu HTML complet est toujours dans le DOM (SSR) pour Googlebot
 */
function SeoDescriptionBlock({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = html.length > 500;

  return (
    <div className="prose prose-gray max-w-none font-heading">
      <div
        className={
          !expanded && isLong
            ? "max-h-[200px] overflow-hidden relative"
            : undefined
        }
      >
        <HtmlContent
          html={html}
          trackLinks={true}
          className="text-lg text-gray-700 leading-relaxed"
        />
        {!expanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? "Réduire" : "Lire la suite"}
        </button>
      )}
    </div>
  );
}

/**
 * Helper pour générer du contenu contextuel par section
 */
function generateSectionContent(
  section: string,
  vehicleName: string,
  gammeName: string,
): string {
  const lowerSection = (section || "").toLowerCase();

  if (lowerSection.includes("pourquoi") || lowerSection.includes("important")) {
    return `Les ${gammeName.toLowerCase()} de qualité sont essentiels pour garantir les performances et la sécurité de votre ${vehicleName}. Choisir des pièces adaptées assure une durabilité optimale et prévient les pannes prématurées.`;
  }

  if (lowerSection.includes("choisir") || lowerSection.includes("sélection")) {
    return `Pour sélectionner les bons ${gammeName.toLowerCase()} pour votre ${vehicleName}, vérifiez la compatibilité avec votre motorisation, privilégiez les marques reconnues (OES ou équivalent qualité constructeur), et comparez les prix tout en tenant compte de la garantie offerte.`;
  }

  if (lowerSection.includes("install") || lowerSection.includes("montage")) {
    return `L'installation des ${gammeName.toLowerCase()} sur un ${vehicleName} nécessite des outils appropriés et des connaissances techniques. Si vous n'êtes pas certain de pouvoir effectuer le montage vous-même, nous recommandons de faire appel à un professionnel qualifié.`;
  }

  if (
    lowerSection.includes("entretien") ||
    lowerSection.includes("maintenance")
  ) {
    return `Un entretien régulier des ${gammeName.toLowerCase()} prolonge leur durée de vie. Inspectez-les périodiquement, suivez les recommandations du constructeur, et remplacez-les dès les premiers signes d'usure pour éviter des problèmes plus graves.`;
  }

  return `Retrouvez notre sélection complète de ${gammeName.toLowerCase()} compatibles avec votre ${vehicleName}. Toutes nos pièces sont soigneusement sélectionnées pour leur qualité et leur fiabilité.`;
}
