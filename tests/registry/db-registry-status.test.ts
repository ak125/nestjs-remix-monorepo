/**
 * tests/registry/db-registry-status.test.ts — règle `status` des tables dans
 * `audit/registry/db.json`, et croisement avec `audit/db-usage-map.json`.
 *
 * Contrat : `StatusSchema` (`packages/registry/src/shared/status.ts`) —
 * `LIVE` = « inbound references », `UNKNOWN` = « indéterminable, JAMAIS forcer
 * une classification » (même principe qu'ADR-058 V1-3, ADR au statut
 * `proposed`).
 *
 * `build-db-registry.js` publie l'UNION des tables vues par le scan : celles
 * où le scan relève un callsite (`used_by_count > 0`) et celles qu'une
 * migration déclare (`in_migrations`). L'ancienne règle `status = hasUsage ||
 * hasMigrations ? "LIVE" : "UNKNOWN"` était donc vraie pour toute table
 * publiée (314 entrées sur 314 en `LIVE` à la date du correctif) : la branche
 * `UNKNOWN` était inatteignable par construction.
 *
 * Cas d'origine : `__seo_role_template_pool`. Sa migration `20260509_…` est
 * inscrite au ledger des migrations par un baseline, sans exécution ; la table
 * n'existe pas en base. Le registre la publiait pourtant `LIVE`. Le code la
 * référence bien — l'enricher R8 tente de la lire à chaque enrichissement via
 * `SeoRoleTemplateSelector` → `SeoSwitchSelector.fetchVariants()` →
 * `.from(config.table)`, la table venant de `seo-variant-family.registry.ts` —
 * mais par un `.from(<variable>)` que le scan ne résout pas
 * (`binding-not-literal`) : `db-usage-map.json` la range donc dans
 * `candidate_orphan_tables`, et elle sort `UNKNOWN`.
 *
 * Prédicat exact de `LIVE` : le scan statique de `db-usage-map` relève au
 * moins un `.from()` de `backend/src` à argument littéral ou résolu en 1 saut.
 * Ce n'est PAS « le code référence la table » : une table atteinte seulement
 * par un `.from(<variable>)` non résolu (lecture ou écriture réelle) sort
 * `UNKNOWN`. Sous-détection connue du scan, non un verdict de mort ;
 * l'élargir relève du résolveur de `build-db-usage-map.js`.
 *
 * Contrat de périmètre : ce producteur est un scan HORS-LIGNE. Il ne connaît
 * pas la base. L'existence réelle d'une table appartient au ratchet ledger ↔
 * catalogue (`scripts/audit/check-ledger-catalog-ratchet.py`) — ce test ne la
 * vérifie pas et ne doit pas se mettre à la vérifier (ce serait un second
 * détecteur).
 *
 * Indépendance vis-à-vis des données : aucune assertion ne nomme une table ni
 * n'exige qu'il en existe d'une classe donnée. La non-vacuité de la règle
 * (elle n'est pas constante) est prouvée sur des entrées fixes ; les
 * croisements sur les projections réelles restent vrais dans un dépôt où
 * toutes les tables orphelines auraient disparu.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { classifyTableStatus } from "../../scripts/registry/build-db-registry.js";

const REPO_ROOT = path.join(__dirname, "..", "..");
const usage = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "audit", "db-usage-map.json"), "utf8"),
);
const registry = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "audit", "registry", "db.json"), "utf8"),
);
const entries: Array<{ id: string; status: string }> = registry.entries;
const tables: Record<string, { used_by?: unknown[] }> = usage.tables ?? {};

describe("règle de statut (entrées fixes, indépendante des données du dépôt)", () => {
  test("une table seulement déclarée par une migration sort UNKNOWN", () => {
    assert.equal(
      classifyTableStatus({ used_by_count: 0, in_migrations: ["20260509_x.sql"] }),
      "UNKNOWN",
      "la migration fait de nouveau foi d'usage",
    );
  });

  test("une table dont le scan relève un callsite sort LIVE", () => {
    assert.equal(classifyTableStatus({ used_by_count: 1, in_migrations: [] }), "LIVE");
    assert.equal(
      classifyTableStatus({ used_by_count: 3, in_migrations: ["20260509_x.sql"] }),
      "LIVE",
    );
  });

  test("une entrée sans compteur sort UNKNOWN (jamais forcer)", () => {
    assert.equal(classifyTableStatus({}), "UNKNOWN");
  });
});

describe("croisement db-usage-map → db.json (status)", () => {
  test("db.json publie exactement les tables de db-usage-map", () => {
    assert.deepEqual(
      entries.map((e) => e.id).sort(),
      Object.keys(tables).sort(),
      "les deux projections doivent porter le même ensemble de tables",
    );
  });

  test("LIVE si et seulement si db-usage-map relève un callsite (used_by non vide) ; UNKNOWN sinon", () => {
    // Lecture indépendante de celle du builder (`used_by` ici, `used_by_count`
    // là-bas) : le croisement vérifie la spécification, pas la recopie.
    const mismatches: string[] = [];
    for (const e of entries) {
      const usedBy = tables[e.id]?.used_by ?? [];
      const expected = usedBy.length > 0 ? "LIVE" : "UNKNOWN";
      if (e.status !== expected) {
        mismatches.push(`${e.id}: status=${e.status}, attendu ${expected}`);
      }
    }
    assert.deepEqual(mismatches, [], "le status L1 doit dériver des seuls callsites relevés par le scan");
  });

  test("aucune candidate_orphan_table de db-usage-map n'est publiée LIVE", () => {
    // Croise la classification indépendante du producteur amont : une table
    // qu'il juge sans callsite ne peut pas ressortir LIVE du registre.
    const candidates: Array<{ name: string }> = usage.candidate_orphan_tables ?? [];
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
