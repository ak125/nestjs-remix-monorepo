#!/usr/bin/env node
/**
 * scripts/registry/build-db-registry.js — Layer 1 producer (DbTableEntry[]).
 *
 * Reads `audit/db-usage-map.json` (produced by
 * `scripts/audit/build-db-usage-map.js`) and enriches each table with the
 * column set that results from REPLAYING `backend/supabase/migrations/*.sql`
 * in runner order (CREATE / DROP / ALTER TABLE, top-level and inside `DO`
 * blocks).
 *
 * WHY A REPLAY (and not one regex per table). The previous implementation
 * matched the FIRST `CREATE TABLE <name> (…);` anywhere in the concatenated SQL
 * (comments and `.down.sql` rollbacks included), cut the body at the first
 * `);`, split on a comma lookahead that ignored strings, and dropped every
 * column its single-line regex could not read. ALTER TABLE was never read.
 * Measured against the live catalog (2026-09-23, 239 tables compared) : the
 * replay brings 680 more real columns and removes the 27 phantom columns the
 * old parser fabricated from CHECK / DEFAULT fragments (`__seo_observable.pour`,
 * `kg_cases.EP6`, …). Columns never declared in any migration (added
 * out-of-band) stay absent : they cannot be derived from the migrations.
 *
 * LEXING. Comments, strings, quoted identifiers and dollar bodies are handled
 * by the shared `lib/sql-lex.js` (`lexViews`) — the SAME lexer as the RPC and
 * db-usage producers, never a local copy. Its two same-length views let every
 * structural decision (statement split, parenthesis depth, keyword search) run
 * on `topLevel` (non-executable regions blanked) while names and types are read
 * at the same offsets from `commentsMasked`.
 *
 * NEVER GUESS. Whatever is not parsed cleanly is REPORTED on stderr (counter +
 * one detail line) and left out — it is never approximated into a column. An
 * ALTER TABLE on a table with no CREATE in the migrations does not create a
 * partial column list.
 *
 * Known, documented limits (reported, not guessed):
 *   - `.down.sql` files are skipped: the migration runner ignores them
 *     (backend/supabase/migrations/README.md).
 *   - DDL inside `DO` blocks is applied unconditionally (IF … THEN guards are not
 *     evaluated); `EXECUTE '…'` / `format(…)` dynamic DDL is invisible (string).
 *   - Function bodies (`CREATE FUNCTION … $$ … $$`) are not executed at migration
 *     time and are ignored.
 *   - `PARTITION OF`, `CREATE TABLE … AS` / `OF type`, `LIKE`, `INHERITS` are
 *     reported, their columns are not synthesised.
 *   - The replay reflects the migrations, not the live database : a migration
 *     that was never applied still contributes (see audit report).
 *
 * Per ADR-058 invariant V1-3 :
 *   - `sourceConfidence: 'high'` when a CREATE TABLE was parsed + RLS info known
 *   - `sourceConfidence: 'medium'` when usage map present but columns missing
 *   - `sourceConfidence: 'low'` when only the table name was inferred
 *   - `status: 'LIVE'` if has callsites OR present in migrations ; `'UNKNOWN'`
 *     otherwise (candidate orphan — never force 'LEGACY').
 *
 * Usage:
 *   node scripts/registry/build-db-registry.js [--quiet]
 *
 * Output: audit/registry/db.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  MONOREPO_ROOT,
  AUDIT_DIR,
  REGISTRY_DIR,
  SCHEMA_VERSION,
  DEFAULT_OWNER,
  DEFAULT_DOMAIN,
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
} = require("./lib/utils");
const { lexViews } = require("./lib/sql-lex");

const log = makeLogger("db");

const MIGRATIONS_DIR = path.join(
  MONOREPO_ROOT,
  "backend",
  "supabase",
  "migrations"
);

// Unqualified names resolve to `public` (Supabase migrations run with the
// default search_path). Only `public` states feed db.json (entries are
// `schema: "public"`).
const DEFAULT_SCHEMA = "public";

// ─── Low-level helpers (pure) ────────────────────────────────────────────────

const IDENT_SRC =
  '(?:"(?:[^"]|"")+"|[A-Za-z_\\u0080-\\uFFFF][A-Za-z0-9_$\\u0080-\\uFFFF]*)';
const QNAME_RE = new RegExp(`\\s*(${IDENT_SRC})(?:\\s*\\.\\s*(${IDENT_SRC}))?`, "y");
const IDENT_RE = new RegExp(`\\s*(${IDENT_SRC})`, "y");

/** PostgreSQL identifier normalisation: quoted → verbatim, unquoted → folded. */
function normIdent(raw) {
  if (raw.startsWith('"')) return raw.slice(1, -1).replace(/""/g, '"');
  return raw.toLowerCase();
}

/** Read `ident` or `schema.ident` at `pos` of the comments-masked view. */
function readQualifiedName(cmt, pos) {
  QNAME_RE.lastIndex = pos;
  const m = QNAME_RE.exec(cmt);
  if (!m) return null;
  if (m[2]) return { schema: normIdent(m[1]), name: normIdent(m[2]), end: QNAME_RE.lastIndex };
  return { schema: null, name: normIdent(m[1]), end: QNAME_RE.lastIndex };
}

function readIdent(cmt, pos) {
  IDENT_RE.lastIndex = pos;
  const m = IDENT_RE.exec(cmt);
  if (!m) return null;
  return { name: normIdent(m[1]), end: IDENT_RE.lastIndex };
}

/**
 * Split `top` (a topLevel-lexed slice: strings/idents/comments blanked) on
 * `delim` at parenthesis depth 0. Returns [start, end) ranges so the caller can
 * slice the parallel comments-masked view at the same offsets.
 */
function splitTopLevelRanges(top, delim) {
  const ranges = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < top.length; i++) {
    const ch = top[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === delim && depth === 0) {
      ranges.push([start, i]);
      start = i + 1;
    }
  }
  ranges.push([start, top.length]);
  return ranges;
}

/** Index of the `)` matching the `(` at `open` in `top`, or -1. */
function matchParen(top, open) {
  let depth = 0;
  for (let i = open; i < top.length; i++) {
    if (top[i] === "(") depth++;
    else if (top[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Blank everything nested inside parentheses (parens kept) — depth-0 view. */
function maskNested(top) {
  let depth = 0;
  let out = "";
  for (const ch of top) {
    if (ch === "(") { out += ch; depth++; continue; }
    if (ch === ")") { out += ch; depth = Math.max(0, depth - 1); continue; }
    out += depth > 0 && ch !== "\n" ? " " : ch;
  }
  return out;
}

// ─── Column definition ───────────────────────────────────────────────────────

const TABLE_CONSTRAINT_RE =
  /^\s*(constraint|primary\s+key|unique|check|foreign\s+key|exclude|like)\b/i;
const COLUMN_CONSTRAINT_KW_RE =
  /\b(constraint|not\s+null|null|default|primary\s+key|unique|check|references|generated|collate)\b/i;
const SERIAL_RE = /^(small|big)?serial[248]?$/i;
// `DEFAULT NULL` (optionally cast) stores NO default in PostgreSQL : a NULL
// constant is not written to pg_attrdef (heap.c, StoreAttrDefault callers).
const NULL_DEFAULT_RE =
  /\bdefault\s+null(?:\s*::\s*[a-z_][\w .]*(?:\([\d\s,]*\))?(?:\s*\[\s*\])*)?\s*(?=$|\b(?:not\s+null|null|constraint|primary\s+key|unique|check|references|generated|collate)\b)/i;

/** Column names of `PRIMARY KEY ( a, "B" )` inside a table constraint, or null. */
function readPkColumns(top, cmt) {
  const m = /\bprimary\s+key\s*\(/i.exec(top);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const close = matchParen(top, open);
  if (close === -1) return null;
  const innerTop = top.slice(open + 1, close);
  const innerCmt = cmt.slice(open + 1, close);
  const cols = [];
  for (const [s, e] of splitTopLevelRanges(innerTop, ",")) {
    const id = readIdent(innerCmt.slice(s, e), 0);
    if (id) cols.push(id.name);
  }
  return cols;
}

/**
 * Parse one element of a CREATE TABLE body / ALTER TABLE ADD.
 * `top` and `cmt` are the parallel lexed slices of that element.
 *
 * Returns one of:
 *   { kind: "column", column }        column = internal state (see toOutput)
 *   { kind: "constraint", pkColumns } table constraint (pkColumns may be null)
 *   { kind: "like" }                  LIKE clause (not synthesised)
 *   { kind: "unparsed", reason, text }
 *   null                              empty element
 */
function parseColumnDef(top, cmt) {
  if (!/\S/.test(top) && !/\S/.test(cmt)) return null;
  const tc = TABLE_CONSTRAINT_RE.exec(top);
  if (tc) {
    if (/^like$/i.test(tc[1])) return { kind: "like" };
    return { kind: "constraint", pkColumns: readPkColumns(top, cmt) };
  }
  const id = readIdent(cmt, 0);
  if (!id) return { kind: "unparsed", reason: "no-column-name", text: squash(cmt) };
  const restTop = maskNested(top.slice(id.end));
  const restCmt = cmt.slice(id.end);
  const kw = COLUMN_CONSTRAINT_KW_RE.exec(restTop);
  const type = squash(kw ? restCmt.slice(0, kw.index) : restCmt);
  if (!type) return { kind: "unparsed", reason: "empty-type", text: squash(cmt) };

  const notNull = /\bnot\s+null\b/i.test(restTop);
  const pk = /\bprimary\s+key\b/i.test(restTop);
  const identity = /\bgenerated\s+(?:always|by\s+default)\s+as\s+identity\b/i.test(restTop);
  const genStored = /\bgenerated\s+always\s+as\s*\(/i.test(restTop);
  const serial = SERIAL_RE.test(type);
  const explicitDefault = (/\bdefault\b/i.test(restTop) && !NULL_DEFAULT_RE.test(restTop)) || serial;
  return {
    kind: "column",
    column: {
      name: id.name,
      type,
      notNull: notNull || pk || identity || serial,
      identity,
      genStored,
      explicitDefault,
    },
  };
}

function squash(s) {
  return s.replace(/\s+/g, " ").trim();
}

function toOutputColumn(c) {
  return {
    name: c.name,
    type: c.type,
    nullable: !c.notNull,
    hasDefault: Boolean(c.explicitDefault || c.identity || c.genStored),
  };
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

function makeDiagnostics() {
  const counts = {};
  const details = [];
  return {
    counts,
    details,
    /** Counted only (expected, harmless: e.g. IF NOT EXISTS no-op). */
    count(category) {
      counts[category] = (counts[category] || 0) + 1;
    },
    /** Counted AND journaled (something was not applied / not parsed). */
    report(category, file, table, text) {
      counts[category] = (counts[category] || 0) + 1;
      details.push({ category, file, table: table || "", text: text ? squash(text).slice(0, 160) : "" });
    },
  };
}

// ─── Replay ──────────────────────────────────────────────────────────────────

const CREATE_RE =
  /^\s*create\s+(?:(?:global|local)\s+)?(?:(temp|temporary|unlogged)\s+)?table\s+(if\s+not\s+exists\s+)?/i;
const ALTER_RE = /^\s*alter\s+table\s+(?:(if\s+exists)\s+)?(?:only\s+)?/i;
const DROP_RE = /^\s*drop\s+table\s+(?:if\s+exists\s+)?/i;
const DDL_ANYWHERE_RE =
  /\b(?:create\s+(?:(?:global|local)\s+)?(?:(?:temp|temporary|unlogged)\s+)?table|alter\s+table|drop\s+table)\b/i;
const DOLLAR_RE = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

const ALTER_NOOP_RE =
  /^\s*(?:enable|disable|force|no\s+force|owner\s+to|set\s*\(|reset\s*\(|replica\s+identity|cluster\s+on|set\s+without|set\s+logged|set\s+unlogged|set\s+tablespace|set\s+access\s+method|validate\s+constraint|inherit|no\s+inherit|attach\s+partition|detach\s+partition|not\s+of|of)\b/i;
const ALTER_COLUMN_NOOP_RE =
  /^\s*(?:set\s+(?:statistics|storage|compression)\b|set\s*\(|reset\s*\(|options\s*\(|set\s+generated\b|restart\b|set\s+(?:increment|start|minvalue|maxvalue|no|cycle|cache)\b)/i;

/** True when an ALTER TABLE action cannot change the column set / attributes. */
function isColumnNeutralAction(cmt) {
  return (
    ALTER_NOOP_RE.test(cmt) ||
    /^\s*(?:drop|alter|rename)\s+constraint\b/i.test(cmt) ||
    /^\s*add\s+(?:constraint|unique|check|foreign\s+key|exclude)\b/i.test(cmt)
  );
}

function keyOf(q) {
  return `${q.schema || DEFAULT_SCHEMA}.${q.name}`;
}

/**
 * Replay migrations in order. `files` = [{ name, sql }] already sorted.
 * Returns { states: Map<"schema.table", {columns: Map}>, everCreated: Set,
 *           dropped: Set, diagnostics }.
 */
function buildTableStates(files) {
  const states = new Map();
  const everCreated = new Set();
  const dropped = new Set();
  const diag = makeDiagnostics();

  for (const file of files) {
    const { topLevel, commentsMasked } = lexViews(file.sql);
    for (const [s, e] of splitTopLevelRanges(topLevel, ";")) {
      processStatement(topLevel.slice(s, e), commentsMasked.slice(s, e), file.name, false);
    }
  }

  function processStatement(top, cmt, fileName, nested) {
    if (!nested && /^\s*do\b/i.test(top)) {
      processDoBlock(cmt, fileName);
      return;
    }
    if (nested) {
      const m = DDL_ANYWHERE_RE.exec(top);
      if (!m) return;
      top = top.slice(m.index);
      cmt = cmt.slice(m.index);
    }
    // Detect on `top` (the keyword is executable code), then take offsets from
    // `cmt`: in `top` a quoted identifier is blanks, which a trailing `\s+`
    // would swallow. Rule for the whole replay: every ANCHORED regex whose
    // match length becomes an offset runs on `cmt`; every SEARCH that must not
    // see strings/identifiers runs on `top`.
    if (CREATE_RE.test(top)) return applyCreate(top, cmt, CREATE_RE.exec(cmt), fileName);
    if (ALTER_RE.test(top)) return applyAlter(top, cmt, ALTER_RE.exec(cmt), fileName);
    if (DROP_RE.test(top)) return applyDrop(cmt, DROP_RE.exec(cmt), fileName);
  }

  function processDoBlock(cmt, fileName) {
    const open = DOLLAR_RE.exec(cmt);
    if (!open) {
      diag.report("do-block-without-dollar-body", fileName, "", cmt);
      return;
    }
    const bodyStart = open.index + open[0].length;
    const close = cmt.indexOf(open[0], bodyStart);
    if (close === -1) {
      diag.report("do-block-unterminated", fileName, "", cmt.slice(0, 120));
      return;
    }
    // Re-lex the body: comments INSIDE a dollar body are not masked by the
    // outer pass, and `EXECUTE '…'` dynamic DDL must stay invisible.
    const body = lexViews(cmt.slice(bodyStart, close));
    for (const [s, e] of splitTopLevelRanges(body.topLevel, ";")) {
      processStatement(body.topLevel.slice(s, e), body.commentsMasked.slice(s, e), fileName, true);
    }
  }

  function applyCreate(top, cmt, m, fileName) {
    const q = readQualifiedName(cmt, m[0].length);
    if (!q) {
      diag.report("create-unparsed-name", fileName, "", cmt.slice(0, 120));
      return;
    }
    const key = keyOf(q);
    if (m[1] && /^temp/i.test(m[1])) {
      diag.count("create-temp-skipped");
      return;
    }
    const restTop = top.slice(q.end);
    if (/^\s*partition\s+of\b/i.test(restTop)) {
      diag.report("create-partition-of-skipped", fileName, key);
      return;
    }
    const openRel = restTop.search(/\S/);
    if (openRel === -1 || restTop[openRel] !== "(") {
      diag.report("create-as-or-typed-not-parsed", fileName, key, restTop.slice(0, 60));
      return;
    }
    const open = q.end + openRel;
    const close = matchParen(top, open);
    if (close === -1) {
      diag.report("create-unbalanced-body", fileName, key);
      return;
    }
    if (/\binherits\b/i.test(top.slice(close + 1))) {
      diag.report("create-inherits-columns-not-included", fileName, key);
    }
    if (states.has(key)) {
      if (m[2]) {
        diag.count("create-if-not-exists-noop");
        return;
      }
      diag.report("create-over-existing-state", fileName, key);
    }
    const columns = new Map();
    const pkCols = [];
    const bodyTop = top.slice(open + 1, close);
    const bodyCmt = cmt.slice(open + 1, close);
    for (const [s, e] of splitTopLevelRanges(bodyTop, ",")) {
      const r = parseColumnDef(bodyTop.slice(s, e), bodyCmt.slice(s, e));
      if (!r) continue;
      if (r.kind === "column") {
        if (columns.has(r.column.name)) diag.report("create-duplicate-column", fileName, key, r.column.name);
        columns.set(r.column.name, r.column);
      } else if (r.kind === "constraint") {
        if (r.pkColumns) pkCols.push(...r.pkColumns);
      } else if (r.kind === "like") {
        diag.report("create-like-not-synthesised", fileName, key, bodyCmt.slice(s, e));
      } else {
        diag.report(`column-${r.reason}`, fileName, key, r.text);
      }
    }
    for (const c of pkCols) {
      if (columns.has(c)) columns.get(c).notNull = true;
      else diag.report("pk-column-not-found", fileName, key, c);
    }
    states.set(key, { columns });
    everCreated.add(key);
    dropped.delete(key);
  }

  function applyDrop(cmt, m, fileName) {
    let pos = m[0].length;
    for (;;) {
      const q = readQualifiedName(cmt, pos);
      if (!q) break;
      const key = keyOf(q);
      if (states.has(key)) {
        states.delete(key);
        dropped.add(key);
      } else {
        diag.count("drop-without-state");
      }
      pos = q.end;
      const comma = /^\s*,/.exec(cmt.slice(pos));
      if (!comma) break;
      pos += comma[0].length;
    }
  }

  function applyAlter(top, cmt, m, fileName) {
    const q = readQualifiedName(cmt, m[0].length);
    if (!q) {
      diag.report("alter-unparsed-name", fileName, "", cmt.slice(0, 120));
      return;
    }
    const key = keyOf(q);
    let pos = q.end;
    const star = /^\s*\*/.exec(top.slice(pos));
    if (star) pos += star[0].length;
    const restTop = top.slice(pos);
    const restCmt = cmt.slice(pos);
    const st = states.get(key);

    let r;
    if ((r = /^\s*rename\s+to\s+/i.exec(restCmt))) {
      const to = readIdent(restCmt, r[0].length);
      if (!st || !to) {
        diag.report("alter-rename-table-without-state", fileName, key);
        return;
      }
      const newKey = `${q.schema || DEFAULT_SCHEMA}.${to.name}`;
      states.delete(key);
      states.set(newKey, st);
      everCreated.add(newKey);
      dropped.delete(newKey);
      return;
    }
    if (/^\s*rename\s+constraint\b/i.test(restTop)) {
      diag.count("alter-noop");
      return;
    }
    if ((r = /^\s*set\s+schema\s+/i.exec(restCmt))) {
      const to = readIdent(restCmt, r[0].length);
      if (!st || !to) {
        diag.report("alter-set-schema-without-state", fileName, key);
        return;
      }
      states.delete(key);
      states.set(`${to.name}.${q.name}`, st);
      return;
    }
    if (!st) {
      // No CREATE in the migrations (table predates them, or is created by
      // dynamic SQL): never invent a partial column list. Only journal the
      // ALTERs that would have changed columns.
      const touchesColumns = splitTopLevelRanges(restTop, ",").some(
        ([s, e]) => !isColumnNeutralAction(restCmt.slice(s, e))
      );
      if (touchesColumns) diag.report("alter-without-create", fileName, key, restCmt);
      else diag.count("alter-without-create-column-neutral");
      return;
    }
    if ((r = /^\s*rename\s+(?:column\s+)?/i.exec(restCmt))) {
      const from = readIdent(restCmt, r[0].length);
      const toKw = from && /^\s*to\s+/i.exec(restCmt.slice(from.end));
      const to = toKw && readIdent(restCmt, from.end + toKw[0].length);
      if (!from || !to) {
        diag.report("alter-rename-column-unparsed", fileName, key, restCmt);
        return;
      }
      if (!st.columns.has(from.name)) {
        diag.report("alter-rename-missing-column", fileName, key, from.name);
        return;
      }
      const renamed = new Map();
      for (const [n, c] of st.columns) {
        if (n === from.name) renamed.set(to.name, { ...c, name: to.name });
        else renamed.set(n, c);
      }
      st.columns = renamed;
      return;
    }
    for (const [s, e] of splitTopLevelRanges(restTop, ",")) {
      applyAlterAction(st, key, restTop.slice(s, e), restCmt.slice(s, e), fileName);
    }
  }

  function applyAlterAction(st, key, top, cmt, fileName) {
    let r;
    if ((r = /^\s*add\s+/i.exec(cmt))) {
      let pos = r[0].length;
      if (/^(?:constraint|primary\s+key|unique|check|foreign\s+key|exclude)\b/i.test(cmt.slice(pos))) {
        const c = parseColumnDef(top.slice(pos), cmt.slice(pos));
        if (/\bprimary\s+key\b/i.test(top) && !(c && c.pkColumns)) {
          diag.report("alter-add-pk-columns-unknown", fileName, key, cmt);
          return;
        }
        for (const col of (c && c.pkColumns) || []) {
          if (st.columns.has(col)) st.columns.get(col).notNull = true;
          else diag.report("pk-column-not-found", fileName, key, col);
        }
        return;
      }
      const colKw = /^column\s+/i.exec(cmt.slice(pos));
      if (colKw) pos += colKw[0].length;
      const ine = /^if\s+not\s+exists\s+/i.exec(cmt.slice(pos));
      if (ine) pos += ine[0].length;
      const res = parseColumnDef(top.slice(pos), cmt.slice(pos));
      if (!res || res.kind !== "column") {
        diag.report(`alter-add-${res ? res.reason || res.kind : "empty"}`, fileName, key, cmt);
        return;
      }
      if (st.columns.has(res.column.name)) {
        if (ine) diag.count("alter-add-if-not-exists-noop");
        else diag.report("alter-add-existing-column-kept", fileName, key, res.column.name);
        return;
      }
      st.columns.set(res.column.name, res.column);
      return;
    }
    if (/^\s*drop\s+constraint\b/i.test(cmt)) {
      diag.count("alter-noop");
      return;
    }
    if ((r = /^\s*drop\s+(?:column\s+)?(if\s+exists\s+)?/i.exec(cmt))) {
      const col = readIdent(cmt, r[0].length);
      if (!col) {
        diag.report("alter-drop-column-unparsed", fileName, key, cmt);
        return;
      }
      if (st.columns.has(col.name)) st.columns.delete(col.name);
      else if (r[1]) diag.count("alter-drop-if-exists-noop");
      else diag.report("alter-drop-missing-column", fileName, key, col.name);
      return;
    }
    if (/^\s*alter\s+constraint\b/i.test(cmt)) {
      diag.count("alter-noop");
      return;
    }
    if ((r = /^\s*alter\s+(?:column\s+)?/i.exec(cmt))) {
      const col = readIdent(cmt, r[0].length);
      if (!col) {
        diag.report("alter-column-unparsed", fileName, key, cmt);
        return;
      }
      const c = st.columns.get(col.name);
      if (!c) {
        diag.report("alter-column-missing", fileName, key, col.name);
        return;
      }
      const subTop = top.slice(col.end);
      const subCmt = cmt.slice(col.end);
      let t;
      if ((t = /^\s*(?:set\s+data\s+)?type\s+/i.exec(subCmt))) {
        const tTop = maskNested(subTop.slice(t[0].length));
        const tCmt = subCmt.slice(t[0].length);
        const end = /\b(?:using|collate)\b/i.exec(tTop);
        const type = squash(end ? tCmt.slice(0, end.index) : tCmt);
        if (!type) diag.report("alter-column-type-empty", fileName, key, col.name);
        else c.type = type;
      } else if (/^\s*set\s+not\s+null\b/i.test(subTop)) c.notNull = true;
      else if (/^\s*drop\s+not\s+null\b/i.test(subTop)) c.notNull = false;
      else if (/^\s*set\s+default\b/i.test(subTop)) c.explicitDefault = !NULL_DEFAULT_RE.test(subTop.replace(/^\s*set\s+/i, ""));
      else if (/^\s*drop\s+default\b/i.test(subTop)) c.explicitDefault = false;
      else if (/^\s*add\s+generated\b[\s\S]*\bas\s+identity\b/i.test(subTop)) {
        c.identity = true;
        c.notNull = true;
      } else if (/^\s*drop\s+identity\b/i.test(subTop)) c.identity = false;
      else if (/^\s*drop\s+expression\b/i.test(subTop)) c.genStored = false;
      else if (ALTER_COLUMN_NOOP_RE.test(subTop)) diag.count("alter-noop");
      else diag.report("alter-column-action-unknown", fileName, key, cmt);
      return;
    }
    if (ALTER_NOOP_RE.test(cmt)) {
      diag.count("alter-noop");
      return;
    }
    diag.report("alter-action-unknown", fileName, key, cmt);
  }

  return { states, everCreated, dropped, diagnostics: diag };
}

// ─── I/O ─────────────────────────────────────────────────────────────────────

/**
 * Migration files in runner order. `.down.sql` rollbacks are EXCLUDED — the
 * runner ignores them (backend/supabase/migrations/README.md); replaying them
 * would drop real tables.
 */
function loadMigrations(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(dir, f), "utf8") }));
}

/** Resolve the final public-schema state of a usage-map table name. */
function lookupKey(tableName) {
  return [`${DEFAULT_SCHEMA}.${tableName}`, `${DEFAULT_SCHEMA}.${tableName.toLowerCase()}`];
}

/** Pure: usage map + replay → DbTableEntry[] (unsorted) + diagnostics. */
function buildEntries(usageMap, files) {
  const replay = buildTableStates(files);
  const { states, everCreated, dropped, diagnostics } = replay;
  const tables = usageMap.tables || {};
  const entries = [];

  for (const [tableName, info] of Object.entries(tables)) {
    const keys = lookupKey(tableName);
    const key = keys.find((k) => states.has(k)) || keys.find((k) => everCreated.has(k));
    const parsed = Boolean(key && everCreated.has(key));
    const state = key ? states.get(key) : undefined;
    if (!state && key && dropped.has(key)) {
      diagnostics.report("table-dropped-at-end-of-replay", "", key);
    }
    const columns = state ? [...state.columns.values()].map(toOutputColumn) : [];

    const hasUsage = (info.used_by_count || 0) > 0;
    const hasMigrations = Array.isArray(info.in_migrations) && info.in_migrations.length > 0;

    let sourceConfidence = "low";
    if (parsed && info.rls_present !== undefined) sourceConfidence = "high";
    else if (parsed || hasMigrations) sourceConfidence = "medium";

    const status = hasUsage || hasMigrations ? "LIVE" : "UNKNOWN";

    entries.push({
      schemaVersion: SCHEMA_VERSION,
      id: tableName,
      name: tableName,
      schema: "public",
      domain: DEFAULT_DOMAIN, // PR-D overlay resolves
      status,
      owner: DEFAULT_OWNER,
      sourceConfidence,
      columns,
      indexes: [], // V1.5 : parse CREATE INDEX
      rlsEnabled: Boolean(info.rls_present),
      usedBy: Array.isArray(info.used_by) ? [...info.used_by].sort() : [],
      inMigrations: Array.isArray(info.in_migrations) ? [...info.in_migrations].sort() : [],
      deletePolicy: tableName.startsWith("__seo_") || tableName.startsWith("__diag_") || tableName.startsWith("kg_")
        ? "ADR_REQUIRED"
        : "FREE",
      risk: "low",
    });
  }
  return { entries, diagnostics };
}

function main() {
  const usageMap = readJsonSafe(path.join(AUDIT_DIR, "db-usage-map.json"));
  if (!usageMap) {
    throw new Error(
      `audit/db-usage-map.json absent. Run \`npm run audit:db-usage\` first.`
    );
  }

  const files = loadMigrations();
  const { entries, diagnostics } = buildEntries(usageMap, files);

  log(`replayed ${files.length} migrations (.down.sql excluded)`);
  for (const cat of Object.keys(diagnostics.counts).sort()) {
    log(`  ${cat}: ${diagnostics.counts[cat]}`);
  }
  for (const d of diagnostics.details) {
    log(`  [${d.category}] ${d.file} ${d.table} ${d.text}`.trimEnd());
  }
  log(`processed ${entries.length} tables`);

  const output = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-db-registry.js",
    entries: sortById(entries),
  };

  const outPath = path.join(REGISTRY_DIR, "db.json");
  const sha = writeDeterministicJson(outPath, output);
  log(`wrote ${outPath} (${entries.length} entries, sha256:${sha.slice(0, 12)})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/db] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  main,
  buildEntries,
  buildTableStates,
  loadMigrations,
  parseColumnDef,
  splitTopLevelRanges,
  maskNested,
  normIdent,
};
