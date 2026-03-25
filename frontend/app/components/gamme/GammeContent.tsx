import { AlertTriangle, Info } from "lucide-react";
import { Section, SectionHeader } from "~/components/layout";

interface GammeContentProps {
  gammeName: string;
  content?: string;
  microSeoBlock?: string;
  tips?: Array<{ type: "info" | "warning"; text: string }>;
  familyKey?: string;
  h2Override?: string | null;
}

// Fallback — displayed when pipeline doesn't provide tips
const FAMILY_TIPS: Record<string, { type: "info" | "warning"; text: string }> =
  {
    freinage: {
      type: "info",
      text: `<b class="font-semibold">Conseil freinage :</b> Vérifiez le diamètre et le type (ventilé/plein) avant commande. Remplacez toujours par paire sur le même essieu.`,
    },
    moteur: {
      type: "info",
      text: `<b class="font-semibold">Astuce carte grise :</b> Case D.2 identifie votre motorisation exacte. En cas de doute, notre équipe vérifie avant expédition.`,
    },
    suspension: {
      type: "info",
      text: `<b class="font-semibold">Conseil suspension :</b> Vérifiez la version (sport ou confort) et les cotes d'origine avant commande.`,
    },
    transmission: {
      type: "info",
      text: `<b class="font-semibold">Conseil transmission :</b> Vérifiez le type de volant moteur (simple masse ou bi-masse) et si le kit est complet.`,
    },
    electrique: {
      type: "info",
      text: `<b class="font-semibold">Conseil électrique :</b> Vérifiez l'ampérage et la connectique sur votre pièce d'origine avant commande.`,
    },
    climatisation: {
      type: "info",
      text: `<b class="font-semibold">Conseil climatisation :</b> Vérifiez le type de réfrigérant (R134a ou R1234yf) selon votre véhicule.`,
    },
    generic: {
      type: "info",
      text: `<b class="font-semibold">Astuce :</b> Utilisez notre sélecteur véhicule pour filtrer uniquement les pièces 100% compatibles avec votre auto.`,
    },
  };

/**
 * GammeContent — Contenu éditorial pur.
 *
 * Responsabilités :
 * - Rend le HTML éditorial (sg_content)
 * - Affiche les tips par famille
 *
 * NE gère PAS :
 * - Images R1 (gérées par la section dédiée dans pieces.$slug.tsx)
 * - "Pourquoi nous choisir" (déplacé vers R1TrustStrip)
 * - Resource cards (déplacées vers GammeGuideCTA ou section séparée)
 */
export default function GammeContent({
  gammeName,
  content,
  microSeoBlock,
  tips,
  familyKey,
  h2Override,
}: GammeContentProps) {
  const rawContent =
    content ||
    microSeoBlock ||
    `Trouvez votre ${gammeName.toLowerCase()} compatible parmi nos références OEM et équipementiers de qualité.`;

  // Detect if sg_content has its own H2 headings (editorial content from content-gen)
  const contentHasH2 = /<h2[\s>]/i.test(rawContent);

  // If editorial content has H2s → render as-is (no wrapper H2, no downgrade)
  // If short content without H2 → add wrapper H2 + downgrade any stray h2 to h3
  const displayContent = contentHasH2
    ? rawContent
    : rawContent.replace(/<h2(\s|>)/gi, "<h3$1").replace(/<\/h2>/gi, "</h3>");

  const n = gammeName.toLowerCase();

  const defaultTips: Array<{ type: "info" | "warning"; text: string }> =
    tips || [FAMILY_TIPS[familyKey || "generic"] || FAMILY_TIPS.generic];

  return (
    <Section variant="white">
      {/* H2 wrapper si le contenu n'a pas ses propres H2 */}
      {!contentHasH2 && (
        <SectionHeader title={h2Override || `Bien choisir votre ${n}`} />
      )}

      {/* Contenu éditorial — pleine largeur */}
      <div className="gamme-editorial text-[13px] lg:text-[14px] text-slate-600 leading-relaxed font-normal font-body space-y-2.5 mb-4">
        <div dangerouslySetInnerHTML={{ __html: displayContent }} />
      </div>

      {/* Tips par famille */}
      <div className="space-y-2.5">
        {defaultTips.map((tip, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 p-3.5 rounded-xl ${
              tip.type === "info"
                ? "bg-blue-50 border border-blue-100"
                : "bg-amber-50 border border-amber-100"
            }`}
          >
            {tip.type === "info" ? (
              <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle
                size={15}
                className="text-amber-500 mt-0.5 flex-shrink-0"
              />
            )}
            <p
              className={`text-[12px] lg:text-[13px] leading-relaxed ${
                tip.type === "info" ? "text-blue-800" : "text-amber-800"
              }`}
              dangerouslySetInnerHTML={{ __html: tip.text }}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
