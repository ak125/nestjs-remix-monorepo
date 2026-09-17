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

/* ────────────────────────────────────────────────────────────────────────────
 * RÉSOLUTION DES CONSTANTES — `.from(<constante>)`
 *
 * 771 call-sites passent une constante au lieu d'un littéral. Le scan ne les
 * nomme pas, donc des tables vivantes portent `used_by = 0` et basculent en
 * candidates orphelines.
 *
 * HIÉRARCHIE D'ERREUR, écrite ici parce qu'elle gouverne chaque assertion :
 * un faux « utilisée » est PLUS GRAVE qu'un faux « orpheline ». Une table qui
 * reste à tort dans la liste sera relue avant toute suppression ; une table qui
 * en sort à tort ne sera plus jamais questionnée. Donc, au moindre doute, on
 * REFUSE de résoudre — et un refus est nommé, jamais silencieux.
 *
 * PÉRIMÈTRE V1, testé et non tacite : l'univers de résolution est le corpus
 * déjà scanné (`git ls-files backend/src`). Aucun spécificateur nu (`@repo/*`)
 * n'est franchi. Le test correspondant tombera le jour où ce saut arrivera —
 * c'est voulu : il matérialise la décision au lieu de la laisser implicite.
 * ──────────────────────────────────────────────────────────────────────────── */

const {
  describeDynamicArg,
  collectFileSymbols,
  resolveRelativeSpecifier,
  resolveRootBinding,
  RESOLUTION_REFUSAL_REASONS,
} = require("./build-db-usage-map.js");

/** Parse un extrait et rend le SourceFile + le premier argument de `.from()`. */
function firstFromArg(code: string, file = "backend/src/a.ts") {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  let arg: ts.Node | null = null;
  const visit = (n: ts.Node) => {
    if (
      !arg &&
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.name) &&
      n.expression.name.text === "from" &&
      n.arguments[0]
    ) {
      arg = n.arguments[0];
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { sf, arg: arg as unknown as ts.Node };
}

/** Construit la table de symboles d'un corpus synthétique {chemin: source}. */
function symbolsOf(corpus: Record<string, string>) {
  const byFile = new Map<string, any>();
  for (const [f, code] of Object.entries(corpus)) {
    const sf = ts.createSourceFile(f, code, ts.ScriptTarget.Latest, true);
    byFile.set(f, collectFileSymbols(ts, sf));
  }
  return { byFile, corpus: new Set(Object.keys(corpus)) };
}

/** Résout le premier `.from(<x>)` du fichier `entry` dans ce corpus. */
function resolveIn(corpus: Record<string, string>, entry: string) {
  const { byFile, corpus: corpusSet } = symbolsOf(corpus);
  const { arg } = firstFromArg(corpus[entry], entry);
  const desc = describeDynamicArg(ts, arg);
  return resolveRootBinding(ts, arg, desc, entry, byFile, corpusSet);
}

describe("résolution — description syntaxique de l'argument", () => {
  test("OBJ.CLE rend la racine ET la clé, jamais l'objet seul", () => {
    const { arg } = firstFromArg(`sb.from(TABLES.fingerprints).select('*')`);
    assert.deepEqual(describeDynamicArg(ts, arg), {
      form: "OBJ.KEY",
      root: "TABLES",
      key: "fingerprints",
    });
  });

  test("this.CHAMP est une forme distincte", () => {
    const { arg } = firstFromArg(`class S { m(){ this.sb.from(this.TABLE).select('*'); } }`);
    assert.deepEqual(describeDynamicArg(ts, arg), {
      form: "THIS_FIELD", root: "this", key: "TABLE",
    });
  });

  test("un identifiant simple est une forme distincte", () => {
    const { arg } = firstFromArg(`sb.from(TABLE).select('*')`);
    assert.deepEqual(describeDynamicArg(ts, arg), { form: "IDENT", root: "TABLE", key: null });
  });

  test("l'accès indexé OBJ['x'] n'est PAS traité en v1 — forme refusée, pas devinée", () => {
    const { arg } = firstFromArg(`sb.from(TABLES['fingerprints']).select('*')`);
    const d = describeDynamicArg(ts, arg);
    assert.equal(d.form, "UNSUPPORTED");
  });

  test("une clé calculée OBJ[v] est refusée — c'est la porte du faux « utilisée »", () => {
    const { arg } = firstFromArg(`sb.from(TABLES[k]).select('*')`);
    assert.equal(describeDynamicArg(ts, arg).form, "UNSUPPORTED");
  });
});

describe("résolution — même fichier", () => {
  test("const de premier niveau, objet littéral : la clé accédée est résolue", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `const T = { fp: '__seo_r8_fingerprints', qa: '__seo_r8_qa_reviews' } as const;\nsb.from(T.fp).select('*');` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, "__seo_r8_fingerprints");
  });

  test("SEULE la clé accédée est créditée — jamais les autres clés de l'objet", () => {
    const { byFile } = symbolsOf({
      "backend/src/a.ts": `const T = { fp: '__seo_r8_fingerprints', qa: '__seo_r8_qa_reviews' } as const;\nsb.from(T.fp).select('*');`,
    });
    const syms = byFile.get("backend/src/a.ts");
    // L'objet est connu en entier (c'est nécessaire pour indexer la clé)…
    assert.equal(syms.objects.get("T").get("qa"), "__seo_r8_qa_reviews");
    // …mais la résolution d'un call-site sur `fp` ne rend QUE `fp`.
    const r = resolveIn(
      { "backend/src/a.ts": `const T = { fp: '__seo_r8_fingerprints', qa: '__seo_r8_qa_reviews' } as const;\nsb.from(T.fp).select('*');` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, "__seo_r8_fingerprints");
    assert.notEqual(r.table, "__seo_r8_qa_reviews");
  });

  test("une clé absente de l'objet est un refus nommé, pas un null silencieux", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `const T = { fp: 'x' } as const;\nsb.from(T.absente).select('*');` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "key-not-in-object");
  });

  test("const local à valeur littérale", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `const TABLE = '__claims';\nsb.from(TABLE).select('*');` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, "__claims");
  });

  test("const à initialiseur NON littéral : refus nommé", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `const TABLE = MAP[k];\nsb.from(TABLE).select('*');` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "binding-not-literal");
  });

  test("un paramètre de fonction n'est jamais résolu", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `function q(table: string){ return sb.from(table).select('*'); }` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "binding-not-found");
  });
});

describe("résolution — champ de classe, la frontière stricte", () => {
  test("private readonly, jamais réaffecté : résolu", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `class S { private readonly TABLE = '__claims'; m(){ return this.sb.from(this.TABLE).select('*'); } }` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, "__claims");
  });

  test("protected est REFUSÉ — redéclarable en sous-classe", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `class S { protected readonly TABLE = '__claims'; m(){ return this.sb.from(this.TABLE).select('*'); } }` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "class-field-not-private-readonly");
  });

  test("public est REFUSÉ pour la même raison", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `class S { readonly TABLE = '__claims'; m(){ return this.sb.from(this.TABLE).select('*'); } }` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "class-field-not-private-readonly");
  });

  test("private readonly mais RÉAFFECTÉ ailleurs dans la classe : refusé", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `class S { private readonly TABLE = '__claims'; init(){ (this as any).TABLE = '__autre'; } m(){ return this.sb.from(this.TABLE).select('*'); } }` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "class-field-reassigned");
  });

  test("deux classes du même fichier, même nom de champ, valeurs différentes : refus", () => {
    const r = resolveIn(
      { "backend/src/a.ts": `class A { private readonly TABLE = '__un'; }\nclass B { private readonly TABLE = '__deux'; m(){ return this.sb.from(this.TABLE).select('*'); } }` },
      "backend/src/a.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "ambiguous-class-field");
  });
});

describe("résolution — traversée d'import, bornée au corpus scanné", () => {
  const CONSTS = `export const R8_TABLES = { fingerprints: '__seo_r8_fingerprints', keywordPlan: '__seo_r8_keyword_plan' } as const;`;

  test("import relatif vers un fichier DU corpus : résolu", () => {
    const r = resolveIn(
      {
        "backend/src/config/c.ts": CONSTS,
        "backend/src/mod/s.ts": `import { R8_TABLES } from '../config/c';\nsb.from(R8_TABLES.fingerprints).select('*');`,
      },
      "backend/src/mod/s.ts",
    );
    assert.equal(r.table, "__seo_r8_fingerprints");
  });

  test("import relatif vers un fichier ABSENT du corpus : refus nommé", () => {
    const r = resolveIn(
      { "backend/src/mod/s.ts": `import { R8_TABLES } from '../config/absent';\nsb.from(R8_TABLES.fingerprints).select('*');` },
      "backend/src/mod/s.ts",
    );
    assert.equal(r.table, null);
    assert.equal(r.refusal, "import-outside-scanned-corpus");
  });

  test("PÉRIMÈTRE V1 — un spécificateur nu @repo/* n'est PAS franchi", () => {
    const r = resolveIn(
      { "backend/src/mod/s.ts": `import { TABLES } from '@repo/database-types';\nsb.from(TABLES.pieces).select('*');` },
      "backend/src/mod/s.ts",
    );
    assert.equal(r.table, null);
    assert.equal(
      r.refusal,
      "import-outside-scanned-corpus",
      "le jour où le saut workspace arrivera, ce test tombera — c'est le signal, pas un bug",
    );
  });

  test("la traversée est à UN saut : un ré-export n'est pas suivi", () => {
    const r = resolveIn(
      {
        "backend/src/config/c.ts": CONSTS,
        "backend/src/config/index.ts": `export { R8_TABLES } from './c';`,
        "backend/src/mod/s.ts": `import { R8_TABLES } from '../config/index';\nsb.from(R8_TABLES.fingerprints).select('*');`,
      },
      "backend/src/mod/s.ts",
    );
    assert.equal(r.table, null, "un baril de ré-export n'est pas traversé en v1");
    assert.equal(r.refusal, "binding-not-found");
  });

  test("résolution de spécificateur : seuls les chemins DU corpus sont rendus", () => {
    const corpus = new Set(["backend/src/config/c.ts", "backend/src/mod/s.ts"]);
    assert.equal(resolveRelativeSpecifier("backend/src/mod/s.ts", "../config/c", corpus), "backend/src/config/c.ts");
    assert.equal(resolveRelativeSpecifier("backend/src/mod/s.ts", "../config/nope", corpus), null);
    assert.equal(resolveRelativeSpecifier("backend/src/mod/s.ts", "@repo/database-types", corpus), null);
  });
});

describe("résolution — l'inventaire des refus est CLOS", () => {
  test("RESOLUTION_REFUSAL_REASONS est exporté par le générateur, pas ré-énuméré côté test", () => {
    assert.ok(Array.isArray(RESOLUTION_REFUSAL_REASONS) || RESOLUTION_REFUSAL_REASONS instanceof Set);
  });

  test("toute raison produite par les cas ci-dessus appartient à l'inventaire", () => {
    const set = new Set(RESOLUTION_REFUSAL_REASONS);
    const cas: Record<string, string> = {
      "backend/src/k.ts": `const T = { a: 'x' } as const;\nsb.from(T.b).select('*');`,
      "backend/src/l.ts": `const T = MAP[k];\nsb.from(T).select('*');`,
      "backend/src/m.ts": `function q(t: string){ return sb.from(t).select('*'); }`,
      "backend/src/n.ts": `class S { readonly T = 'x'; m(){ return this.sb.from(this.T).select('*'); } }`,
      "backend/src/o.ts": `import { X } from '@repo/database-types';\nsb.from(X.y).select('*');`,
    };
    for (const [f, code] of Object.entries(cas)) {
      const r = resolveIn({ [f]: code }, f);
      assert.equal(r.table, null, `${f} ne doit pas résoudre`);
      assert.ok(set.has(r.refusal), `raison hors inventaire : ${r.refusal} (${f})`);
    }
  });
});

describe("résolution — sentinelles sur le dépôt réel", () => {
  const art = () => JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));

  test("les 2 tables R8 sans aucun call-site RESTENT candidates", () => {
    const a = art();
    const cand = new Set(a.candidate_orphan_tables.map((c: any) => c.name));
    for (const t of ["__seo_r8_engine_family_stats", "__seo_r8_keyword_plan"]) {
      assert.equal(a.tables[t].used_by_count, 0, `${t} ne doit gagner aucun usage`);
      assert.ok(
        cand.has(t),
        `${t} doit RESTER candidate : R8_TABLES la déclare mais AUCUN call-site ne l'accède. ` +
          `La blanchir au motif que R8 est un chantier actif produirait le faux « utilisée », ` +
          `dont on ne revient pas — une table qui sort d'une liste de revue à tort n'y est jamais réexaminée.`,
      );
    }
  });

  test("les tables R8 réellement accédées ont quitté la liste, avec leur preuve dans l'artefact", () => {
    const a = art();
    const cand = new Set(a.candidate_orphan_tables.map((c: any) => c.name));
    const resolus = new Set(
      a.dynamic_from_callsites.filter((d: any) => d.resolved_table).map((d: any) => d.resolved_table),
    );
    for (const t of [
      "__seo_r8_fingerprints", "__seo_r8_page_versions",
      "__seo_r8_qa_reviews", "__seo_r8_regeneration_queue", "__seo_r8_similarity_index",
    ]) {
      assert.ok(!cand.has(t), `${t} devrait être sortie de la liste`);
      assert.ok(resolus.has(t), `${t} doit être TRAÇABLE : au moins un call-site résolu la nomme`);
      assert.ok(a.tables[t].used_by_count >= 1, `${t} doit porter un usage`);
    }
  });

  test("traçabilité — toute table résolue pointe un fichier suivi et une ligne contenant `.from(`", () => {
    const a = art();
    const vus = new Map<string, any>();
    for (const d of a.dynamic_from_callsites) if (d.resolved_table && !vus.has(d.resolved_table)) vus.set(d.resolved_table, d);
    assert.ok(vus.size > 0, "au moins une résolution attendue");
    for (const [t, d] of vus) {
      const f = path.join(REPO_ROOT, d.file);
      assert.ok(fs.existsSync(f), `${t} : ${d.file} introuvable`);
      // `lineOf()` enregistre le début de la CallExpression, pas le token `.from`.
      // Sur une chaîne multi-ligne (`await this.supabase\n  .from(X)`), la ligne
      // pointe donc le récepteur. Propriété PRÉEXISTANTE, partagée avec
      // `dropped_call_sites` ; la corriger déplacerait des numéros de ligne hors
      // du périmètre de cette PR. On assure donc que l'appel est atteignable
      // depuis la ligne enregistrée, ce qui suffit à prouver la traçabilité et
      // rougit toujours si le numéro devient faux.
      const lignes = fs.readFileSync(f, "utf8").split("\n");
      const fenetre = lignes.slice(d.line - 1, d.line + 3).join("\n");
      assert.ok(
        fenetre.includes(".from("),
        `${t} : aucun '.from(' dans ${d.file}:${d.line}..${d.line + 3} — « ${(lignes[d.line - 1] ?? "").trim()} »`,
      );
    }
  });

  test("anti-sur-attribution — aucune collection itérée n'est créditée", () => {
    const a = art();
    // Sondage aveugle enveloppé dans un catch, liste de health-check, table de
    // zones : ce sont des ÉNUMÉRATIONS de noms, jamais des preuves d'usage.
    for (const t of [
      "piece_marques", "marques", "brands", "fabricants", "piece_brands", "equipmentiers",
      "___xtr_delivery_ape_france", "___xtr_delivery_ape_corse", "___META_TAGS_ARIANE",
    ]) {
      assert.equal(a.tables[t], undefined, `${t} ne doit pas entrer dans l'inventaire par une itération`);
    }
  });

  test("aucune clé de .tables ne porte de majuscule — garde de forme contre l'itération", () => {
    const mauvaises = Object.keys(art().tables).filter((k) => /[A-Z]/.test(k));
    assert.deepEqual(mauvaises, [], "un nom à majuscule trahit une valeur récoltée hors d'un vrai call-site");
  });

  test("tout refus publié appartient à l'inventaire clos", () => {
    const set = new Set(RESOLUTION_REFUSAL_REASONS);
    const a = art();
    for (const d of [...a.dynamic_from_callsites, ...a.dynamic_rpc_callsites]) {
      if (d.resolved_table) { assert.equal(d.refusal, null); continue; }
      assert.ok(set.has(d.refusal), `raison hors inventaire : ${d.refusal} (${d.file}:${d.line})`);
    }
  });

  test("PÉRIMÈTRE V1 — les sites passant par @repo/* sont tous refusés, jamais résolus", () => {
    const a = art();
    const horsCorpus = a.dynamic_from_callsites.filter((d: any) => d.refusal === "import-outside-scanned-corpus");
    assert.ok(horsCorpus.length > 0, "le corpus contient des imports de workspace : ils doivent apparaître comme refusés");
    for (const d of horsCorpus) assert.equal(d.resolved_table, null);
  });
});

describe("résolution — déterminisme, prouvé et non déduit", () => {
  test("le scan ne lit JAMAIS sous node_modules/ ni sous un dist/", () => {
    const vrai = fs.readFileSync;
    const lus: string[] = [];
    (fs as any).readFileSync = function (p: any, ...rest: any[]) {
      if (typeof p === "string") lus.push(p);
      return vrai.apply(fs, [p, ...rest] as any);
    };
    try { scanCallSites(ts); } finally { (fs as any).readFileSync = vrai; }
    const interdits = lus.filter((p) => /(^|\/)node_modules\//.test(p) || /(^|\/)dist\//.test(p));
    assert.deepEqual(
      interdits.slice(0, 5), [],
      "lire sous node_modules/ ou dist/ rendrait la sortie dépendante d'un build local — " +
        "c'est le défaut déjà payé par le builder L1 des fichiers",
    );
  });

  test("la sortie ne dépend pas de l'ordre d'entrée des fichiers", () => {
    const empreinte = (cs: any) =>
      JSON.stringify(
        cs.dynamicFrom
          .slice()
          .sort((a: any, b: any) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line))
          .map((d: any) => `${d.file}:${d.line}:${d.form}:${d.resolved_table}:${d.refusal}`),
      );
    const a = scanCallSites(ts);
    const b = scanCallSites(ts);
    assert.equal(empreinte(a), empreinte(b), "deux scans doivent rendre la même sortie");
    assert.equal(
      [...a.tableUses.keys()].sort().join("|"),
      [...b.tableUses.keys()].sort().join("|"),
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * PARTITIONS — une partition n'a pas de cycle de vie propre
 *
 * `CREATE TABLE x PARTITION OF y` ne crée pas un objet supprimable isolément :
 * c'est du stockage attaché à un parent. Aucun code ne l'adressera jamais par
 * son nom — il interroge le parent. Son `used_by = 0` est donc ATTENDU et ne
 * porte aucun signal.
 *
 * Les laisser dans `candidate_orphan_tables` ne rend pas la liste plus prudente,
 * seulement plus longue : on y lisait « 3 partitions de pieces_price_history »
 * là où le seul objet décidable est le parent. Et une liste longue se lit mal —
 * c'est ainsi qu'un vrai signal se perd.
 *
 * DÉTECTION STRUCTURELLE, jamais lexicale. Le motif de nom (`_pYYYYMMDD`,
 * `_YYYY_MM`) attrapait 24 des 27 partitions réelles : trois lui échappaient.
 * On lit donc la DDL, sur la vue à commentaires dépouillés.
 * ──────────────────────────────────────────────────────────────────────────── */

describe("partitions — détection structurelle, jamais par le nom", () => {
  const art = () => JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));

  test("une partition porte son parent et sort de la liste de revue", () => {
    const a = art();
    const cand = new Set(a.candidate_orphan_tables.map((c: any) => c.name));
    const parts = Object.entries(a.tables).filter(([, t]: any) => t.partition_of);
    assert.ok(parts.length > 0, "le dépôt déclare des partitions — elles doivent être reconnues");
    for (const [name, t] of parts as any) {
      assert.ok(!cand.has(name), `${name} est une partition de ${t.partition_of} : pas un candidat`);
      assert.ok(a.tables[t.partition_of], `le parent ${t.partition_of} doit exister dans l'inventaire`);
    }
  });

  test("les partitions restent DANS l'inventaire — jamais omises", () => {
    const a = art();
    for (const n of ["__seo_gsc_daily_2026_04", "__seo_ga4_daily_2026_04"]) {
      assert.ok(a.tables[n], `${n} doit rester listée : une absence est plus grave qu'un faux positif`);
      assert.equal(typeof a.tables[n].partition_of, "string");
    }
  });

  test("SENTINELLE — les parents réellement inutilisés RESTENT candidats", () => {
    const a = art();
    const cand = new Set(a.candidate_orphan_tables.map((c: any) => c.name));
    // Zone STOP prix : ces deux parents ont used_by = 0 et une migration. Ce sont
    // les vrais signaux que le bruit des partitions masquait. Les perdre en
    // nettoyant la liste serait exactement l'inverse du but.
    for (const p of ["pieces_price_history", "pricing_decision_snapshot"]) {
      assert.equal(a.tables[p].used_by_count, 0);
      assert.equal(a.tables[p].partition_of, null, `${p} est un PARENT, pas une partition`);
      assert.ok(cand.has(p), `${p} doit RESTER candidat — c'est le signal, pas le bruit`);
    }
  });

  test("les parents utilisés ne deviennent pas candidats par effet de bord", () => {
    const a = art();
    const cand = new Set(a.candidate_orphan_tables.map((c: any) => c.name));
    for (const p of ["__seo_gsc_daily", "__seo_ga4_daily", "__seo_cwv_daily", "__seo_crux_field_history"]) {
      assert.ok(a.tables[p].used_by_count > 0, `${p} doit conserver son usage`);
      assert.ok(!cand.has(p));
    }
  });

  test("une table ordinaire garde partition_of null et reste candidate si inutilisée", () => {
    const a = art();
    const cand = a.candidate_orphan_tables.map((c: any) => c.name);
    assert.ok(cand.length > 0);
    for (const n of cand) assert.equal(a.tables[n].partition_of, null);
  });

  test("un PARTITION OF en COMMENTAIRE ne déclare rien", () => {
    // Le lexer partagé dépouille les commentaires : la doc de rollback ne doit
    // pas fabriquer une partition, comme elle ne fabriquait plus un DROP.
    const { maskComments } = require("../registry/lib/sql-lex.js");
    const sql = `-- CREATE TABLE faux_p2026_01 PARTITION OF faux;\nCREATE TABLE vrai_p2026_01 PARTITION OF vrai;`;
    const masked = maskComments(sql);
    assert.ok(!/faux_p2026_01/.test(masked.replace(/\n.*vrai.*/s, "")), "la ligne commentée doit être blanchie");
    assert.ok(/vrai_p2026_01/.test(masked));
  });
});
