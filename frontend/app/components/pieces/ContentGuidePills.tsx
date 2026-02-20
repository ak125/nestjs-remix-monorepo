import { Link } from "@remix-run/react";
import { BookOpen, Wrench, FileText, HelpCircle } from "lucide-react";
import { memo } from "react";

interface ContentGuidePillsProps {
  /** Alias gamme (ex: "disque-frein") — utilisé pour construire les URLs */
  pgAlias?: string;
  /** Nom gamme (ex: "Disque de frein") — utilisé dans les labels */
  pgName?: string;
  /** Référence R4 disponible (issue du pipeline Zod) */
  reference?: {
    slug: string;
    title: string;
    definition: string;
  } | null;
}

/**
 * Bandeau compact de navigation contextuelle R1 → contenus internes.
 *
 * Anti-duplication SEO :
 * - Texte visible < 50 mots (labels UI + 1 phrase universelle)
 * - pgName est la seule variable → différencie 220 gammes
 * - Pas de paragraphe éditorial (c'est un composant de navigation)
 * - Le contenu long vit sur les pages cibles (R3/R4), pas ici
 */
export const ContentGuidePills = memo(function ContentGuidePills({
  pgAlias,
  pgName,
  reference,
}: ContentGuidePillsProps) {
  const lowerName = pgName?.toLowerCase() || "pièce";

  return (
    <nav
      aria-label="Guides et ressources"
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      {/* Phrase universelle — 18 mots */}
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-600">
          Sélectionnez votre véhicule ci-dessus pour afficher uniquement les{" "}
          {lowerName} compatibles avec votre motorisation.
        </p>
      </div>

      {/* Cartes contextuelles */}
      <div className="flex flex-wrap gap-2">
        {/* Universel — comment utiliser le sélecteur */}
        <Link
          to="/blog-pieces-auto/guide-achat/selecteur-vehicule"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Comment utiliser le sélecteur
        </Link>

        {/* Guide d'achat gamme */}
        {pgAlias && (
          <Link
            to={`/blog-pieces-auto/guide-achat/${pgAlias}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guide d'achat {lowerName}
          </Link>
        )}

        {/* Conseils entretien gamme */}
        {pgAlias && (
          <Link
            to={`/blog-pieces-auto/conseils/${pgAlias}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            Conseils {lowerName}
          </Link>
        )}

        {/* Référence technique R4 (si disponible) */}
        {reference && (
          <Link
            to={`/reference-auto/${reference.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Fiche technique : {reference.title}
          </Link>
        )}
      </div>
    </nav>
  );
});
