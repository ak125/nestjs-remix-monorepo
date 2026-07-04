#!/usr/bin/env node
/**
 * scripts/registry/build-rpc-registry.js — Layer 1 producer (RpcEntry[]).
 *
 * Robust SQL parser over `backend/supabase/migrations/*.sql` extracting
 * `CREATE FUNCTION` / `CREATE OR REPLACE FUNCTION` signatures and emitting
 * RpcEntry records.
 *
 * Per ADR-058 invariant V1-3 "Classification jamais forcée", parser uses 3
 * modes (never throws) :
 *
 *   - `parsed`             → `sourceConfidence: 'high'` : name + args (typed)
 *                            + return type + LANGUAGE all extracted
 *   - `partially_parsed`   → `sourceConfidence: 'medium'` : name + args extracted
 *                            but RETURNS or LANGUAGE missing/ambiguous ;
 *                            entry carries `parseWarnings[]`
 *   - `unknown_signature`  → `sourceConfidence: 'low'` + `status: 'UNKNOWN'` :
 *                            CREATE FUNCTION keyword detected but regex fails ;
 *                            entry carries `parseError`
 *
 * Edge cases handled explicitly :
 *   - `CREATE OR REPLACE FUNCTION`
 *   - `SECURITY DEFINER` / `SECURITY INVOKER`
 *   - Overloaded functions (same name, different args → multiple entries with
 *     disambiguator suffix `#sig:<hash>` in id)
 *   - `SET search_path = ...`
 *   - Quoted identifiers `"my_func"`
 *   - Extension functions (`pgcrypto.*`, `vault.*`) → `kind: 'extension'`,
 *     `status: 'ARCHIVED'` (not part of monorepo runtime)
 *   - `DROP FUNCTION` (we ignore — function removed from this migration set)
 *
 * Cross-referenced with `audit/db-usage-map.json#rpc_with_callsites` to
 * populate `usedBy[]`.
 *
 * Usage:
 *   node scripts/registry/build-rpc-registry.js [--quiet] [--migrations-dir <dir>]
 *
 * Output: audit/registry/rpc.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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

const log = makeLogger("rpc");

const DEFAULT_MIGRATIONS_DIR = path.join(
  MONOREPO_ROOT,
  "backend",
  "supabase",
  "migrations"
);

// Extension prefixes we recognize and mark as kind: extension
const EXTENSION_SCHEMAS = new Set([
  "pgcrypto",
  "vault",
  "extensions",
  "graphql",
  "pgsodium",
  "supabase_functions",
]);

/**
 * Parse a CREATE FUNCTION block starting at index `start` in `sql`.
 * Returns a structured record or null if not a function.
 *
 * Strategy : we work from `CREATE FUNCTION` keyword forward, with regex
 * captures bounded by major clause keywords (RETURNS, LANGUAGE, AS, $$).
 */
function parseFunctionBlock(sql, start) {
  // Match the function header up to "(" : "CREATE [OR REPLACE] FUNCTION [schema.]name"
  const headerRe = /^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:(["'\w]+)\.)?(["'\w]+)\s*\(/i;
  const sub = sql.slice(start);
  const headerMatch = sub.match(headerRe);
  if (!headerMatch) return null;

  const schemaName = (headerMatch[1] || "public").replace(/["']/g, "");
  const funcName = headerMatch[2].replace(/["']/g, "");

  // Find matching closing paren for args
  const argsStart = start + headerMatch[0].length - 1; // pointing at '('
  let depth = 0;
  let argsEnd = -1;
  for (let i = argsStart; i < sql.length; i++) {
    if (sql[i] === "(") depth++;
    else if (sql[i] === ")") {
      depth--;
      if (depth === 0) {
        argsEnd = i;
        break;
      }
    }
  }
  if (argsEnd < 0) {
    return {
      parseMode: "unknown_signature",
      schemaName,
      funcName,
      parseError: "Could not find closing paren for args",
    };
  }
  const argsRaw = sql.slice(argsStart + 1, argsEnd).trim();

  // Parse args: split by top-level commas
  const argTokens = splitTopLevel(argsRaw, ",");
  const args = argTokens
    .map((t) => parseArg(t.trim()))
    .filter(Boolean);

  // After args, capture up to first $$ or ; (function body delimiter) — bounded scan
  const tail = sql.slice(argsEnd + 1, argsEnd + 1 + 1024); // bounded 1KB lookahead
  const tailUpper = tail.toUpperCase();

  // RETURNS clause
  const returnsMatch = tail.match(/RETURNS\s+([^\n;]+?)(?=\s+(?:LANGUAGE|AS|SECURITY|VOLATILE|STABLE|IMMUTABLE|SET|\$\$)|$)/i);
  const returnType = returnsMatch ? returnsMatch[1].trim() : "";

  // LANGUAGE clause
  const langMatch = tail.match(/LANGUAGE\s+([\w]+)/i);
  const language = langMatch ? langMatch[1] : "";

  // SECURITY DEFINER/INVOKER
  const securityDefiner = /SECURITY\s+DEFINER/i.test(tail);

  // SET search_path = ...
  const searchPath = [];
  const spRe = /SET\s+search_path\s*=\s*([\w\s,'"]+?)(?=\s+(?:AS|LANGUAGE|SECURITY|VOLATILE|STABLE|IMMUTABLE|\$\$|;)|$)/gi;
  let spMatch;
  while ((spMatch = spRe.exec(tail)) !== null) {
    for (const tok of spMatch[1].split(",")) {
      const t = tok.trim().replace(/['"]/g, "");
      if (t) searchPath.push(t);
    }
  }

  // Classification
  let parseMode = "parsed";
  const warnings = [];
  if (!returnType) {
    parseMode = "partially_parsed";
    warnings.push("RETURNS clause not found in 1KB lookahead");
  }
  if (!language) {
    parseMode = "partially_parsed";
    warnings.push("LANGUAGE clause not found in 1KB lookahead");
  }

  return {
    parseMode,
    schemaName,
    funcName,
    args,
    returnType,
    language,
    securityDefiner,
    searchPath,
    parseWarnings: warnings,
  };
}

/**
 * Split a string by `delim` at top-level (ignoring parens/brackets).
 */
function splitTopLevel(s, delim) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === delim && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

/**
 * Parse a single function argument token. Returns { name, type, mode } or null.
 * Accepts forms :
 *   - "p_id integer"
 *   - "IN p_id integer"
 *   - "integer" (positional, name='')
 *   - "p_id integer DEFAULT 0"
 */
function parseArg(token) {
  if (!token) return null;
  let work = token.trim().replace(/DEFAULT\s+.+$/i, "").trim();

  // Detect mode prefix
  let mode = "IN";
  const modeMatch = work.match(/^(IN|OUT|INOUT|VARIADIC)\s+/i);
  if (modeMatch) {
    mode = modeMatch[1].toUpperCase();
    work = work.slice(modeMatch[0].length);
  }

  // Now : "<name> <type>" or just "<type>"
  const parts = work.split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return null;
  if (parts.length === 1) {
    return { name: "", type: parts[0], mode };
  }
  // First token = name (if it's an identifier), rest = type
  const nameRe = /^["'\w]+$/;
  if (nameRe.test(parts[0])) {
    return { name: parts[0].replace(/["']/g, ""), type: parts.slice(1).join(" "), mode };
  }
  // Otherwise everything is the type
  return { name: "", type: work, mode };
}

function sigHash(args) {
  const sig = (args || []).map((a) => `${a.mode}:${a.type}`).join(",");
  return crypto.createHash("sha1").update(sig).digest("hex").slice(0, 8);
}

function entryId(schemaName, funcName, args, overloadIndex) {
  // For overloaded functions, add disambiguator
  if (overloadIndex !== undefined) {
    return `${schemaName}.${funcName}#sig:${sigHash(args)}`;
  }
  return `${schemaName}.${funcName}`;
}

// True if `c` is a SQL identifier character. Used to detect an `E'…'` escape-string
// prefix without misfiring on identifiers that merely end in `e`/`E`.
function isWordChar(c) {
  return c !== undefined && /[A-Za-z0-9_]/.test(c);
}

// Single forward-pass SQL lexer. Returns `{ masked, blocks }`.
//
//   masked — a SAME-LENGTH copy of `sql` with every COMMENT character replaced by a
//     space (newlines preserved). All downstream parsing (header, arguments, RETURNS,
//     LANGUAGE) runs on `masked`, so an inline comment can NEVER leak into an argument
//     type and pollute its sigHash. Invariant: the same PostgreSQL signature written
//     with or without inline comments yields identical args → identical sigHash → ONE
//     registry signature. String literals, dollar-quoted bodies and quoted identifiers
//     are preserved verbatim (they are code, not comments).
//
//   blocks — byte offsets of every top-level `CREATE [OR REPLACE] FUNCTION` keyword in
//     executable code, never inside a comment, string, dollar body or quoted identifier.
//     Offsets are valid in both `sql` and `masked` (identical length).
//
// Handles: line comments (`-- … \n`), NESTED block comments (`/* … /* … */ … */`),
// single-quoted strings (`'…''…'`), E-strings (`E'… \' … ''…'`), double-quoted
// identifiers (`"…""…"`), and dollar-quoted bodies (`$$ … $$`, `$tag$ … $tag$`).
//
// Replaces an earlier keyword-only lexer that masked comments for DETECTION but still
// fed the ORIGINAL sql to the argument parser — letting inline comments become fake
// argument types and fabricate spurious `#sig:` variants of one real function.
function lexSql(sql) {
  const n = sql.length;
  const masked = sql.split("");
  const blocks = [];
  const createRe = /^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i;
  const dollarRe = /^\$[A-Za-z0-9_]*\$/;
  let i = 0;
  while (i < n) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);

    // line comment → mask to end of line (newline preserved)
    if (two === "--") {
      while (i < n && sql[i] !== "\n") { masked[i] = " "; i++; }
      continue;
    }

    // block comment (nested-aware) → mask, keeping newlines
    if (two === "/*") {
      let depth = 0;
      while (i < n) {
        if (sql.slice(i, i + 2) === "/*") { masked[i] = " "; masked[i + 1] = " "; i += 2; depth++; continue; }
        if (sql.slice(i, i + 2) === "*/") { masked[i] = " "; masked[i + 1] = " "; i += 2; depth--; if (depth === 0) break; continue; }
        if (sql[i] !== "\n") masked[i] = " ";
        i++;
      }
      continue;
    }

    // single-quoted string, or E'…' escape string — preserved verbatim
    if (ch === "'" || ((ch === "E" || ch === "e") && sql[i + 1] === "'" && !isWordChar(sql[i - 1]))) {
      const isE = ch !== "'";
      if (isE) i += 1; // step over the E onto the opening quote
      i += 1; // step over the opening quote into the body
      while (i < n) {
        const c = sql[i];
        if (isE && c === "\\") { i += 2; continue; } // backslash escape (E-strings only)
        if (c === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; } // doubled '' escape
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // double-quoted identifier — preserved; never detected as a keyword
    if (ch === '"') {
      i += 1;
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { i += 2; continue; } // doubled "" escape
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // dollar-quoted body — preserved; only its matching tag closes it
    if (ch === "$") {
      const dm = dollarRe.exec(sql.slice(i, i + 64));
      if (dm) {
        const tag = dm[0];
        i += tag.length;
        const end = sql.indexOf(tag, i);
        i = end === -1 ? n : end + tag.length;
        continue;
      }
    }

    // top-level CREATE [OR REPLACE] FUNCTION keyword in executable code
    if (ch === "C" || ch === "c") {
      const cm = createRe.exec(sql.slice(i, i + 40));
      if (cm) { blocks.push(i); i += cm[0].length; continue; }
    }

    i += 1;
  }
  return { masked: masked.join(""), blocks };
}

// Backward-compatible detection API: byte offsets of real CREATE FUNCTION keywords.
function findFunctionBlocks(sql) {
  return lexSql(sql).blocks;
}

// Comment-masked view of `sql` (comments → spaces, offsets preserved). Feed THIS to
// parseFunctionBlock so comments cannot enter argument types / sigHash.
function maskComments(sql) {
  return lexSql(sql).masked;
}

function loadAllMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  const out = [];
  for (const f of files.sort()) {
    out.push({
      filename: f,
      sql: fs.readFileSync(path.join(migrationsDir, f), "utf8"),
    });
  }
  return out;
}

function getMigrationsDir() {
  const idx = process.argv.indexOf("--migrations-dir");
  if (idx > 0 && process.argv[idx + 1]) {
    return path.resolve(process.argv[idx + 1]);
  }
  return DEFAULT_MIGRATIONS_DIR;
}

function main() {
  const usageMap = readJsonSafe(path.join(AUDIT_DIR, "db-usage-map.json"));
  const callsites = (usageMap && usageMap.rpc) || {};

  const migrations = loadAllMigrations(getMigrationsDir());
  log(`scanning ${migrations.length} migration files`);

  // Group entries by canonical full name to detect overloads
  const byFullName = new Map(); // "schema.name" → array of parsed records

  for (const { filename, sql } of migrations) {
    // Parse the comment-masked view (offsets preserved) so inline comments never enter
    // argument types or sigHash — one PG signature = one registry signature.
    const { masked, blocks } = lexSql(sql);
    for (const start of blocks) {
      const parsed = parseFunctionBlock(masked, start);
      if (!parsed) {
        // CREATE FUNCTION matched by keyword but parser couldn't extract — emit unknown_signature
        const around = masked.slice(start, Math.min(start + 200, masked.length));
        const nameGuess = (around.match(/FUNCTION\s+([\w."']+)/i) || [])[1] || "unknown";
        const cleanName = nameGuess.replace(/["']/g, "");
        const [schemaName, funcName] = cleanName.includes(".")
          ? cleanName.split(".")
          : ["public", cleanName];
        const fullName = `${schemaName}.${funcName}`;
        const arr = byFullName.get(fullName) || [];
        arr.push({
          parseMode: "unknown_signature",
          schemaName,
          funcName,
          args: [],
          parseError: "Header regex failed",
          filename,
        });
        byFullName.set(fullName, arr);
        continue;
      }
      const fullName = `${parsed.schemaName}.${parsed.funcName}`;
      const arr = byFullName.get(fullName) || [];
      parsed.filename = filename;
      arr.push(parsed);
      byFullName.set(fullName, arr);
    }
  }

  const entries = [];

  for (const [fullName, records] of byFullName.entries()) {
    const [schemaName, funcName] = fullName.split(".");
    const isExtension = EXTENSION_SCHEMAS.has(schemaName.toLowerCase());

    // Keep last occurrence per signature (CREATE OR REPLACE semantics)
    // For overloads (same name, different args), emit separate entries
    const bySignature = new Map();
    for (const r of records) {
      const sigKey = sigHash(r.args || []);
      bySignature.set(sigKey, r); // last write wins (CREATE OR REPLACE)
    }
    const sigList = Array.from(bySignature.values());
    const overloaded = sigList.length > 1;

    for (const parsed of sigList) {
      const sourceConfidence =
        parsed.parseMode === "parsed"
          ? "high"
          : parsed.parseMode === "partially_parsed"
          ? "medium"
          : "low";

      const hasUsage = callsites[funcName] && (callsites[funcName].used_by_count || 0) > 0;

      let status;
      if (isExtension) {
        status = "ARCHIVED"; // not part of monorepo runtime
      } else if (parsed.parseMode === "unknown_signature") {
        status = "UNKNOWN"; // never force a classification
      } else if (hasUsage) {
        status = "LIVE";
      } else {
        status = "UNKNOWN"; // candidate orphan, not LEGACY
      }

      const id = overloaded
        ? entryId(schemaName, funcName, parsed.args || [], 0)
        : entryId(schemaName, funcName);

      const entry = {
        schemaVersion: SCHEMA_VERSION,
        id,
        name: funcName,
        schema: schemaName,
        domain: DEFAULT_DOMAIN,
        status,
        owner: DEFAULT_OWNER,
        sourceConfidence,
        parseMode: parsed.parseMode,
        args: (parsed.args || []).map((a) => ({
          name: a.name || "",
          type: a.type || "",
          mode: a.mode || "IN",
        })),
        returnType: parsed.returnType || "",
        language: parsed.language || "",
        securityDefiner: Boolean(parsed.securityDefiner),
        searchPath: parsed.searchPath || [],
        definedInMigrations: parsed.filename ? [parsed.filename] : [],
        usedBy:
          callsites[funcName] && Array.isArray(callsites[funcName].used_by)
            ? [...callsites[funcName].used_by].sort()
            : [],
        parseWarnings: parsed.parseWarnings || [],
      };
      if (parsed.parseError) entry.parseError = parsed.parseError;

      entries.push(entry);
    }
  }

  log(
    `extracted ${entries.length} RPC entries (parsed=${
      entries.filter((e) => e.parseMode === "parsed").length
    }, partial=${entries.filter((e) => e.parseMode === "partially_parsed").length}, unknown=${
      entries.filter((e) => e.parseMode === "unknown_signature").length
    })`
  );

  const output = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-rpc-registry.js",
    entries: sortById(entries),
  };

  const outPath = path.join(REGISTRY_DIR, "rpc.json");
  const sha = writeDeterministicJson(outPath, output);
  log(`wrote ${outPath} (${entries.length} entries, sha256:${sha.slice(0, 12)})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/rpc] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseFunctionBlock,
  parseArg,
  splitTopLevel,
  findFunctionBlocks,
  lexSql,
  maskComments,
  sigHash,
};
