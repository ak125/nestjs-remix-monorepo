/**
 * Présentation des slots projetés R3 en sections servies (ADR-106 D6 + D8).
 *
 * Entrée : les slots d'une décision `READY_FOR_RENDER` (mapper ADR-106, Markdown verbatim du
 * WIKI). Sortie : des `R3GuideSection` de même forme que le chemin legacy, que la page conseil
 * rend déjà sans branche dédiée.
 *
 * Règles :
 *   - **titres fixes par section servie** (D8) — jamais repris de `sg_content`, du plan de titres
 *     ni d'une génération ; un titre propre à une entité relève du contrat WIKI (ADR-062) ;
 *   - HTML = encadrés (`safety_warnings`, D4) puis composants dans l'ordre de la table, chacun
 *     rendu par `renderProjectionMarkdown` (D6). Aucun normaliseur legacy : pas de liste déduite
 *     d'une prose, pas de dédoublonnage de mots, pas de résolution `#LinkGamme_n#` (syntaxe du
 *     contenu legacy ; le maillage du contenu projeté passe par les liens Markdown `[t](/…)`) ;
 *   - provenance non affichée (`sources: []`) : les `source_ids` sont des références internes
 *     (RAW, DB), pas des citations publiques (D8) ;
 *   - ordre = `CANONICAL_ORDER` de la page ; S1 séparée du corps, comme en legacy.
 *
 * Exhaustivité : le mapper n'émet de slot que pour une entrée `component` de la table, et la table
 * des titres est typée sur ces mêmes entrées — aucun slot émis ne peut manquer de titre.
 *
 * Pure et déterministe.
 */
import type { PlannableSection } from '@config/keyword-plan.constants';
import {
  R3_RENDER_CONTRACT,
  type R3Slot,
  type R3WikiSection,
} from '@modules/seo-projection/projection-r3.mapper';
import { renderProjectionMarkdown } from '@modules/seo-projection/projection-markdown.renderer';
import type { R3GuideSection } from '../interfaces/r3-guide.interfaces';
import { CANONICAL_ORDER, slugifyTitle } from './html-normalize.utils';

type R3ComponentEntry = Extract<
  (typeof R3_RENDER_CONTRACT)[R3WikiSection],
  { kind: 'component' }
>;

/** Sections servies qu'un composant de la table ADR-106 peut alimenter. */
export type R3ProjectedSection = R3ComponentEntry['slot'];

/**
 * Titres fixes des sections projetées (ADR-106 D8). Typés sur la table du contrat : router un
 * composant vers une nouvelle section sans lui donner de titre ne compile pas.
 */
export const R3_PROJECTED_SECTION_TITLES: Readonly<
  Record<R3ProjectedSection, string>
> = {
  S1: 'Rôle de la pièce',
  S2: "Entretien et signes d'usure",
  S4_DEPOSE: 'Démontage',
  S4_REPOSE: 'Remontage',
  S6: 'Vérifications après montage',
  S8: 'Questions fréquentes',
};

const PROJECTED_SECTIONS_IN_PAGE_ORDER = (
  Object.keys(R3_PROJECTED_SECTION_TITLES) as R3ProjectedSection[]
).sort((a, b) => CANONICAL_ORDER[a] - CANONICAL_ORDER[b]);

export interface PresentedR3Sections {
  s1Sections: R3GuideSection[];
  bodySections: R3GuideSection[];
}

/** HTML d'un slot : encadrés d'abord (avertissements avant la procédure), puis composants. */
function slotHtml(slot: R3Slot): string {
  const callouts = slot.callouts.map(
    (c) => `<blockquote>${renderProjectionMarkdown(c.content_md)}</blockquote>`,
  );
  const components = slot.components.map((c) =>
    renderProjectionMarkdown(c.content_md),
  );
  return [...callouts, ...components].join('');
}

export function presentR3Projection(
  slots: Partial<Record<PlannableSection, R3Slot>>,
): PresentedR3Sections {
  const s1Sections: R3GuideSection[] = [];
  const bodySections: R3GuideSection[] = [];

  for (const section of PROJECTED_SECTIONS_IN_PAGE_ORDER) {
    const slot = slots[section];
    if (!slot) continue;
    const title = R3_PROJECTED_SECTION_TITLES[section];
    const target = section === 'S1' ? s1Sections : bodySections;
    target.push({
      sectionType: section,
      title,
      anchor: slugifyTitle(title),
      order: target.length,
      html: slotHtml(slot),
      sources: [],
      qualityScore: null,
    });
  }

  return { s1Sections, bodySections };
}
