/**
 * tests/registry/db-registry-status.test.ts — croisement `db-usage-map.json`
 * → `audit/registry/db.json` sur le champ `status` (ADR-058 V1-3 :
 * classification jamais forcée).
 *
 * `build-db-registry.js` publie l'UNION des tables vues par le scan : celles
 * que le code référence (`used_by`) et celles qu'une migration déclare
 * (`in_migrations`). L'ancienne règle `status = hasUsage || hasMigrations ?
 * "LIVE" : "UNKNOWN"` était donc vraie pour toute table publiée (314 entrées
 * sur 314 en `LIVE` à la date du correctif) : la branche `UNKNOWN` était
 * inatteignable par construction.
 *
 * Cas d'origine : `__seo_role_template_pool`. Sa migration `20260509_…` est
 * inscrite au ledger des migrations par un baseline, sans exécution ; la table
 * n'existe pas en base. Aucun code ne la lit. Le registre la publiait pourtant
 * `LIVE`, pendant que `db-usage-map.json` la rangeait dans
 * `candidate_orphan_tables`.
 *
 * Contrat de périmètre : ce producteur est un scan HORS-LIGNE. Il ne connaît
 * pas la base ; le seul signal qu'il possède pour `LIVE` (« inbound
 * references » dans `StatusSchema`) est un callsite du code. L'existence réelle
 * d'une table appartient au ratchet ledger ↔ catalogue
 * (`scripts/audit/check-ledger-catalog-ratchet.py`) — ce test ne la vérifie
 * pas et ne doit pas se mettre à la vérifier (ce serait un second détecteur).
 * Il ne nomme volontairement aucune table : un test couplé à une donnée
 * casserait le jour où du code se mettrait, à raison, à lire cette table.
 *
 * `UNKNOWN` n'est pas un verdict de mort : c'est « indéterminable depuis le
 * code ». Une table écrite par une RPC, un cron externe ou PostgREST sans
 * `.from()` littéral reste `UNKNOWN` ici, à raison.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.join(__dirname, "..", "..");
const usage = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "audit", "db-usage-map.json"), "utf8"),
);
const registry = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "audit", "registry", "db.json"), "utf8"),
);
const entries: Array<{ id: string; status: string }> = registry.entries;
const tables: Record<string, { used_by?: unknown[] }> = usage.tables ?? {};

describe("croisement db-usage-map → db.json (status)", () => {
  test("db.json publie exactement les tables de db-usage-map", () => {
    assert.deepEqual(
      entries.map((e) => e.id).sort(),
      Object.keys(tables).sort(),
      "les deux projections doivent porter le même ensemble de tables",
    );
  });

  test("LIVE si et seulement si le code référence la table ; UNKNOWN sinon", () => {
    const mismatches: string[] = [];
    let live = 0;
    let unknown = 0;
    for (const e of entries) {
      const usedBy = tables[e.id]?.used_by ?? [];
      const expected = usedBy.length > 0 ? "LIVE" : "UNKNOWN";
      if (e.status !== expected) {
        mismatches.push(`${e.id}: status=${e.status}, attendu ${expected}`);
      }
      if (e.status === "LIVE") live++;
      if (e.status === "UNKNOWN") unknown++;
    }
    assert.deepEqual(mismatches, [], "le status L1 doit dériver des seuls callsites");

    // Non-vacuité des DEUX classes : sans elles, une règle redevenue constante
    // (tout LIVE, ou tout UNKNOWN) passerait l'assertion ci-dessus dès que
    // l'autre projection dérive dans le même sens.
    assert.ok(live > 0, "aucune table LIVE : le croisement des callsites est mort");
    assert.ok(
      unknown > 0,
      "aucune table UNKNOWN : la branche est redevenue inatteignable " +
        "(c'est exactement le défaut que ce test existe pour attraper)",
    );
  });

  test("aucune candidate_orphan_table de db-usage-map n'est publiée LIVE", () => {
    // Croise la classification indépendante du producteur amont : une table
    // qu'il juge sans callsite ne peut pas ressortir LIVE du registre.
    const candidates: Array<{ name: string }> = usage.candidate_orphan_tables ?? [];
    assert.ok(
      candidates.length > 0,
      "db-usage-map ne publie plus de candidate_orphan_tables : relire le producteur, " +
        "ce test serait vacant",
    );
    const byId = new Map(entries.map((e) => [e.id, e]));
    const liveOrphans = candidates
      .map((c) => c.name)
      .filter((name) => byId.get(name)?.status === "LIVE");
    assert.deepEqual(
      liveOrphans,
      [],
      "une table sans callsite est publiée LIVE : la migration fait de nouveau foi d'usage",
    );
  });
});
