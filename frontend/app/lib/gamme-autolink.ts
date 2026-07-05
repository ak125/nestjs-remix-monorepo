/**
 * Auto-linking of related "gamme" keywords inside editorial HTML.
 *
 * Extracted from the byte-identical `addGammeLinksToHtml` / `addGammeLinksToText`
 * that were duplicated in `ConseilsSection.tsx` and `InformationsSection.tsx`.
 *
 * WHY THIS EXISTS (Sentry PROD crash, iOS < 16.4)
 * ------------------------------------------------
 * The old code built, per keyword, a `new RegExp(...)` whose pattern began with a
 * negative LOOKBEHIND against an opening `<a …>` tag (and ended with a lookahead
 * against `</a>`). Regex lookbehind is unsupported by JavaScriptCore before
 * Safari 16.4. On iOS 16.0–16.3 the RegExp constructor throws "Invalid regular
 * expression: invalid group specifier name", crashing the catalog pages (these
 * functions run inside `useMemo`, re-executed on every client hydration /
 * re-render as soon as `catalogueFamille` is non-empty).
 *
 * THE APPROACH (no lookaround, SSR-safe)
 * --------------------------------------
 * Never reason about anchors with a regex. Tokenize the HTML losslessly into
 * tag / comment / text runs, then only link inside text runs that sit OUTSIDE
 * any `<a>…</a>` (and outside `script`/`style`/`textarea` raw text). The runtime
 * regex shrinks to a plain `\b(escaped)\b` — no lookbehind, no lookahead — so it
 * is safe on every iOS version. Pure string processing: identical output under
 * SSR (Node, no DOMParser) and client hydration.
 *
 * BEHAVIOUR PARITY
 * ----------------
 * Same gamme dedupe, URL resolution, pattern order, case-insensitivity, and the
 * same GLOBAL wrapping of every occurrence of the winning pattern (the old code
 * used a global `String.replace`; we keep that to avoid a silent change to
 * internal-link density on the catalog pages). It is strictly MORE correct in
 * the edge cases the old lookahead could not handle — a keyword before a nested
 * `<b>`/`<em>` inside an anchor, or a keyword inside a tag attribute — which the
 * old regex could wrap into invalid/broken markup and this one never does.
 */

/** Minimal shape needed to build a gamme link (structurally satisfied by the
 *  callers' local `CatalogueItem`). */
export interface GammeLink {
  id?: number;
  name: string;
  alias?: string;
  link?: string;
}

type Token = { type: "tag" | "text" | "comment"; value: string };

/** Raw-text elements whose content must never be linked into. */
const RAW_TEXT_TAGS = new Set(["script", "style", "textarea"]);

/** A gamme name is a short product-family label. Anything longer is bad data and
 *  is skipped: a >= 2^15-char regex source throws "regular expression too large"
 *  in V8 — the same crash class this file removes. 512 is far above any real name. */
const MAX_PATTERN_LEN = 512;

/** HTML5: "<" only begins a tag/comment/declaration when followed by an ASCII
 *  letter, "/", "!" or "?". Otherwise (e.g. "< 90°C", "<3mm") the "<" is literal
 *  text — a browser renders it verbatim, so the tokenizer must too. */
function startsTag(html: string, i: number): boolean {
  const next = html[i + 1];
  return next !== undefined && /[a-zA-Z!/?]/.test(next);
}

/** Escape a string for safe literal use inside a RegExp (identical to the old escaping). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escape a value interpolated into a double-quoted HTML attribute (breakout-safe). */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Lossless HTML tokenizer. Guarantee: `tokenizeHtml(h).map(t => t.value).join("") === h`
 * for any input (including malformed markup, which is swallowed into inert
 * tag/comment tokens rather than injected into).
 */
function tokenizeHtml(html: string): Token[] {
  const tokens: Token[] = [];
  const n = html.length;
  let i = 0;
  let textStart = 0;
  while (i < n) {
    if (html[i] === "<" && startsTag(html, i)) {
      if (i > textStart) {
        tokens.push({ type: "text", value: html.slice(textStart, i) });
      }
      if (html.startsWith("<!--", i)) {
        // Comment may legally contain ">"; end at "-->" (or EOF if truncated).
        const end = html.indexOf("-->", i + 4);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ type: "comment", value: html.slice(i, stop) });
        i = stop;
        textStart = i;
        continue;
      }
      // Consume up to the first UNQUOTED ">" so a ">" inside an attribute value
      // (e.g. <img alt="a>b">) does not close the tag early.
      let j = i + 1;
      let quote: '"' | "'" | null = null;
      while (j < n) {
        const c = html[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") {
          quote = c;
        } else if (c === ">") {
          break;
        }
        j++;
      }
      const stop = j < n ? j + 1 : n; // include ">"; else swallow malformed tail to EOF
      tokens.push({ type: "tag", value: html.slice(i, stop) });
      i = stop;
      textStart = i;
      continue;
    }
    i++;
  }
  if (textStart < n) {
    tokens.push({ type: "text", value: html.slice(textStart) });
  }
  return tokens;
}

function tagInfo(tag: string): { name: string; isClose: boolean } {
  const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
  if (!m) return { name: "", isClose: false };
  return { name: m[2].toLowerCase(), isClose: m[1] === "/" };
}

/**
 * Replace every occurrence of `matcher` inside each LINKABLE text run (outside
 * any anchor / raw-text element) with `buildAnchor(match)`. Returns the new HTML
 * and the number of replacements — mirrors the old global `String.replace`, but
 * anchor-aware via depth tracking instead of a (crashing) lookbehind.
 */
function linkLinkableRuns(
  html: string,
  matcher: RegExp, // /\b(escaped)\b/gi — global, case-insensitive, no lookaround
  buildAnchor: (matchedText: string) => string,
): { html: string; count: number } {
  const tokens = tokenizeHtml(html);
  let anchorDepth = 0;
  let rawTextDepth = 0;
  let count = 0;
  // Defined once (not per-iteration) so the replace callback closes over `count`
  // in a single scope — avoids no-loop-func and is invoked synchronously.
  const wrap = (match: string): string => {
    count++;
    return buildAnchor(match);
  };
  for (const tok of tokens) {
    if (tok.type === "tag") {
      const info = tagInfo(tok.value);
      // HTML5 ignores a trailing "/" on non-void elements, so an `<a …/>` start
      // tag still OPENS an anchor (there is no self-closing <a>). Depth is driven
      // purely by open vs close — never by a trailing slash.
      if (info.name === "a") {
        anchorDepth = info.isClose
          ? Math.max(0, anchorDepth - 1)
          : anchorDepth + 1;
      } else if (RAW_TEXT_TAGS.has(info.name)) {
        rawTextDepth = info.isClose
          ? Math.max(0, rawTextDepth - 1)
          : rawTextDepth + 1;
      }
      continue;
    }
    if (tok.type === "comment") continue;
    if (anchorDepth > 0 || rawTextDepth > 0) continue; // not linkable
    tok.value = tok.value.replace(matcher, wrap);
  }
  return { html: tokens.map((t) => t.value).join(""), count };
}

/**
 * Wrap related gamme keywords in `<a>` links inside an editorial HTML fragment.
 *
 * @param html the editorial HTML fragment
 * @param catalogueFamille related gammes to link (deduped by `name`)
 * @param linkClassName Tailwind classes for the injected `<a>` — the ONLY thing
 *   that differed between the two original call sites
 */
export function addGammeLinks(
  html: string,
  catalogueFamille: GammeLink[] | undefined,
  linkClassName: string,
): string {
  if (!html || typeof html !== "string") return html;
  if (!Array.isArray(catalogueFamille) || catalogueFamille.length === 0) {
    return html;
  }

  const uniqueGammes = catalogueFamille.filter(
    (gamme, index, self) =>
      index === self.findIndex((g) => g.name === gamme.name),
  );

  let result = html;
  const linkedGammes = new Set<string>();

  for (const gamme of uniqueGammes) {
    if (!gamme || !gamme.name) continue;
    if (linkedGammes.has(gamme.name)) continue;

    const gammeUrl =
      gamme.link ||
      (gamme.alias && gamme.id
        ? `/pieces/${gamme.alias}-${gamme.id}.html`
        : null);
    if (!gammeUrl) continue;

    const name = gamme.name.toLowerCase();
    // Pattern order preserved verbatim from the original (do not "tidy" — the
    // order decides which variant gets linked). `.replace("é","e")` deaccents
    // only the first "é" on purpose, for parity.
    const patterns = [
      name,
      name + "s",
      name.replace("é", "e"),
      (name + "s").replace("é", "e"),
    ];

    const href = escapeAttr(gammeUrl);
    const title = escapeAttr(`Voir nos ${gamme.name}`);
    const buildAnchor = (match: string) =>
      `<a href="${href}" class="${linkClassName}" title="${title}">${match}</a>`;

    for (const pattern of patterns) {
      if (!pattern || pattern.length > MAX_PATTERN_LEN) continue;
      const matcher = new RegExp(`\\b(${escapeRegExp(pattern)})\\b`, "gi");
      const outcome = linkLinkableRuns(result, matcher, buildAnchor);
      if (outcome.count > 0) {
        result = outcome.html;
        linkedGammes.add(gamme.name);
        break; // first winning pattern only; move to next gamme
      }
    }
  }

  return result;
}
