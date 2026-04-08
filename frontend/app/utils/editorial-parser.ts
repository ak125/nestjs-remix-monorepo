/**
 * Editorial Parser — Extrait les blocs éditoriaux du HTML sg_content
 * et les redistribue dans les 6 sections H2 narratives de la page R1.
 *
 * Le contenu éditorial est un blob HTML avec ses propres H2. Ce parser
 * les classe par section cible pour éviter les doublons de H2.
 *
 * Les H2 originaux sont downgrade en H3 car ils deviennent des sous-sections.
 */

export interface EditorialBlocks {
  /** Blocs pour "Bien choisir votre {gamme}" — types, critères, choix */
  chooseSection: string[];
  /** Blocs pour "Qualité, prix et marques" — prix, marques, qualité */
  priceSection: string[];
  /** Blocs pour "Où se trouve et quand remplacer" — rôle, emplacement, entretien */
  locationSection: string[];
  /** Blocs pour "Trouver la bonne référence" — compatibilité, commande */
  referenceSection: string[];
  /** Questions FAQ extraites du contenu éditorial */
  faqSection: string[];
  /** Blocs non classifiés — rendus à la fin de la section "Bien choisir" */
  unmatched: string[];
}

/** Patterns de classification H2 → section */
const SECTION_PATTERNS: Array<{
  section: keyof EditorialBlocks;
  keywords: RegExp;
}> = [
  // FAQ — doit être testé en premier
  {
    section: "faqSection",
    keywords: /questions?\s+fr[eé]quentes?|faq|foire\s+aux/i,
  },
  // Emplacement, rôle, remplacement — AVANT chooseSection car "rôle" est un signal fort
  {
    section: "locationSection",
    keywords:
      /\br[oô]le\b|emplacement|o[uù]\s+se\s+trouve|remplacer|remplacement|entretien|vidange|symptôme|usure|dur[eé]e\s+de\s+vie/i,
  },
  // Qualité, prix, marques
  {
    section: "priceSection",
    keywords:
      /\bprix\b(?!.*types)|tarif|fourchette|co[uû]t|budget|\bmarques?\s+de\b|[eé]quipement|qualit[eé]|gamme\s+(?:éco|standard|premium)/i,
  },
  // Bien choisir — types (au sens variantes), critères, sélection
  {
    section: "chooseSection",
    keywords:
      /^types?\s+de\s|variante|vissable|cartouche|centrifuge|critère|choix|choisir|bien\s+choisir|diff[eé]rence|diesel.+essence|essence.+diesel/i,
  },
  // Référence, commande, compatibilité
  {
    section: "referenceSection",
    keywords:
      /r[eé]f[eé]rence|compatible|compatibilit[eé]|commander|commande|stock|livraison|exp[eé]di/i,
  },
];

/**
 * Downgrade un H2 en H3 dans un fragment HTML.
 * Préserve les attributs (class, id).
 */
function downgradeH2toH3(html: string): string {
  return html.replace(/<h2(\s|>)/gi, "<h3$1").replace(/<\/h2>/gi, "</h3>");
}

/**
 * Extrait et classifie les blocs éditoriaux d'un HTML contenant des H2.
 *
 * @param html - Contenu éditorial brut (sg_content)
 * @returns Les blocs classifiés par section, H2 downgrade en H3
 */
export function extractEditorialBlocks(html: string): EditorialBlocks {
  const result: EditorialBlocks = {
    chooseSection: [],
    priceSection: [],
    locationSection: [],
    referenceSection: [],
    faqSection: [],
    unmatched: [],
  };

  if (!html || !html.trim()) return result;

  // Pas de H2 dans le contenu → tout dans chooseSection
  if (!/<h2[\s>]/i.test(html)) {
    result.chooseSection.push(html);
    return result;
  }

  // Split aux <h2 — garde le délimiteur dans le fragment suivant
  const parts = html.split(/(?=<h2[\s>])/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extraire le texte du H2 pour classifier
    const h2Match = trimmed.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (!h2Match) {
      // Texte avant le premier H2 → locationSection (contexte général rôle/intro)
      // Seulement si suffisamment long, sinon unmatched
      const textLen = trimmed.replace(/<[^>]+>/g, "").trim().length;
      if (textLen > 200) {
        result.locationSection.push(trimmed);
      } else if (textLen > 0) {
        result.unmatched.push(trimmed);
      }
      continue;
    }

    const h2Text = h2Match[1].replace(/<[^>]+>/g, ""); // strip inner tags
    const downgraded = downgradeH2toH3(trimmed);

    // Classifier par patterns
    let matched = false;
    for (const { section, keywords } of SECTION_PATTERNS) {
      if (keywords.test(h2Text)) {
        result[section].push(downgraded);
        matched = true;
        break;
      }
    }

    if (!matched) {
      result.unmatched.push(downgraded);
    }
  }

  return result;
}

/**
 * Fusionne les blocs FAQ éditoriaux avec les FAQ statiques.
 * Priorité : FAQ éditorial, puis fallback statique (sans doublons).
 */
export function mergeFaqBlocks(
  editorialFaqHtml: string[],
  staticFaq: Array<{ question: string; answer: string }>,
): Array<{ question: string; answer: string }> {
  // Extraire les questions/réponses du HTML éditorial
  const editorialQuestions: Array<{ question: string; answer: string }> = [];

  for (const block of editorialFaqHtml) {
    // Chercher des patterns <h3>Question</h3><p>Réponse</p> ou <dt>/<dd>
    const qaPairs = block.matchAll(
      /<h3[^>]*>(.*?)<\/h3>\s*([\s\S]*?)(?=<h3|$)/gi,
    );
    for (const match of qaPairs) {
      const question = match[1].replace(/<[^>]+>/g, "").trim();
      const answer = match[2].replace(/<[^>]+>/g, "").trim();
      if (question && answer) {
        editorialQuestions.push({ question, answer });
      }
    }
  }

  if (editorialQuestions.length === 0) return staticFaq;

  // Dédupliquer : ne pas ajouter une question statique si une similaire existe déjà
  const editorialTexts = new Set(
    editorialQuestions.map((q) =>
      (q.question || "").toLowerCase().slice(0, 30),
    ),
  );
  const uniqueStatic = staticFaq.filter(
    (q) => !editorialTexts.has((q.question || "").toLowerCase().slice(0, 30)),
  );

  return [...editorialQuestions, ...uniqueStatic];
}
