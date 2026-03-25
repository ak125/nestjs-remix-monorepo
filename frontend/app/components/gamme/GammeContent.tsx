import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronRight,
  FileText,
  Info,
  Settings,
  Shield,
} from "lucide-react";
import { Section, SectionHeader } from "~/components/layout";
import { R1SlotImage } from "~/components/pieces/R1SlotImage";
import { type R1ImagesBySlot } from "~/types/r1-images.types";

interface BuyArgument {
  title?: string;
  content?: string;
  icon?: string;
}

interface GammeContentProps {
  gammeName: string;
  content?: string;
  microSeoBlock?: string;
  tips?: Array<{ type: "info" | "warning"; text: string }>;
  pgAlias?: string;
  arguments?: BuyArgument[] | null;
  familyKey?: string;
  h2Override?: string | null;
  /** Images R1 à injecter dans le contenu éditorial, au bon endroit */
  r1Images?: R1ImagesBySlot;
}

// Fallback — displayed when pipeline doesn't provide buy arguments
const HOW_TO_STEPS = [
  { title: "Identifiez votre véhicule", desc: "Marque, modèle et année" },
  {
    title: "Vérifiez la motorisation",
    desc: "Code moteur sur la carte grise",
  },
  {
    title: "Comparez les références",
    desc: "Seules les compatibles s'affichent",
  },
  { title: "Commandez", desc: "Livraison rapide, retour simple" },
];

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

const ICON_MAP: Record<string, typeof CheckCircle> = {
  "check-circle": CheckCircle,
  "shield-check": Shield,
  "currency-euro": Settings,
  cube: FileText,
};

function getArgIcon(iconName?: string, index?: number): typeof CheckCircle {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  const fallbacks = [CheckCircle, Shield, Settings, FileText];
  return fallbacks[(index ?? 0) % fallbacks.length];
}

/**
 * Mapping slot R1 → mots-clés dans les H2 éditoriaux.
 * Si un H2 contient un de ces termes, l'image du slot est injectée juste après la section.
 */
const SLOT_H2_KEYWORDS: Array<{
  slot: keyof NonNullable<R1ImagesBySlot>;
  keywords: RegExp;
}> = [
  // TYPES : matcher "types de ..." en début, pas "types de montage et références" (trop générique)
  {
    slot: "TYPES",
    keywords:
      /^types\s+de\s|variante|catégorie|categorie|vissable.+cartouche|cartouche.+vissable/i,
  },
  { slot: "PRICE", keywords: /prix|tarif|fourchette|coût|cout|budget/i },
  {
    slot: "LOCATION",
    keywords: /emplacement|localiser|repérer|situé|où se trouve/i,
  },
];

/**
 * Découpe le HTML éditorial aux H2 et injecte les images R1 après la section correspondante.
 * Retourne un tableau de fragments {html, slotAfter?} à rendre séquentiellement.
 */
function splitContentWithImages(
  html: string,
  r1Images?: R1ImagesBySlot,
): Array<{ html: string; slotAfter?: keyof NonNullable<R1ImagesBySlot> }> {
  if (!r1Images || Object.keys(r1Images).length === 0) {
    return [{ html }];
  }

  // Split aux <h2 — garde le délimiteur dans le fragment suivant
  const parts = html.split(/(?=<h2[\s>])/i);
  if (parts.length <= 1) return [{ html }];

  const usedSlots = new Set<string>();
  return parts.map((part) => {
    // Extraire le texte du H2 pour matcher
    const h2Match = part.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (!h2Match) return { html: part };

    const h2Text = h2Match[1].replace(/<[^>]+>/g, ""); // strip inner tags
    for (const { slot, keywords } of SLOT_H2_KEYWORDS) {
      if (!usedSlots.has(slot) && keywords.test(h2Text) && r1Images[slot]) {
        usedSlots.add(slot);
        return { html: part, slotAfter: slot };
      }
    }
    return { html: part };
  });
}

export default function GammeContent({
  gammeName,
  content,
  microSeoBlock,
  tips,
  pgAlias,
  arguments: buyArgs,
  familyKey,
  h2Override,
  r1Images,
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

  // Split content at H2 boundaries and determine where to inject images
  const contentFragments = contentHasH2
    ? splitContentWithImages(displayContent, r1Images)
    : [{ html: displayContent }];

  const defaultTips: Array<{ type: "info" | "warning"; text: string }> =
    tips || [FAMILY_TIPS[familyKey || "generic"] || FAMILY_TIPS.generic];

  const hasPipelineArgs = buyArgs && buyArgs.length > 0;
  const sidebarSteps = hasPipelineArgs ? buyArgs : null;

  const resourceCards = [
    {
      icon: BookOpen,
      title: "Guide d'achat",
      desc: "Critères, budget, marques",
      href: pgAlias
        ? `/blog-pieces-auto/guide-achat/${pgAlias}`
        : "/blog-pieces-auto",
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      icon: Settings,
      title: "Conseils entretien",
      desc: "Quand et comment entretenir",
      href: pgAlias
        ? `/blog-pieces-auto/conseils/${pgAlias}`
        : "/blog-pieces-auto",
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      icon: FileText,
      title: "Fiche technique",
      desc: "Normes OE, spécifications",
      href: "/reference-auto",
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
  ];

  const n = gammeName.toLowerCase();

  return (
    <Section variant="white">
      {/* ── Bloc 1 : Pourquoi nous choisir + Resource cards — pleine largeur ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Pourquoi nous choisir */}
        <div className="bg-slate-50 border border-slate-200 rounded-[22px] p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <h3 className="text-[15px] font-bold text-slate-900 font-heading mb-4">
            {sidebarSteps ? "Pourquoi nous choisir" : "Choisir en 15 secondes"}
          </h3>
          {sidebarSteps
            ? sidebarSteps.map((arg, i) => {
                const Icon = getArgIcon(arg.icon, i);
                return (
                  <div
                    key={arg.title || i}
                    className="flex items-start gap-3 mb-3 last:mb-0"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Icon size={13} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-slate-800">
                        {arg.title}
                      </div>
                      {arg.content && arg.content !== arg.title && (
                        <div className="text-[11px] text-slate-500 font-normal">
                          {arg.content}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            : HOW_TO_STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="flex items-start gap-3 mb-3 last:mb-0"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-800">
                      {step.title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      {step.desc}
                    </div>
                  </div>
                </div>
              ))}
        </div>

        {/* Resource cards */}
        {resourceCards.map((c) => {
          const Icon = c.icon;
          const colorParts = c.color.split(" ");
          return (
            <Link
              key={c.title}
              to={c.href}
              className={`flex items-center gap-3 p-4 bg-white border ${colorParts[2]} rounded-[18px] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-lg hover:-translate-y-0.5 transition-all group`}
            >
              <div
                className={`w-10 h-10 rounded-xl ${colorParts[1]} flex items-center justify-center group-hover:scale-105 transition-transform`}
              >
                <Icon size={18} className={colorParts[0]} />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-slate-800">
                  {c.title}
                </div>
                <div className="text-[11px] text-slate-400 font-normal">
                  {c.desc}
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300" />
            </Link>
          );
        })}
      </div>

      {/* ── Bloc 2 : Images R1 — TYPES, PRICE, LOCATION ── */}
      {r1Images && Object.keys(r1Images).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {r1Images.TYPES && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Types de {n}
              </h2>
              <R1SlotImage {...r1Images.TYPES} className="rounded-2xl" />
            </div>
          )}
          {r1Images.PRICE && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Qualité et prix
              </h2>
              <R1SlotImage {...r1Images.PRICE} className="rounded-2xl" />
            </div>
          )}
          {r1Images.LOCATION && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Emplacement véhicule
              </h2>
              <R1SlotImage {...r1Images.LOCATION} className="rounded-2xl" />
            </div>
          )}
        </div>
      )}

      {/* ── Bloc 3 : Contenu éditorial — pleine largeur ── */}
      {!contentHasH2 && (
        <SectionHeader title={h2Override || `Bien choisir votre ${n}`} />
      )}

      <div className="gamme-editorial text-[13px] lg:text-[14px] text-slate-600 leading-relaxed font-normal font-body space-y-2.5 mb-4">
        {contentFragments.map((frag, i) => (
          <div key={i}>
            <div dangerouslySetInnerHTML={{ __html: frag.html }} />
          </div>
        ))}
      </div>

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
