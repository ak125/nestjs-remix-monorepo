#!/usr/bin/env tsx
/**
 * Tests adversariaux du ratchet d'orphelins G3.
 *
 * Le comparateur est pur — baseline, inventaire, `git ls-files`, date et scope
 * de base sont injectés — donc chaque cas est déterministe et sans I/O.
 *
 * Deux tests portent tout l'édifice :
 *   - DETECTOR_BLIND   la disparition n'est jamais un succès implicite
 *   - SCOPE_NARROWING  le périmètre n'est pas un bouton pour effacer la dette
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import {
  classifyScopeChange,
  compare,
  computeScopeFingerprint,
  daysBetween,
  inScope,
  validateBaseline,
  type OrphanBaseline,
} from "./check-orphan-files-ratchet.ts";

const TODAY = "2026-08-13";
const RAG = "backend/src/modules/rag-proxy/";
const P = (s: string) => RAG + s;

function baseline(
  orphans: Partial<OrphanBaseline["orphans"][number]>[],
  opts: { maxOrphanAgeDays?: number; roots?: string[] } = {},
): OrphanBaseline {
  const roots = opts.roots ?? [RAG];
  return {
    schemaVersion: "1.0.0",
    scope: { roots, fingerprint: computeScopeFingerprint(roots) },
    maxOrphanAgeDays: opts.maxOrphanAgeDays ?? 30,
    orphans: orphans.map((o) => ({
      path: P("a.ts"),
      first_seen: TODAY,
      first_seen_method: "graph_transition",
      evidence_commit: "deadbeef",
      ...o,
    })) as OrphanBaseline["orphans"],
  };
}
const kinds = (r: { findings: { kind: string }[] }) => r.findings.map((f) => f.kind).sort();
const base = [RAG];

// ── Verdicts sur les identités ───────────────────────────────────────────────

test("orphelin in-scope non déclaré → UNDECLARED_NEW", () => {
  const r = compare(baseline([]), new Set([P("x.ts")]), new Set([P("x.ts")]), TODAY, base);
  assert.deepEqual(kinds(r), ["UNDECLARED_NEW"]);
});

test("hors inventaire mais ENCORE tracké par git → DETECTOR_BLIND", () => {
  const r = compare(baseline([{ path: P("mort.ts") }]), new Set(), new Set([P("mort.ts")]), TODAY, base);
  assert.deepEqual(kinds(r), ["DETECTOR_BLIND"]);
  assert.equal(r.resolved.length, 0, "une perte de couverture n'est jamais 'résolue'");
});

test("hors inventaire ET hors git → RESOLVED, aucun finding", () => {
  const r = compare(baseline([{ path: P("mort.ts") }]), new Set(), new Set(), TODAY, base);
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.resolved, [P("mort.ts")]);
});

test("checkout incomplet : absence disque ≠ RESOLVED (git fait foi)", () => {
  const r = compare(baseline([{ path: P("z.ts") }]), new Set(), new Set([P("z.ts")]), TODAY, base);
  assert.deepEqual(kinds(r), ["DETECTOR_BLIND"]);
});

test("renommage : ancien RESOLVED, nouveau non déclaré → FAIL", () => {
  const r = compare(baseline([{ path: P("old.ts") }]), new Set([P("new.ts")]), new Set([P("new.ts")]), TODAY, base);
  assert.deepEqual(kinds(r), ["UNDECLARED_NEW"]);
  assert.deepEqual(r.resolved, [P("old.ts")]);
});

test("âge exactement au max → PASS ; max+1 → STALE_ORPHAN", () => {
  const ok = compare(baseline([{ path: P("a.ts"), first_seen: "2026-07-14" }]), new Set([P("a.ts")]), new Set([P("a.ts")]), TODAY, base);
  assert.equal(daysBetween("2026-07-14", TODAY), 30);
  assert.deepEqual(ok.findings, []);
  const ko = compare(baseline([{ path: P("a.ts"), first_seen: "2026-07-13" }]), new Set([P("a.ts")]), new Set([P("a.ts")]), TODAY, base);
  assert.equal(daysBetween("2026-07-13", TODAY), 31);
  assert.deepEqual(kinds(ko), ["STALE_ORPHAN"]);
});

// ── Hors périmètre : compté, visible, non bloquant ───────────────────────────

test("orphelin hors scope → compté OUT_OF_SCOPE, aucun finding", () => {
  const r = compare(baseline([]), new Set(["frontend/app/dead.ts"]), new Set(["frontend/app/dead.ts"]), TODAY, base);
  assert.deepEqual(r.findings, [], "hors scope ne doit pas bloquer");
  assert.equal(r.counts.outOfScope, 1, "mais doit rester VISIBLE dans le rapport");
  assert.equal(r.counts.inScope, 0);
});

test("une entrée déclarée hors de son propre scope est une incohérence", () => {
  const b = baseline([{ path: "frontend/app/x.ts" }]);
  assert.ok(validateBaseline(b, TODAY).some((f) => /HORS du scope/.test(f.detail)));
});

// ── Le scope ne doit pas être un bouton pour effacer la dette ────────────────

test("classifyScopeChange : SAME / WIDENED / NARROWED / NO_BASE", () => {
  assert.equal(classifyScopeChange([RAG], [RAG]), "SAME");
  assert.equal(classifyScopeChange([RAG], ["backend/src/modules/"]), "WIDENED");
  assert.equal(classifyScopeChange([RAG], [RAG + "dto/"]), "NARROWED");
  assert.equal(classifyScopeChange([RAG], []), "NARROWED", "racine supprimée = territoire perdu");
  assert.equal(classifyScopeChange([RAG], ["frontend/app/"]), "NARROWED", "remplacement ≠ couverture");
  assert.equal(classifyScopeChange(null, [RAG]), "NO_BASE", "première introduction");
});

test("LE test : rétrécir le scope échoue MÊME si tout le reste est parfait", () => {
  // baseline de main : rag-proxy/   →   PR : rag-proxy/dto/
  // baseline interne cohérente, fingerprint correct, aucun orphelin restant
  // dans le périmètre réduit. Le seul défaut est la réduction elle-même.
  const narrowed = baseline([], { roots: [RAG + "dto/"] });
  const r = compare(narrowed, new Set(), new Set(), TODAY, [RAG]);
  assert.equal(r.scopeChange, "NARROWED");
  assert.deepEqual(kinds(r), ["SCOPE_NARROWING"]);
  // --refresh et la variable mainteneur agissent dans main(), AVANT compare().
  // Ils ne peuvent donc structurellement pas lever ce verdict : compare() ne
  // reçoit aucun paramètre de refresh.
  assert.equal(compare.length, 5, "compare() ne doit jamais recevoir d'échappatoire refresh");
});

test("élargir le scope est autorisé", () => {
  const wider = baseline([], { roots: ["backend/src/modules/"] });
  const r = compare(wider, new Set(), new Set(), TODAY, [RAG]);
  assert.equal(r.scopeChange, "WIDENED");
  assert.deepEqual(r.findings, []);
});

test("fingerprint incohérent avec roots → BASELINE_INVALID", () => {
  const b = baseline([]);
  b.scope.fingerprint = "sha256:" + "0".repeat(64);
  assert.ok(validateBaseline(b, TODAY).some((f) => /fingerprint incohérent/.test(f.detail)));
});

test("fingerprint stable et indépendant de l'ordre de saisie", () => {
  assert.equal(computeScopeFingerprint(["b/", "a/"]), computeScopeFingerprint(["a/", "b/"]));
});

for (const bad of ["backend/src", "/absolu/", "a\\b/", "../evade/"]) {
  test(`racine de scope invalide rejetée : ${bad}`, () => {
    const b = baseline([], { roots: [bad] });
    b.scope.fingerprint = computeScopeFingerprint([bad]);
    assert.ok(validateBaseline(b, TODAY).some((f) => f.kind === "BASELINE_INVALID"));
  });
}

test("inScope est un préfixe, pas un glob", () => {
  assert.ok(inScope(P("dto/a.ts"), [RAG]));
  assert.ok(!inScope("backend/src/modules/rag-proxyX/a.ts", [RAG]), "frontière de racine respectée");
});

// ── Baseline mal formée ──────────────────────────────────────────────────────

test("doublon de path → BASELINE_INVALID", () => {
  const b = baseline([{ path: P("a.ts") }, { path: P("a.ts") }]);
  assert.ok(validateBaseline(b, TODAY).some((f) => /doublon/.test(f.detail)));
});

for (const bad of ["../evade.ts", "src\\win.ts", "/abs.ts", "src/./a.ts"]) {
  test(`chemin non normalisé rejeté : ${bad}`, () => {
    assert.ok(validateBaseline(baseline([{ path: bad }]), TODAY).some((f) => f.kind === "BASELINE_INVALID"));
  });
}

test("first_seen futur ou mal formé → BASELINE_INVALID", () => {
  assert.ok(validateBaseline(baseline([{ first_seen: "2099-01-01" }]), TODAY).some((f) => /futur/.test(f.detail)));
  assert.ok(validateBaseline(baseline([{ first_seen: "13/08/2026" }]), TODAY).some((f) => /invalide/.test(f.detail)));
});

test("first_seen_method absente ou inconnue → BASELINE_INVALID", () => {
  const b = baseline([{ first_seen_method: "au-pif" as never }]);
  assert.ok(validateBaseline(b, TODAY).some((f) => /first_seen_method/.test(f.detail)));
});

test("les 3 méthodes de provenance légitimes sont acceptées", () => {
  for (const m of ["historical_inventory", "graph_transition", "git_introduction"] as const) {
    assert.deepEqual(validateBaseline(baseline([{ first_seen_method: m }]), TODAY), []);
  }
});

// ── --refresh : double intention, refus sous CI ──────────────────────────────

const SCRIPT = join(import.meta.dirname, "check-orphan-files-ratchet.ts");
function runCli(env: Record<string, string>): { code: number; err: string } {
  try {
    execFileSync("npx", ["tsx", SCRIPT, "--refresh"], {
      encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, err: "" };
  } catch (e) {
    const x = e as { status?: number; stderr?: string };
    return { code: x.status ?? -1, err: x.stderr ?? "" };
  }
}

test("--refresh REFUSÉ sous CI même avec la variable mainteneur", () => {
  const r = runCli({ CI: "true", ORPHAN_RATCHET_REFRESH: "maintainer" });
  assert.equal(r.code, 1);
  assert.match(r.err, /REFUS[ÉE] sous CI/);
});

test("--refresh REFUSÉ sans la seconde intention explicite", () => {
  const r = runCli({ CI: "", ORPHAN_RATCHET_REFRESH: "" });
  assert.equal(r.code, 1);
  assert.match(r.err, /seconde intention explicite/);
});

// ── Cumul ────────────────────────────────────────────────────────────────────

test("les verdicts se cumulent, aucun ne masque les autres", () => {
  const r = compare(
    baseline([
      { path: P("vieux.ts"), first_seen: "2026-01-01" },
      { path: P("aveugle.ts") },
      { path: P("parti.ts") },
    ]),
    new Set([P("vieux.ts"), P("surprise.ts"), "frontend/app/hors.ts"]),
    new Set([P("vieux.ts"), P("aveugle.ts"), P("surprise.ts"), "frontend/app/hors.ts"]),
    TODAY,
    base,
  );
  assert.deepEqual(kinds(r), ["DETECTOR_BLIND", "STALE_ORPHAN", "UNDECLARED_NEW"]);
  assert.deepEqual(r.resolved, [P("parti.ts")]);
  assert.equal(r.counts.outOfScope, 1);
});
