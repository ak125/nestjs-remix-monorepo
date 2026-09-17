/**
 * tests/registry/sql-lex.test.ts — couvre le région-lexer partagé
 * `scripts/registry/lib/sql-lex.js`.
 *
 * Per ADR-058 invariant V1-2 « Déterminisme strict » : le lexer est pur, sans
 * dépendance ni I/O, donc sa sortie ne dépend pas de la machine.
 *
 * INVARIANT CENTRAL testé en premier : les deux vues ont la MÊME longueur que
 * l'entrée. C'est ce qui garantit que les numéros de ligne des artefacts
 * générés restent exacts après dépouillement.
 *
 * Les cas « régression réelle » ci-dessous ne sont pas inventés : ce sont les
 * lignes exactes de `backend/supabase/migrations/**` qui effaçaient 9 tables et
 * 5 fonctions de l'inventaire, ou y fabriquaient des fantômes.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const {
  lexViews,
  maskComments,
} = require("../../scripts/registry/lib/sql-lex.js");

const REPO_ROOT = path.join(__dirname, "..", "..");

/** Toute entrée doit produire deux vues de longueur identique à l'entrée. */
function assertSameLength(sql: string, label: string) {
  const { topLevel, commentsMasked } = lexViews(sql);
  assert.equal(topLevel.length, sql.length, `topLevel décalé — ${label}`);
  assert.equal(commentsMasked.length, sql.length, `commentsMasked décalé — ${label}`);
}

describe("invariant d'offsets", () => {
  const CASES: Array<[string, string]> = [
    ["commentaire ligne", "-- x\nSELECT 1;"],
    ["commentaire bloc", "/* x */ SELECT 1;"],
    ["bloc imbriqué", "/* a /* b */ c */ SELECT 1;"],
    ["chaîne", "SELECT 'a''b';"],
    ["chaîne E", "SELECT E'a\\'b';"],
    ["identifiant quoté", 'SELECT "a""b";'],
    ["dollar anonyme", "DO $$ BEGIN END $$;"],
    ["dollar taggé", "DO $fn$ BEGIN END $fn$;"],
    ["bloc non terminé", "/* jamais fermé"],
    ["chaîne non terminée", "SELECT 'jamais fermée"],
    ["dollar non terminé", "DO $$ jamais fermé"],
    ["vide", ""],
  ];
  for (const [label, sql] of CASES) {
    test(`même longueur — ${label}`, () => assertSameLength(sql, label));
  }

  test("aucune construction non terminée ne jette", () => {
    for (const [, sql] of CASES) {
      assert.doesNotThrow(() => lexViews(sql));
    }
  });
});

describe("séparation code / non-code", () => {
  test("un commentaire ligne est blanchi dans les DEUX vues, newline préservé", () => {
    const sql = "-- CREATE TABLE fake\nCREATE TABLE real_t();";
    const { topLevel, commentsMasked } = lexViews(sql);
    assert.ok(!/CREATE TABLE fake/.test(topLevel));
    assert.ok(!/CREATE TABLE fake/.test(commentsMasked));
    assert.ok(/CREATE TABLE real_t/.test(commentsMasked));
    assert.equal(sql.split("\n").length, commentsMasked.split("\n").length);
  });

  test("une chaîne est préservée dans commentsMasked, blanchie dans topLevel", () => {
    const sql = "SELECT 'CREATE TABLE inside_string';";
    const { topLevel, commentsMasked } = lexViews(sql);
    assert.ok(/inside_string/.test(commentsMasked), "la chaîne doit survivre au parsing");
    assert.ok(!/inside_string/.test(topLevel), "la chaîne ne doit pas être détectable");
  });

  test("un double tiret DANS une chaîne n'ouvre PAS un commentaire", () => {
    const sql = "SELECT '-- pas un commentaire', real_col FROM t;";
    const masked = maskComments(sql);
    assert.ok(/real_col/.test(masked), "le code après la chaîne doit survivre");
    assert.ok(/pas un commentaire/.test(masked));
  });

  test("un commentaire DANS un corps dollar-quoté ne mange pas le corps", () => {
    const sql = "DO $$ -- interne\n SELECT keep_me; $$;";
    const { commentsMasked } = lexViews(sql);
    assert.ok(/keep_me/.test(commentsMasked), "le corps dollar-quoté est préservé");
  });

  test("les blocs imbriqués se ferment au bon niveau", () => {
    const sql = "/* a /* b */ c */ SELECT after_block;";
    const masked = maskComments(sql);
    assert.ok(/after_block/.test(masked), "le code après un bloc imbriqué doit survivre");
    assert.ok(!/ b /.test(masked));
  });

  test("`amount$rate` est UN identifiant, pas une ouverture de dollar-quote", () => {
    const sql = "SELECT amount$rate, still_code FROM t;";
    const masked = maskComments(sql);
    assert.ok(/still_code/.test(masked), "le reste de la requête doit rester du code");
  });
});

describe("régressions réelles du dépôt", () => {
  test("un DROP TABLE de documentation n'est plus lu comme du DDL", () => {
    // backend/supabase/migrations/20260311142250_r8_diversity_system.sql:538
    const sql = [
      "-- Rollback (documentation seule — NON exécuté par ce fichier) :",
      "--     DROP TABLE IF EXISTS public.__seo_r8_pages CASCADE;",
      "SELECT 1;",
    ].join("\n");
    const masked = maskComments(sql);
    assert.ok(
      !/DROP TABLE/i.test(masked),
      "le DROP commenté effaçait 9 tables réelles de l'inventaire",
    );
  });

  test("un CREATE TABLE cité dans un commentaire ne crée plus la table fantôme `sont`", () => {
    // backend/supabase/migrations/20260621_pricing_partition_rotation_cron.down.sql:4
    const sql =
      "-- partition (les CREATE TABLE IF NOT EXISTS sont des données — non détruites).\nSELECT 1;";
    assert.ok(!/CREATE TABLE/i.test(maskComments(sql)));
  });

  test("un CREATE FUNCTION commenté ne fabrique plus de surcharge fantôme", () => {
    // backend/supabase/migrations/20260604_pricing_commit_chunk_import_pending_mode.sql:155
    const sql =
      "-- CREATE OR REPLACE FUNCTION pricing_commit_chunk(\nSELECT 1;";
    assert.ok(!/CREATE OR REPLACE FUNCTION/i.test(maskComments(sql)));
  });

  test("sur les migrations réelles, le lexer préserve la longueur de CHAQUE fichier", () => {
    const dir = path.join(REPO_ROOT, "backend", "supabase", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
    assert.ok(files.length > 0, "aucune migration trouvée — le test ne prouverait rien");
    for (const f of files) {
      assertSameLength(fs.readFileSync(path.join(dir, f), "utf8"), f);
    }
  });
});

describe("garde anti-duplication", () => {
  // Le lexer vivait inline dans build-rpc-registry.js (PR #1227), donc
  // inutilisable ailleurs. S'il y est réintroduit localement, le dépôt porterait
  // DEUX lexers divergents. Ce test rend la duplication visible au lieu de la
  // laisser s'installer silencieusement.
  test("build-rpc-registry.js ne redéfinit pas le lexer localement", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "scripts", "registry", "build-rpc-registry.js"),
      "utf8",
    );
    for (const fn of ["lexViews", "maskComments"]) {
      assert.ok(
        !new RegExp(`function\\s+${fn}\\s*\\(`).test(src),
        `build-rpc-registry.js redéfinit ${fn}() localement. Le lexer partagé est ` +
          `scripts/registry/lib/sql-lex.js — l'importer au lieu d'en garder une copie.`,
      );
    }
  });
});
