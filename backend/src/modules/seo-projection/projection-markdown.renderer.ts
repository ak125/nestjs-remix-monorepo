/**
 * Renderer Markdown → HTML de la projection SEO (ADR-106 D6) — déterministe, 0 dépendance.
 *
 * Les blocs projetés portent du Markdown (`content_md`, verbatim depuis le WIKI) alors que les
 * surfaces servies attendent du HTML. Ce renderer est le pont, commun à tous les rôles : il ne
 * dépend d'aucun consommateur (R3 aujourd'hui, R4/R7/R8 quand leurs contrats existeront).
 *
 * **Invariant de sûreté** : le renderer n'émet QUE son propre vocabulaire de balises. Tout
 * caractère HTML (`& < > "`) hors d'une balise qu'il produit est ÉCHAPPÉ ; aucun HTML brut de
 * l'entrée ne passe. Un `<script>` dans le Markdown devient le texte `&lt;script&gt;`. La sûreté
 * est dans la grammaire (aucune règle ne produit `<script>`, d'attribut `on*` ni de schéma d'URL
 * exécutable), pas déléguée au sanitizer du frontend — qui re-sanitize par ailleurs.
 *
 * **N'invente aucune structure** (D6) : seule la structure Markdown écrite dans le bloc est rendue.
 * Une prose reste une prose : aucune liste, étape ou question n'est déduite du texte.
 *
 * Grammaire (vocabulaire de sortie FIXE) :
 *   Bloc   : paragraphes (séparés par ligne vide) → <p> ; `## ` → <h3>, `### ` → <h4> (jamais
 *            <h1>/<h2>, réservés au titre de page et de section) ; `- `/`* ` → <ul><li> ;
 *            `1. ` → <ol><li>.
 *   Inline : **x** → <strong> ; *x* → <em> (sans blanc collé aux délimiteurs) ; `x` → <code>
 *            (contenu échappé) ;
 *            [t](url) → <a href> si l'URL est un http(s) absolu (rel="nofollow") ou un chemin
 *            interne `/…` (sans rel : le maillage interne reste suivi). Sinon le libellé seul est
 *            rendu — jamais `javascript:` / `data:` / `vbscript:` / `//`.
 *   `_x_` n'est PAS une emphase : le soulignement apparaît dans des identifiants (`#LinkGamme_12#`,
 *   références pièce) qu'une emphase corromprait.
 *
 * Déterministe : même entrée → même sortie ; 0 locale, 0 aléatoire, 0 I/O. Coût linéaire
 * (expressions collantes, aucune copie de la chaîne restante par caractère).
 */

/** Échappe les caractères HTML sensibles pour un contexte texte OU valeur d'attribut. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type LinkKind = 'external' | 'internal';

/**
 * Allowlist d'URL des liens rendus : http(s) absolu (hôte non vide) ou chemin interne absolu
 * (`/…`, pas protocole-relatif `//`). Tout caractère d'évasion (guillemets, chevrons, backtick,
 * antislash, blanc) est refusé — un href propre n'en contient jamais.
 */
function classifyHref(url: string): LinkKind | null {
  if (url.length === 0 || /[\s"'`<>\\]/.test(url)) return null;
  if (/^https?:\/\/[^/]/i.test(url)) return 'external';
  if (/^\/(?!\/)/.test(url)) return 'internal';
  return null;
}

const INLINE_CODE = /`([^`]*)`/y;
const INLINE_LINK = /\[([^\]]*)\]\(([^)]*)\)/y;
// Emphase « flanquante » : pas de blanc juste après l'ouvrant ni juste avant le fermant, comme en
// CommonMark — `5 * 3 * 2` reste un calcul, pas une emphase.
const INLINE_STRONG = /\*\*(?!\s)([^*]+)(?<!\s)\*\*/y;
const INLINE_EM = /\*(?!\s)([^*]+)(?<!\s)\*/y;

/** Applique une expression collante à la position `at` ; `null` si elle n'y correspond pas. */
function matchAt(re: RegExp, text: string, at: number): RegExpExecArray | null {
  re.lastIndex = at;
  return re.exec(text);
}

/**
 * Rend le Markdown inline d'un fragment. Scanne de gauche à droite : à chaque position, tente les
 * constructs reconnus dans l'ordre de priorité ; tout caractère non consommé est ÉCHAPPÉ. Un
 * fragment non reconnu ne peut donc produire que du texte échappé.
 */
function renderInline(text: string): string {
  let out = '';
  let i = 0;

  while (i < text.length) {
    const code = matchAt(INLINE_CODE, text, i);
    if (code) {
      out += `<code>${escapeHtml(code[1])}</code>`;
      i += code[0].length;
      continue;
    }

    const link = matchAt(INLINE_LINK, text, i);
    if (link) {
      const [whole, label, url] = link;
      const kind = classifyHref(url);
      const inner = renderInline(label);
      if (kind === 'external') {
        out += `<a href="${escapeHtml(url)}" rel="nofollow">${inner}</a>`;
      } else if (kind === 'internal') {
        out += `<a href="${escapeHtml(url)}">${inner}</a>`;
      } else {
        out += inner;
      }
      i += whole.length;
      continue;
    }

    // **strong** avant *em* (préfixe commun `*`).
    const strong = matchAt(INLINE_STRONG, text, i);
    if (strong) {
      out += `<strong>${renderInline(strong[1])}</strong>`;
      i += strong[0].length;
      continue;
    }

    const em = matchAt(INLINE_EM, text, i);
    if (em) {
      out += `<em>${renderInline(em[1])}</em>`;
      i += em[0].length;
      continue;
    }

    out += escapeHtml(text[i]);
    i += 1;
  }

  return out;
}

const HEADING_3 = /^##\s+(.+?)\s*$/;
const HEADING_4 = /^###\s+(.+?)\s*$/;
const UNORDERED_ITEM = /^[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\d+\.\s+(.*)$/;

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function startsBlock(line: string): boolean {
  return (
    HEADING_3.test(line) ||
    HEADING_4.test(line) ||
    UNORDERED_ITEM.test(line) ||
    ORDERED_ITEM.test(line)
  );
}

/** Consomme les lignes consécutives d'une liste et rend ses items. */
function collectItems(
  lines: readonly string[],
  start: number,
  item: RegExp,
): { html: string; next: number } {
  let html = '';
  let i = start;
  while (i < lines.length) {
    const m = item.exec(lines[i]);
    if (m === null) break;
    html += `<li>${renderInline(m[1])}</li>`;
    i += 1;
  }
  return { html, next: i };
}

/**
 * Rend un fragment Markdown en HTML gouverné. Pure et déterministe.
 * Renvoie `''` pour une entrée vide ou uniquement blanche.
 */
export function renderProjectionMarkdown(md: string): string {
  if (!md) return '';

  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    // `### ` (h4) avant `## ` (h3), préfixe commun.
    const h4 = HEADING_4.exec(line);
    if (h4) {
      blocks.push(`<h4>${renderInline(h4[1])}</h4>`);
      i += 1;
      continue;
    }
    const h3 = HEADING_3.exec(line);
    if (h3) {
      blocks.push(`<h3>${renderInline(h3[1])}</h3>`);
      i += 1;
      continue;
    }

    if (UNORDERED_ITEM.test(line)) {
      const list = collectItems(lines, i, UNORDERED_ITEM);
      blocks.push(`<ul>${list.html}</ul>`);
      i = list.next;
      continue;
    }

    if (ORDERED_ITEM.test(line)) {
      const list = collectItems(lines, i, ORDERED_ITEM);
      blocks.push(`<ol>${list.html}</ol>`);
      i = list.next;
      continue;
    }

    // Paragraphe : lignes consécutives jusqu'à une ligne vide ou un début de bloc.
    const paragraph: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }

  return blocks.join('');
}
