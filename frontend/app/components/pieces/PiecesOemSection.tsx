/**
 * 🎯 Section Références OEM Constructeur - SEO optimisée
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 *
 * Affiche les références OEM groupées par position (AV/AR)
 * avec contenu éducatif et conseils sécurité
 */

import { memo } from "react";
import {
  type VehicleData,
  type GammeData,
} from "../../types/pieces-route.types";

interface GroupedPiece {
  oemRefs?: string[];
  filtre_side?: string;
  filtre_gamme?: string;
  title_h2?: string;
}

interface PiecesOemSectionProps {
  groupedPieces: GroupedPiece[];
  vehicle: VehicleData;
  gamme: GammeData;
}

/**
 * Section complète des références OEM avec :
 * - Groupage par position (avant/arrière)
 * - Explication éducative "Qu'est-ce qu'une ref OEM ?"
 * - Conseils équivalences et sécurité
 */
export const PiecesOemSection = memo(function PiecesOemSection({
  groupedPieces,
  vehicle,
  gamme,
}: PiecesOemSectionProps) {
  // Ne pas afficher si aucune ref OEM
  const hasOemRefs = groupedPieces?.some(
    (g) => g.oemRefs && g.oemRefs.length > 0,
  );

  if (!hasOemRefs) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* En-tête de section */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <svg
            className="w-6 h-6 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          Références constructeur (OEM) {vehicle.marque}
        </h2>
        <p className="text-slate-300 text-sm mt-1">
          Numéros de pièce d'origine pour votre {vehicle.marque}{" "}
          {vehicle.modele}
        </p>
      </div>

      {/* Contenu avec groupes séparés */}
      <div className="p-6 space-y-6">
        {/* Introduction SEO enrichie */}
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 leading-relaxed">
            Vous cherchez des <strong>{gamme.name}</strong> pour votre{" "}
            <strong>
              {vehicle.marque} {vehicle.modele} {vehicle.type}
            </strong>{" "}
            ? Ci-dessous, retrouvez toutes les <em>références OEM</em> (Original
            Equipment Manufacturer) correspondant à votre véhicule. Ces numéros
            de pièce d'origine {vehicle.marque} vous garantissent une
            compatibilité parfaite.
          </p>
        </div>

        {/* Qu'est-ce qu'une référence OEM ? */}
        <details className="group bg-blue-50 rounded-lg border border-blue-100">
          <summary className="flex items-center justify-between cursor-pointer p-4 text-blue-900 font-medium">
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Qu'est-ce qu'une référence OEM ?
            </span>
            <svg
              className="w-5 h-5 text-blue-500 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>
          <div className="px-4 pb-4 text-sm text-blue-800 space-y-2">
            <p>
              Une <strong>référence OEM</strong> est le numéro de pièce attribué
              par le constructeur automobile (ici {vehicle.marque}) pour
              identifier une pièce spécifique. Par exemple, la référence
              <code className="bg-white px-1.5 py-0.5 rounded text-xs mx-1">
                {groupedPieces?.[0]?.oemRefs?.[0] || "41 06 003 79R"}
              </code>
              désigne une pièce d'origine {vehicle.marque}.
            </p>
            <p>
              <strong>Pourquoi c'est utile ?</strong> Cette référence vous
              permet de trouver des pièces équivalentes chez d'autres fabricants
              (Bosch, TRW, Brembo...) qui respectent les mêmes spécifications
              techniques que la pièce d'origine.
            </p>
          </div>
        </details>

        {/* Groupes OEM (AV/AR) */}
        <div className="grid gap-6 md:grid-cols-2">
          {groupedPieces
            .filter((g) => g.oemRefs && g.oemRefs.length > 0)
            .map((group, idx) => {
              const isAvant =
                (group.filtre_side || "").toLowerCase().includes("avant") ||
                (group.title_h2 || "").toLowerCase().includes("avant");
              const positionText = isAvant ? "à l'avant" : "à l'arrière";

              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-5 ${
                    isAvant
                      ? "bg-gradient-to-br from-blue-50 to-slate-50 border-blue-200"
                      : "bg-gradient-to-br from-orange-50 to-slate-50 border-orange-200"
                  }`}
                >
                  {/* Titre H3 OEM avec préfixe et modèle */}
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 flex-shrink-0 ${
                        isAvant ? "text-blue-600" : "text-orange-600"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <span>
                      Références OEM{" "}
                      {group.title_h2 ||
                        `${group.filtre_gamme} ${group.filtre_side}`}{" "}
                      {vehicle.modele}
                    </span>
                    <span
                      className={`ml-auto text-xs font-normal px-2 py-0.5 rounded-full ${
                        isAvant
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {group.oemRefs!.length} réf
                      {group.oemRefs!.length > 1 ? "s" : ""}
                    </span>
                  </h3>

                  {/* Texte explicatif dynamique */}
                  <p className="text-sm text-gray-600 mb-3">
                    Ces références {vehicle.marque} correspondent aux{" "}
                    {gamme.name} montées {positionText} de votre{" "}
                    {vehicle.modele}. Utilisez-les pour trouver des équivalences
                    chez nos marques partenaires.
                  </p>

                  {/* Liste des refs avec meilleur styling */}
                  <div className="flex flex-wrap gap-1.5">
                    {group.oemRefs!.map((ref, i) => (
                      <span
                        key={i}
                        className={`px-2.5 py-1.5 bg-white border rounded-md text-xs font-mono text-blue-900 shadow-sm hover:shadow transition-all cursor-default{
                          isAvant
                            ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                            : "border-orange-200 hover:border-orange-400 hover:bg-orange-50"
                        }`}
                        title={`Référence OEM ${vehicle.marque} - ${group.title_h2 || group.filtre_gamme}`}
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Équivalences et conseils */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Conseil équivalences */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600"
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
              Équivalences de qualité
            </h4>
            <p className="text-sm text-green-800">
              Les grandes marques comme <strong>Bosch</strong>,{" "}
              <strong>TRW</strong>, <strong>Brembo</strong> ou{" "}
              <strong>Ferodo</strong> fabriquent des pièces équivalentes aux
              références {vehicle.marque}. Elles offrent souvent le même niveau
              de qualité (voire supérieur) à un prix plus compétitif.
            </p>
          </div>

          {/* Conseil sécurité */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-600"
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
              Sécurité freinage
            </h4>
            <p className="text-sm text-amber-800">
              Le système de freinage est un élément de sécurité critique.
              Privilégiez toujours des pièces de qualité <strong>OES</strong>{" "}
              (première monte) ou <strong>certifiées ECE R90</strong> pour
              garantir des performances de freinage optimales.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

export default PiecesOemSection;
