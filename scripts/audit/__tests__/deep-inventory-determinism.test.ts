// Déterminisme CROSS-MACHINE des 7 projections deep-inventory.
//
// Ce que ce test couvre, et que le step « Deep-inventory freshness » ne peut PAS
// couvrir : ce dernier compare l'artefact commité à une régénération faite sur LA
// MÊME machine. Si les deux sont triés par la locale de cette machine, ou si les
// deux capturent le même working tree sale, il passe au vert. Les deux régressions
// ci-dessous lui sont donc structurellement invisibles.
//
// Test de PROJECTION : il lit les artefacts commités, il ne relance jamais
// dependency-cruiser / madge / knip. Il reste donc rapide et sans dépendance
// réseau ou toolchain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const read = (rel: string) => JSON.parse(readFileSync(join(REPO_ROOT, "audit", rel), "utf8"));

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Tableaux triés des 7 projections : [artefact, chemin lisible, accès, clé de tri]. */
const SORTED_ARRAYS: Array<[string, string, (j: any) => any[], (x: any) => string]> = [
  ["dead-code-candidates.json", "candidates", j => j.candidates, x => x.path],
  ["duplicate-map.json", "duplicates", j => j.duplicates, x => x.path],
  ["module-boundaries.json", "deep_access_violations", j => j.deep_access_violations, x => `${x.from} ${x.to}`],
  ["module-boundaries.json", "cross_domain_edges", j => j.cross_domain_edges, x => `${x.from} ${x.to}`],
  ["db-usage-map.json", "trigger_functions", j => j.trigger_functions, x => x.name],
  // Ajoutés par la résolution des constantes. Ces tableaux entrent dans un
  // artefact comparé OCTET par `git diff --exit-code` en CI : sans entrée ici,
  // un tri dépendant de la locale y passerait sans être vu.
  ["db-usage-map.json", "dynamic_from_callsites", j => j.dynamic_from_callsites, x => `${x.file}:${String(x.line).padStart(6, "0")}`],
  ["db-usage-map.json", "dynamic_rpc_callsites", j => j.dynamic_rpc_callsites, x => `${x.file}:${String(x.line).padStart(6, "0")}`],
  ["db-usage-map.json", "dropped_call_sites", j => j.dropped_call_sites, x => `${x.file}:${String(x.line).padStart(6, "0")}`],
];

for (const [file, label, pick, key] of SORTED_ARRAYS) {
  test(`${file} › ${label} is sorted by codepoint (locale-independent)`, () => {
    const arr = pick(read(file));
    if (!Array.isArray(arr) || arr.length < 2) return; // rien à prouver
    const actual = arr.map(key);
    assert.deepEqual(
      actual,
      [...actual].sort(cmpStr),
      `${file}#${label} is not in codepoint order — a localeCompare() sort resolves the process ICU locale (fr-FR on an operator box, en-US/C on CI), so the artifact would differ per machine for the same commit`,
    );
  });
}

test("localeCompare and codepoint still diverge — the codepoint choice is not cosmetic", () => {
  const sample = ["a-b/z.ts", "a/b.ts", "a_b/c.ts", "A/b.ts", "api.v2.ts", "api-v2.ts"];
  assert.notDeepEqual(
    [...sample].sort((a, b) => a.localeCompare(b)),
    [...sample].sort(cmpStr),
    "if these ever agree, this suite proves nothing — investigate before relaxing anything",
  );
});

test("dead-code-candidates lists no untracked file", () => {
  // knip et dependency-cruiser scannent le filesystem, pas l'index git. Sans le
  // filtre `trackedSet` de build-deep-inventory.js, régénérer depuis un working
  // tree chargé injecte des fichiers non commités dans l'artefact — et donc dans
  // le fingerprint de l'inventaire PR-8 qui le consomme. `git rm` échouerait sur
  // un tel « candidat », et il n'existe pas dans main.
  const tracked = new Set(
    execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 * 256 })
      .split("\n")
      .filter(Boolean),
  );
  const untracked = read("dead-code-candidates.json")
    .candidates.map((c: any) => c.path)
    .filter((p: string) => !tracked.has(p));
  assert.deepEqual(
    untracked,
    [],
    "dead-code-candidates.json cites files absent from the git index — regenerate from a clean checkout and keep the trackedSet filter",
  );
});
