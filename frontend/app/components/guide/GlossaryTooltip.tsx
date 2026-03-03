/**
 * GlossaryTooltip — Inline tooltips for technical terms in conseil sections.
 * Post-processes HTML to wrap first occurrence of known terms with shadcn Tooltip.
 */

import { Link } from "@remix-run/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const GLOSSARY_TERMS: Record<string, string> = {
  moyeu: "Support central du disque ou tambour, fixé sur le porte-fusée.",
  voilage: "Déformation du disque causant vibrations au freinage.",
  "bague ABS": "Anneau magnétique lu par le capteur de vitesse de roue.",
  "couple de serrage":
    "Force de serrage spécifiée en Nm, cruciale pour la sécurité.",
  "témoin ABS":
    "Voyant tableau de bord signalant un défaut du système antiblocage.",
  étrier: "Pièce qui pince les plaquettes contre le disque pour freiner.",
  "liquide de frein":
    "Fluide hydraulique transmettant la pression de la pédale aux étriers.",
  "disque ventilé":
    "Disque de frein à double paroi avec ailettes de refroidissement.",
  garniture:
    "Matériau de friction collé ou riveté sur la plaquette ou le sabot.",
  "flexible de frein":
    "Tuyau souple reliant le circuit rigide à l'étrier mobile.",
  "capteur ABS":
    "Capteur inductif ou magnétorésistif mesurant la vitesse de roue.",
  "silent-bloc":
    "Bague en caoutchouc absorbant vibrations entre pièces métalliques.",
  rotule:
    "Articulation sphérique permettant le mouvement angulaire d'une biellette.",
  biellette: "Tige articulée reliant deux éléments de suspension ou direction.",
  amortisseur:
    "Composant hydraulique contrôlant le rebond du ressort de suspension.",
  roulement:
    "Ensemble de billes ou rouleaux réduisant la friction de rotation.",
  cardan: "Joint homocinétique transmettant le couple aux roues directrices.",
  soufflet:
    "Protection caoutchouc couvrant un joint homocinétique ou de direction.",
  "courroie de distribution":
    "Courroie crantée synchronisant vilebrequin et arbre à cames.",
  turbo:
    "Turbine entraînée par les gaz d'échappement comprimant l'air d'admission.",
};

const TERM_KEYS = Object.keys(GLOSSARY_TERMS).sort(
  (a, b) => b.length - a.length,
);
const TERM_RE = new RegExp(
  `\\b(${TERM_KEYS.map(escapeRegex).join("|")})\\b`,
  "gi",
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps the first occurrence of each glossary term in the given HTML string
 * with a <span data-glossary="term"> marker. Intended for post-processing
 * before dangerouslySetInnerHTML.
 */
export function annotateGlossaryTerms(html: string): string {
  const seen = new Set<string>();
  return html.replace(TERM_RE, (match) => {
    const key = match.toLowerCase();
    if (seen.has(key)) return match;
    const def = GLOSSARY_TERMS[key];
    if (!def) return match;
    seen.add(key);
    return `<span data-glossary="${key}" class="underline decoration-dotted decoration-gray-400 underline-offset-2 cursor-help">${match}</span>`;
  });
}

/**
 * Standalone tooltip for a single term (used if rendering React nodes).
 */
export function GlossaryTerm({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  const definition = GLOSSARY_TERMS[term.toLowerCase()];
  if (!definition) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="underline decoration-dotted decoration-gray-400 underline-offset-2 cursor-help">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          <p>{definition}</p>
          <Link
            to="/reference-auto"
            className="mt-1 block text-[10px] text-blue-500 hover:underline"
          >
            Voir dans le glossaire
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
