import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCircuit, parseCodeowners } from "./merge-circuit.mjs";

const entries = [
  { glob: "docs/**", domain: "D12", owner: "x", sourceConfidence: "high", risk: "low" },
  { glob: "backend/src/modules/seo/**", domain: "D3", owner: "x", sourceConfidence: "high", risk: "medium" },
  { glob: "backend/src/modules/payments/**", domain: "D7", owner: "x", sourceConfidence: "high", risk: "critical" },
  { glob: "backend/src/modules/pricing/**", domain: "D7", owner: "x", sourceConfidence: "high", risk: "high" },
  { glob: "backend/supabase/migrations/*seo_event_log*", domain: "D3", owner: "x", sourceConfidence: "high", risk: "low" },
  { glob: "tmp/**", domain: "UNKNOWN", owner: "__unassigned__", sourceConfidence: "low", risk: "low" },
];
const codeowners = parseCodeowners(`
# commentaire
/backend/supabase/migrations/   @owner
/scripts/ci/prod-*              @owner
/.github/CODEOWNERS             @owner
`);

test("CODEOWNERS : dossier, préfixe et fichier ancrés deviennent des globs", () => {
  assert.deepEqual(
    codeowners.map((c) => c.glob),
    ["backend/supabase/migrations/**", "scripts/ci/prod-*", ".github/CODEOWNERS"],
  );
});

test("tout en risque faible → circuit faible", () => {
  assert.equal(classifyCircuit(["docs/a.md", "docs/b.md"], entries, codeowners).circuit, "faible");
});

test("un chemin moyen relève toute la PR au circuit moyen", () => {
  assert.equal(classifyCircuit(["docs/a.md", "backend/src/modules/seo/x.ts"], entries, codeowners).circuit, "moyen");
});

test("risque élevé ou critique → circuit élevé", () => {
  assert.equal(classifyCircuit(["backend/src/modules/pricing/p.ts"], entries, codeowners).circuit, "eleve");
  assert.equal(classifyCircuit(["backend/src/modules/payments/p.ts"], entries, codeowners).circuit, "eleve");
});

test("une zone CODEOWNERS l'emporte sur un risque faible de la classification", () => {
  const v = classifyCircuit(["backend/supabase/migrations/20261116_seo_event_log_x.sql"], entries, codeowners);
  assert.equal(v.circuit, "eleve");
  assert.equal(v.reasons[0].code, "CODEOWNERS_ZONE");
  assert.equal(classifyCircuit(["scripts/ci/prod-rollback.sh"], entries, codeowners).circuit, "eleve");
});

test("tout doute vaut le circuit élevé : non classé, domaine inconnu, aucune modification", () => {
  assert.equal(classifyCircuit(["nowhere/x.ts"], entries, codeowners).reasons[0].code, "UNCLASSIFIED");
  assert.equal(classifyCircuit(["tmp/x.ts"], entries, codeowners).circuit, "eleve");
  assert.equal(classifyCircuit([], entries, codeowners).circuit, "eleve");
});
