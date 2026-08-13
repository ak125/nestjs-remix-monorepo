#!/usr/bin/env tsx
/**
 * G3 — Ratchet d'identité des orphelins.
 *
 * POURQUOI CE RATCHET EXISTE
 * --------------------------
 * Le repo mesurait des COMPTEURS agrégés à seuil, jamais l'ÂGE d'une identité.
 * `audit-reports/phase0-baseline.json` tolère `unused_files_delta: 5` et son
 * comparateur documente « Negative deltas (progress) always succeed ».
 *
 * Conséquence mesurée : débrancher un service sans supprimer ses fichiers FAIT
 * MONTER `unused_files`. Le seul gate bloquant couvrant le code mort punissait
 * donc le nettoyage à moitié fait, récompensait l'inaction, et n'avait aucun
 * mécanisme pour réclamer la seconde moitié. Le cluster rag-proxy débranché par
 * rag-purge B8/B9 (2026-06-19) est resté ~2 mois sans que rien ne le réclame.
 *
 * Ici, débrancher OUVRE UN COMPTE À REBOURS.
 *
 * LES VERDICTS
 * ------------
 *   UNDECLARED_NEW   orphelin in-scope absent de la baseline          → FAIL
 *   STALE_ORPHAN     orphelin déclaré au-delà de maxOrphanAgeDays     → FAIL
 *   DETECTOR_BLIND   hors inventaire MAIS encore tracké par git       → FAIL
 *   SCOPE_NARROWING  périmètre réduit vs la branche de base           → FAIL
 *   RESOLVED         hors inventaire ET hors git                      → pass, tracé
 *   OUT_OF_SCOPE     orphelin hors périmètre                          → compté, non bloquant
 *
 * LA PROPRIÉTÉ CENTRALE — la disparition n'est JAMAIS un succès implicite
 * ----------------------------------------------------------------------
 * Un fichier qui sort de l'inventaire a deux causes : il a été supprimé, ou le
 * détecteur a cessé de le voir (règle knip modifiée, import factice, `ignore`
 * élargi). Les deux produisent le même symptôme dans un compteur.
 *
 * Le discriminant est la PRÉSENCE DANS GIT, pas sur le disque : un checkout
 * sparse ou partiel ferait sinon passer une absence disque pour une suppression
 * réussie. `git ls-files` est la seule vérité de présence indépendante de l'état
 * local du working tree.
 *
 * LE PRÉDICAT ORPHAN N'EST PAS « CANDIDAT DE NETTOYAGE »
 * ------------------------------------------------------
 * `dead-code-candidates.json` liste 273 candidats knip ; seuls 188 satisfont le
 * prédicat orphan strict (zéro import statique ET zéro import dynamique). Les 85
 * autres ONT des importeurs. Les inclure ferait entrer des non-orphelins dans une
 * baseline d'orphelins.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export type FirstSeenMethod =
  /** Prouvé orphelin dans un inventaire historique fiable à cette date. */
  | "historical_inventory"
  /** Commit précis où le DERNIER chemin d'atteignabilité ou d'import a disparu. */
  | "graph_transition"
  /** Fallback. Borne conservatrice sur l'ÂGE MAXIMAL — PAS une preuve que le
   *  fichier était orphelin dès son introduction. Donne volontairement un âge
   *  potentiellement trop élevé, donc fail-closed. */
  | "git_introduction";

export interface BaselineEntry {
  path: string;
  first_seen: string;
  first_seen_method: FirstSeenMethod;
  evidence_commit: string | null;
  evidence_date?: string;
  reasoning?: string;
  loc?: number;
}

export interface ScopeSpec {
  /** Préfixes repo-relatifs terminés par '/'. Pas des globs : l'inclusion doit
   *  être mécanique (`oldRoot.startsWith(newRoot)`), pas sémantique. */
  roots: string[];
  /** sha256 des roots canoniques. Intégrité interne, JAMAIS l'autorité du verdict. */
  fingerprint: string;
}

export interface OrphanBaseline {
  schemaVersion: string;
  scope: ScopeSpec;
  maxOrphanAgeDays: number;
  orphans: BaselineEntry[];
}

export type FindingKind =
  | "UNDECLARED_NEW"
  | "STALE_ORPHAN"
  | "DETECTOR_BLIND"
  | "SCOPE_NARROWING"
  | "BASELINE_INVALID";

export interface Finding { kind: FindingKind; path: string; detail: string }

export type ScopeChange = "SAME" | "WIDENED" | "NARROWED" | "NO_BASE";

export interface CompareResult {
  findings: Finding[];
  resolved: string[];
  scopeChange: ScopeChange;
  counts: { declared: number; inScope: number; outOfScope: number };
}

// ── Scope ────────────────────────────────────────────────────────────────────

export const canonicalRoots = (roots: string[]): string[] => [...new Set(roots)].sort();

export const computeScopeFingerprint = (roots: string[]): string =>
  "sha256:" + createHash("sha256").update(JSON.stringify(canonicalRoots(roots))).digest("hex");

export const inScope = (path: string, roots: string[]): boolean =>
  roots.some((r) => path.startsWith(r));

/**
 * Un ancien territoire reste couvert s'il existe une nouvelle racine qui le
 * préfixe. Sinon une partie du périmètre a disparu, quel que soit le reste.
 *
 * Une empreinte détecte QU'un scope a changé, jamais DANS QUEL SENS — et un
 * `--refresh` légitime la recalculerait en laissant passer la réduction.
 * L'autorité du verdict est donc ici, pas dans le fingerprint.
 */
export function classifyScopeChange(oldRoots: string[] | null, newRoots: string[]): ScopeChange {
  if (oldRoots === null) return "NO_BASE"; // première introduction : rien à rétrécir
  const uncovered = oldRoots.filter((o) => !newRoots.some((n) => o.startsWith(n)));
  if (uncovered.length > 0) return "NARROWED";
  return canonicalRoots(oldRoots).join(" ") === canonicalRoots(newRoots).join(" ")
    ? "SAME"
    : "WIDENED";
}

// ── Validation de la baseline ────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_METHODS: FirstSeenMethod[] = [
  "historical_inventory",
  "graph_transition",
  "git_introduction",
];

export function validateBaseline(baseline: OrphanBaseline, today: string): Finding[] {
  const f: Finding[] = [];
  const bad = (path: string, detail: string) => f.push({ kind: "BASELINE_INVALID", path, detail });

  if (!Number.isInteger(baseline.maxOrphanAgeDays) || baseline.maxOrphanAgeDays < 0) {
    bad("<baseline>", `maxOrphanAgeDays invalide : ${String(baseline.maxOrphanAgeDays)}`);
  }

  const scope = baseline.scope;
  if (!Array.isArray(scope?.roots) || scope.roots.length === 0) {
    bad("<scope>", "scope.roots absent ou vide");
  } else {
    for (const r of scope.roots) {
      if (!r.endsWith("/") || r.startsWith("/") || r.includes("\\") || r.split("/").includes("..")) {
        bad(r, "racine invalide (repo-relative, '/', terminée par '/', sans '..')");
      }
    }
    const expected = computeScopeFingerprint(scope.roots);
    if (scope.fingerprint !== expected) {
      bad("<scope>", `fingerprint incohérent avec roots (attendu ${expected})`);
    }
  }

  const seen = new Set<string>();
  for (const e of baseline.orphans) {
    if (seen.has(e.path)) bad(e.path, "chemin en doublon — verdict indéterminé");
    seen.add(e.path);

    if (
      e.path !== e.path.replace(/\\/g, "/") || e.path.startsWith("/") ||
      e.path.split("/").includes("..") || e.path.split("/").includes(".")
    ) {
      bad(e.path, "chemin non normalisé (repo-relatif, séparateurs '/', sans '..')");
    }
    if (scope?.roots?.length && !inScope(e.path, scope.roots)) {
      bad(e.path, "déclaré dans la baseline mais HORS du scope — incohérence");
    }
    if (!ISO_DATE.test(e.first_seen) || Number.isNaN(Date.parse(e.first_seen))) {
      bad(e.path, `first_seen invalide : ${e.first_seen} (attendu YYYY-MM-DD)`);
    } else if (e.first_seen > today) {
      bad(e.path, `first_seen dans le futur : ${e.first_seen} > ${today}`);
    }
    if (!VALID_METHODS.includes(e.first_seen_method)) {
      bad(
        e.path,
        `first_seen_method invalide : ${String(e.first_seen_method)}. La provenance ` +
          `est obligatoire — sans elle une estimation serait présentée comme une mesure.`,
      );
    }
  }
  return f;
}

// ── Comparateur — pur, testable sans I/O ─────────────────────────────────────

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function compare(
  baseline: OrphanBaseline,
  currentOrphans: Set<string>,
  gitTracked: Set<string>,
  today: string,
  baseRoots: string[] | null,
): CompareResult {
  const findings: Finding[] = [...validateBaseline(baseline, today)];
  const resolved: string[] = [];
  const roots = baseline.scope?.roots ?? [];

  // (0) Le périmètre ne doit jamais servir de bouton pour faire disparaître la
  //     dette. Évalué AVANT tout le reste, et insensible à --refresh.
  const scopeChange = classifyScopeChange(baseRoots, roots);
  if (scopeChange === "NARROWED") {
    findings.push({
      kind: "SCOPE_NARROWING",
      path: "<scope>",
      detail:
        `périmètre réduit vs la branche de base. Base : [${(baseRoots ?? []).join(", ")}] ` +
        `— courant : [${roots.join(", ")}]. Réduire le scope ferait disparaître de la ` +
        `dette sans la traiter. Ni --refresh ni la variable mainteneur ne lèvent ce verdict.`,
    });
  }

  const declared = new Set(baseline.orphans.map((e) => e.path));
  const inS = [...currentOrphans].filter((p) => inScope(p, roots)).sort();
  const outOfScope = currentOrphans.size - inS.length;

  // (1) Tout orphelin in-scope doit être déclaré.
  for (const p of inS) {
    if (!declared.has(p)) {
      findings.push({
        kind: "UNDECLARED_NEW",
        path: p,
        detail: "orphelin in-scope absent de la baseline — le déclarer (avec first_seen " +
          "et sa méthode) ou supprimer le fichier",
      });
    }
  }

  for (const e of baseline.orphans) {
    if (currentOrphans.has(e.path)) {
      const age = daysBetween(e.first_seen, today);
      if (age > baseline.maxOrphanAgeDays) {
        findings.push({
          kind: "STALE_ORPHAN",
          path: e.path,
          detail:
            `orphelin depuis ${age} j (max ${baseline.maxOrphanAgeDays}) — first_seen ` +
            `${e.first_seen} via ${e.first_seen_method}. Débrancher sans supprimer ` +
            `n'est pas un état stable.`,
        });
      }
      continue;
    }
    // (2) Sorti de l'inventaire — la question est POURQUOI.
    if (gitTracked.has(e.path)) {
      findings.push({
        kind: "DETECTOR_BLIND",
        path: e.path,
        detail:
          "hors inventaire mais TOUJOURS tracké par git — le détecteur a cessé de le " +
          "voir. Une perte de couverture ne doit jamais passer pour du nettoyage.",
      });
    } else {
      resolved.push(e.path);
    }
  }

  return {
    findings,
    resolved,
    scopeChange,
    counts: { declared: baseline.orphans.length, inScope: inS.length, outOfScope },
  };
}

// ── I/O + CLI ────────────────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname ?? __dirname, "..", "..");
const BASELINE_PATH = "audit/baselines/orphan-files-baseline.json";
const INVENTORY_PATH = "audit/dead-code-candidates.json";

export const readGitTracked = (root: string): Set<string> =>
  new Set(
    execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 })
      .split("\n").filter(Boolean),
  );

/**
 * Prédicat orphan STRICT : zéro import statique ET zéro import dynamique.
 * Volontairement plus étroit que « candidat de nettoyage » — 188 sur 273 au
 * 2026-08-13. Les 85 autres ont des importeurs.
 */
export function readCurrentOrphans(root: string): Set<string> {
  const raw = JSON.parse(readFileSync(join(root, INVENTORY_PATH), "utf8"));
  const list: Array<{ path: string; precheck_verdict?: Record<string, boolean> }> =
    raw.candidates ?? [];
  return new Set(
    list
      .filter((c) => c.precheck_verdict?.c1_zero_static_import === true &&
                     c.precheck_verdict?.c2_zero_dynamic_import === true)
      .map((c) => c.path),
  );
}

/** Scope de la branche de base — autorité de la comparaison de périmètre. */
export function readBaseScopeRoots(root: string, baseRef: string): string[] | null {
  try {
    const blob = execFileSync("git", ["show", `${baseRef}:${BASELINE_PATH}`], {
      cwd: root, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(blob).scope?.roots ?? null;
  } catch {
    return null; // absente de la base = première introduction
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes("--json");
  const refreshMode = argv.includes("--refresh");
  const baseRef = (argv.find((a) => a.startsWith("--base="))?.split("=")[1]) ?? "origin/main";

  if (refreshMode) {
    // DOUBLE INTENTION EXPLICITE. Un drapeau seul se copie-colle dans un
    // workflow ; la variable dédiée ne s'y retrouve pas par accident. Le refus
    // sous CI vaut même si les deux sont présents.
    if (process.env.CI === "true") {
      process.stderr.write(
        "[orphan-ratchet] --refresh REFUSÉ sous CI. La baseline est la référence du " +
          "ratchet : la laisser se réécrire automatiquement supprimerait son signal.\n",
      );
      return 1;
    }
    if (process.env.ORPHAN_RATCHET_REFRESH !== "maintainer") {
      process.stderr.write(
        "[orphan-ratchet] --refresh exige une seconde intention explicite :\n" +
          "  ORPHAN_RATCHET_REFRESH=maintainer npm run audit:orphan-ratchet:refresh\n" +
          "Opération mainteneur — jamais câblée en CI.\n",
      );
      return 1;
    }
  }

  const baseline: OrphanBaseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const r = compare(
    baseline,
    readCurrentOrphans(ROOT),
    readGitTracked(ROOT),
    today,
    readBaseScopeRoots(ROOT, baseRef),
  );

  if (jsonMode) {
    process.stdout.write(JSON.stringify({ today, baseRef, ...r }, null, 2) + "\n");
  } else {
    // Résumé lisible : personne ne doit pouvoir lire « G3 vert » comme
    // « le dépôt entier est protégé ».
    process.stderr.write(
      `\nG3 coverage\n` +
        `  scope            ${baseline.scope?.roots?.join(", ") ?? "<absent>"}\n` +
        `  scope vs ${baseRef.padEnd(11)} ${r.scopeChange}\n` +
        `  in-scope orphan  ${r.counts.inScope}\n` +
        `  out-of-scope     ${r.counts.outOfScope}   (comptés, non bloquants)\n` +
        `  declared         ${r.counts.declared}\n` +
        `  resolved         ${r.resolved.length}\n\n`,
    );
    for (const p of r.resolved) process.stderr.write(`  [RESOLVED] ${p}\n`);
    for (const f of r.findings) process.stderr.write(`  [${f.kind}] ${f.path}\n      ${f.detail}\n`);
  }

  if (r.findings.length > 0) {
    process.stderr.write(`\n[orphan-ratchet] ${r.findings.length} finding(s) — ÉCHEC.\n`);
    return 1;
  }
  process.stderr.write("[orphan-ratchet] ✓ aucun finding\n");
  return 0;
}

// Garde d'entrypoint par BASENAME EXACT, jamais `includes()` : le fichier de
// test contient le nom du module, et un `includes()` faisait tourner le CLI —
// donc lire la baseline — au simple import du test.
if (process.argv[1] && basename(process.argv[1]) === "check-orphan-files-ratchet.ts") {
  process.exit(main());
}
