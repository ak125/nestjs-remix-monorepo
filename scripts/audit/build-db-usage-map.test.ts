/**
 * scripts/audit/build-db-usage-map.test.ts — premier test de ce générateur.
 *
 * Il n'en avait aucun, seul de `scripts/audit/` dans ce cas, parce qu'il n'avait
 * aucun seam : `main()` était appelé nu, donc l'importer réécrivait
 * `audit/db-usage-map.json`. Le premier test ci-dessous vérifie précisément que
 * ce n'est plus vrai — sans quoi aucun des suivants ne serait fiable.
 *
 * DISCIPLINE D'ASSERTION. Aucune égalité sur un cardinal de corpus. `HEAD` bouge
 * (deux fois pendant la seule séance d'analyse de ce correctif) : figer
 * « exactement N call-sites » ferait rougir la garde au premier `Array.from`
 * légitime ajouté au dépôt. On assure des INVARIANTS et des SENTINELLES.
 *
 * ANTI-OVERCLAIM. Chaque cas de régression prouve d'abord, via un oracle qui
 * reproduit la RÈGLE LEGACY, que l'ancien scanner acceptait bien le fantôme.
 * Sans cela le test serait vert sans exercer la régression.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as ts from "typescript";

const {
  scanCallSites,
  scanMigrations,
  classifyCallSite,
} = require("./build-db-usage-map.js");

const REPO_ROOT = path.join(__dirname, "..", "..");
const ARTIFACT = path.join(REPO_ROOT, "audit", "db-usage-map.json");

/** Classe le premier appel `.from()` / `.rpc()` trouvé dans un extrait. */
function classifySnippet(code: string): { kind: string; reason: string } | null {
  const sf = ts.createSourceFile("t.ts", code, ts.ScriptTarget.Latest, true);
  let out: { kind: string; reason: string } | null = null;
  const visit = (n: ts.Node) => {
    if (
      !out &&
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.name) &&
      (n.expression.name.text === "from" || n.expression.name.text === "rpc")
    ) {
      out = classifyCallSite(ts, n, n.expression.name.text);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Oracle de la RÈGLE LEGACY : tout `.from()`/`.rpc()` à argument littéral était accepté. */
function legacyWouldRecord(code: string): string | null {
  const sf = ts.createSourceFile("t.ts", code, ts.ScriptTarget.Latest, true);
  let name: string | null = null;
  const visit = (n: ts.Node) => {
    if (
      !name &&
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.name) &&
      (n.expression.name.text === "from" || n.expression.name.text === "rpc")
    ) {
      const a = n.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) {
        name = a.text;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return name;
}

describe("seam — importer le module ne doit rien écrire", () => {
  test("audit/db-usage-map.json est inchangé après require()", () => {
    const sha = () =>
      crypto.createHash("sha256").update(fs.readFileSync(ARTIFACT)).digest("hex");
    const before = sha();
    delete require.cache[require.resolve("./build-db-usage-map.js")];
    require("./build-db-usage-map.js");
    assert.equal(before, sha(), "le require a réécrit l'artefact : le seam est absent");
  });
});

describe("récepteur — cas NÉGATIFS (fantômes)", () => {
  test("Buffer.from(<base64>) — le fantôme historique", () => {
    // copie de backend/src/modules/cart/controllers/cart-recovery.controller.ts:8
    const code =
      "const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');";
    assert.equal(
      legacyWouldRecord(code),
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "précondition : l'ancienne règle enregistrait bien ce nom",
    );
    assert.deepEqual(classifySnippet(code), {
      kind: "NOT_DB",
      reason: "js-builtin-static-from",
      recvText: "Buffer",
    });
  });

  test("bucket Storage — ce qu'une simple liste noire de globaux NE voit pas", () => {
    const code = "await this.supabase.storage.from('uploads').upload(p, f.buffer);";
    assert.equal(legacyWouldRecord(code), "uploads", "précondition");
    const r = classifySnippet(code)!;
    assert.equal(r.kind, "NOT_DB");
    assert.equal(r.reason, "supabase-storage-bucket");
  });

  test("Array et TypedArray, au-delà des seuls cas présents aujourd'hui", () => {
    for (const recv of ["Array", "Uint8Array", "Float64Array", "Object"]) {
      const r = classifySnippet(`const x = ${recv}.from('abc');`)!;
      assert.equal(r.kind, "NOT_DB", `${recv}.from doit être rejeté`);
      assert.equal(r.reason, "js-builtin-static-from");
    }
  });
});

describe("récepteur — cas POSITIFS (ne jamais perdre)", () => {
  const CASES: Array<[string, string]> = [
    [
      "accès indexé, zone STOP paiement",
      "await this.paymentDataService['supabase'].from('__paybox_gate_log').insert(row);",
    ],
    [
      "accès indexé, zone image interdite",
      "this.searchService['client'].from('pieces_media_img').select('*');",
    ],
    [
      "parenthèse + cast as any (ce que le TypeChecker perdait)",
      "(this.dataService as any).supabase.from('__diag_maintenance_operation').select('*');",
    ],
    [
      "identifiant nu court, tunnel de commande",
      "await sb.from('___xtr_order').update({ ord_is_pay: '1' });",
    ],
  ];
  for (const [label, code] of CASES) {
    test(`DB — ${label}`, () => {
      const r = classifySnippet(code)!;
      assert.equal(r.kind, "DB", `${label} doit rester un appel DB`);
    });
  }

  test("les 5 verbes du vocabulaire minimal, un par un", () => {
    for (const verb of ["select", "insert", "update", "upsert", "delete"]) {
      const r = classifySnippet(`this.supabase.from('t').${verb}('*');`)!;
      assert.equal(r.kind, "DB");
      assert.equal(r.reason, `postgrest-chain:${verb}`);
    }
  });

  test("`.rpc()` NON chaîné reste DB — 14 des 15 appels réels sont dans ce cas", () => {
    const r = classifySnippet(
      "const { data } = await this.supabase.rpc('mark_order_paid_atomic', { p: 1 });",
    )!;
    assert.equal(r.kind, "DB", "appliquer le chaînage à .rpc() détruirait 14/14 noms de RPC");
    assert.equal(r.reason, "rpc-call");
  });
});

describe("indécidable — visible, jamais jeté", () => {
  test("un objet local homonyme part en UNRESOLVED, pas en DB ni en silence", () => {
    const r = classifySnippet(
      "const emitter = { from: (s: string) => s }; emitter.from('not_a_table');",
    )!;
    assert.equal(r.kind, "UNRESOLVED");
  });

  test("le motif latent `const q = sb.from('t'); q.select()` est UNRESOLVED", () => {
    // 0 occurrence mesurée aujourd'hui, mais forme légale. Si elle apparaît, elle
    // doit devenir visible — et NON disparaître silencieusement de l'inventaire.
    const r = classifySnippet("const q = sb.from('t');")!;
    assert.equal(r.kind, "UNRESOLVED", "sans ce filet, la règle de chaînage serait un drop silencieux");
  });
});

describe("intégration — sur le dépôt réel", () => {
  const cs = scanCallSites(ts);
  const mig = scanMigrations();

  test("les fantômes de récepteur ne sont plus des tables", () => {
    for (const ghost of [
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "uploads",
    ]) {
      assert.ok(!cs.tableUses.has(ghost), `${ghost} ne doit plus être une table`);
    }
  });

  test("les fantômes SQL ne sont plus attestés par une migration", () => {
    for (const ghost of [
      "sont",
      "_acc_eligible",
      "_disp_eligible",
      "_disp_quarantine_eligible",
      "_gamme_disp_eligible",
    ]) {
      assert.ok(!mig.tablesInMig.has(ghost), `${ghost} ne doit plus être une table de migration`);
    }
  });

  test("les objets effacés par un rollback commenté sont revenus", () => {
    for (const t of [
      "__seo_r8_fingerprints",
      "__seo_r8_keyword_plan",
      "__seo_r8_similarity_index",
      "__seo_entity_sources",
    ]) {
      assert.ok(mig.tablesInMig.has(t), `${t} est créée par une migration et doit être attestée`);
    }
    for (const fn of [
      "__rls_lock_internal_table",
      "__rls_reconcile_internal_tables",
      "refresh_seo_projection_mvs",
    ]) {
      assert.ok(mig.rpcInMig.has(fn), `${fn} est créée par une migration et doit être attestée`);
    }
  });

  test("sentinelles de non-perte — usage préservé", () => {
    for (const t of [
      "__paybox_gate_log",
      "pieces_media_img",
      "___xtr_order",
      "pieces",
      "pieces_price",
      "__diag_maintenance_operation",
    ]) {
      assert.ok(cs.tableUses.has(t), `${t} a perdu son call-site — sur-correction`);
    }
    assert.ok(cs.rpcUses.has("mark_order_paid_atomic"));
  });

  test("bornes de population — inégalités, jamais des cardinaux figés", () => {
    assert.ok(cs.tableUses.size >= 195, `tableUses=${cs.tableUses.size}, effondrement suspect`);
    assert.ok(cs.rpcUses.size >= 14, `rpcUses=${cs.rpcUses.size}, effondrement suspect`);
    assert.ok(mig.tablesInMig.size >= 185, `tablesInMig=${mig.tablesInMig.size}`);
  });

  test("inventaire des raisons d'exclusion CLOS", () => {
    const reasons = new Set(cs.dropped.map((d: any) => d.reason));
    for (const r of reasons) {
      assert.ok(
        ["js-builtin-static-from", "supabase-storage-bucket"].includes(r as string),
        `raison d'exclusion inconnue : ${r} — toute exclusion doit être nommée`,
      );
    }
  });

  test("aucun call-site non résolu aujourd'hui", () => {
    assert.equal(
      cs.unresolved.length,
      0,
      "un UNRESOLVED n'est PAS un seuil à assouplir : soit le récepteur est un " +
        "client DB et la règle de chaînage doit couvrir sa forme, soit il ne l'est " +
        "pas et sa raison d'exclusion doit être nommée. Citer le call-site dans la PR.\n" +
        JSON.stringify(cs.unresolved, null, 2),
    );
  });
});
