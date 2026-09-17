#!/usr/bin/env node
/**
 * scripts/registry/lib/sql-lex.js — région-lexer PostgreSQL partagé par les
 * producteurs qui scannent `backend/supabase/migrations/**`.
 *
 * POURQUOI. Appliquer une regex au SQL BRUT confond la documentation et le DDL.
 * Mesuré sur ce dépôt avant extraction :
 *   - 20 `DROP TABLE` en commentaire (procédures de rollback explicitement
 *     annotées « NON exécuté par ce fichier ») effaçaient 9 tables RÉELLES de
 *     `audit/db-usage-map.json` — dont tout le système `__seo_r8_*` — et
 *     5 fonctions, dont `__rls_lock_internal_table`,
 *     `__rls_reconcile_internal_tables` et `refresh_seo_projection_mvs`
 *     (SECURITY DEFINER, ADR-059 PR6c).
 *   - un `CREATE TABLE` cité dans un commentaire français produisait la table
 *     fantôme `sont`, listée dans `candidate_orphan_tables`.
 *   - un `CREATE OR REPLACE FUNCTION` commenté fabriquait la surcharge fantôme
 *     `public.pricing_commit_chunk#sig:e0a855c1` dans `audit/registry/rpc.json`.
 *
 * PROVENANCE. `lexViews` et `maskComments` sont repris VERBATIM de la PR #1227
 * (« top-level-only RPC scanner », branche `codex/rpc-parser-toplevel-only`),
 * où ils vivaient inline dans `build-rpc-registry.js` et restaient donc
 * inutilisables par les autres producteurs. Extraits ici pour être partagés,
 * conformément à l'invariant 2 de CLAUDE.md (« étendre AVANT créer ») : ceci est
 * une ADOPTION, pas une réécriture. La limitation qu'ils corrigent était déjà
 * documentée dans `tests/registry/fixtures/rpc-edge-cases.sql` :
 * « The current parser doesn't strip SQL comments […] V1.5+ : strip comments
 * before parsing. »
 *
 * DÉTERMINISME (ADR-058 invariant V1-2). Pur JS, une seule passe avant, aucune
 * dépendance, aucune résolution de module, aucun binaire natif : la sortie ne
 * dépend ni de la machine ni de l'état de `node_modules`. Ces producteurs
 * tournent en pre-commit ET en CI — cf. le refus explicite de `localeCompare()`
 * dans `scripts/audit/build-db-usage-map.js` pour la même raison.
 *
 * INVARIANT CENTRAL. Les deux vues rendues ont la MÊME longueur que l'entrée :
 * un offset trouvé dans l'une indexe le même octet dans l'autre et dans le SQL
 * d'origine. Les numéros de ligne des artefacts restent donc exacts.
 */
"use strict";

// PostgreSQL identifier rules (Unicode-aware). Used both for `E'…'` escape-string
// detection (an identifier ending in `e`/`E` is not a string prefix) and for the
// dollar-quote boundary (so `amount$rate` is ONE identifier, not a `$…$` body open).
const isIdentStart = (c) => c !== undefined && (c === "_" || /\p{L}/u.test(c));
const isIdentCont = (c) => c !== undefined && (isIdentStart(c) || /[0-9$]/.test(c));
// A `$…$` dollar-quote opener: `$$` or `$tag$` with an identifier-shaped tag.
const DOLLAR_OPEN_RE = /^\$([\p{L}_][\p{L}0-9_]*)?\$/u;

// Single forward SQL pass → TWO same-length views with byte-identical offsets.
//
//   topLevel — every NON-executable region (line/block comment, string literal,
//     E-string, double-quoted identifier, dollar-quoted body) replaced by spaces
//     (newlines preserved). Used to DETECT top-level `CREATE [OR REPLACE] FUNCTION`
//     keywords: only those surviving in real executable code are real functions —
//     never inside a comment, string, dynamic-SQL body or quoted identifier.
//
//   commentsMasked — only COMMENTS are blanked; strings, dollar bodies and quoted
//     identifiers are preserved verbatim. Fed to parseFunctionBlock so an inline
//     comment can NEVER leak into an argument type and fabricate a spurious `#sig:`
//     overload, while a genuinely quoted type/name still parses. Invariant: the same
//     PostgreSQL signature written with or without inline comments yields identical
//     args → identical sigHash → ONE registry signature.
//
// One block offset found in `topLevel` indexes the SAME byte in `commentsMasked`.
// Handles: line comments (`-- … \n`), NESTED block comments (`/* … /* … */ … */`),
// single-quoted strings (`'…''…'`), E-escape strings (`E'… \' … ''…'`), double-quoted
// identifiers (`"…""…"`) and dollar-quoted bodies (`$$…$$`, `$tag$…$tag$`).
function lexViews(sql) {
  const n = sql.length;
  const top = new Array(n); // detection view — non-executable regions blanked
  const cmt = new Array(n); // parsing view — only comments blanked
  const blank = (ch) => (ch === "\n" ? "\n" : " ");
  const code = (i, ch) => { top[i] = ch; cmt[i] = ch; };            // executable
  const comment = (i, ch) => { top[i] = blank(ch); cmt[i] = blank(ch); }; // comment
  const strlit = (i, ch) => { top[i] = blank(ch); cmt[i] = ch; };   // string / body / ident

  let i = 0;
  while (i < n) {
    const ch = sql[i];
    const two = ch + (sql[i + 1] || "");

    // line comment → both views blanked to end of line (newline preserved)
    if (two === "--") {
      while (i < n && sql[i] !== "\n") { comment(i, sql[i]); i++; }
      continue;
    }

    // block comment (nested-aware) → both views blanked
    if (two === "/*") {
      let depth = 0;
      while (i < n) {
        const t = sql[i] + (sql[i + 1] || "");
        if (t === "/*") { comment(i, sql[i]); comment(i + 1, sql[i + 1]); i += 2; depth++; continue; }
        if (t === "*/") { comment(i, sql[i]); comment(i + 1, sql[i + 1]); i += 2; depth--; if (depth === 0) break; continue; }
        comment(i, sql[i]); i++;
      }
      continue;
    }

    // single-quoted string, or E'…' escape string — code in `commentsMasked`, blank in `topLevel`
    if (ch === "'" || ((ch === "E" || ch === "e") && sql[i + 1] === "'" && !isIdentCont(sql[i - 1]))) {
      const isE = ch !== "'";
      if (isE) { code(i, ch); i += 1; } // the E prefix is executable code
      strlit(i, sql[i]); i += 1;        // opening quote
      while (i < n) {
        const c = sql[i];
        if (isE && c === "\\") { strlit(i, c); if (i + 1 < n) strlit(i + 1, sql[i + 1]); i += 2; continue; } // backslash escape (E only)
        if (c === "'") {
          if (sql[i + 1] === "'") { strlit(i, c); strlit(i + 1, sql[i + 1]); i += 2; continue; } // doubled '' escape
          strlit(i, c); i += 1;
          break;
        }
        strlit(i, c); i += 1;
      }
      continue;
    }

    // double-quoted identifier — preserved in `commentsMasked`, blanked in `topLevel`
    if (ch === '"') {
      strlit(i, ch); i += 1;
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { strlit(i, sql[i]); strlit(i + 1, sql[i + 1]); i += 2; continue; } // doubled "" escape
          strlit(i, sql[i]); i += 1;
          break;
        }
        strlit(i, sql[i]); i += 1;
      }
      continue;
    }

    // dollar-quoted body — only when `$` opens an identifier boundary (`amount$rate` is code)
    if (ch === "$" && !isIdentCont(sql[i - 1])) {
      const dm = DOLLAR_OPEN_RE.exec(sql.slice(i, i + 128));
      if (dm) {
        const tag = dm[0];
        for (let k = 0; k < tag.length; k++) strlit(i + k, sql[i + k]);
        i += tag.length;
        const end = sql.indexOf(tag, i);
        const bodyEnd = end === -1 ? n : end;
        while (i < bodyEnd) { strlit(i, sql[i]); i += 1; }
        if (end !== -1) { for (let k = 0; k < tag.length; k++) strlit(i + k, sql[i + k]); i += tag.length; }
        continue;
      }
    }

    // executable code — identical in both views
    code(i, ch); i += 1;
  }
  return { topLevel: top.join(""), commentsMasked: cmt.join("") };
}

// Comment-masked view of `sql` (comments → spaces, offsets preserved). Feed THIS to
// parseFunctionBlock so comments cannot enter argument types / sigHash.
function maskComments(sql) {
  return lexViews(sql).commentsMasked;
}

module.exports = {
  lexViews,
  maskComments,
};
