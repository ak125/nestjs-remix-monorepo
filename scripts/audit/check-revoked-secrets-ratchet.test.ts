import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fingerprint,
  isSupabaseLegacyKey,
  jwtPayload,
  scanContent,
  isExempt,
  checkIgnoreContract,
  buildLengthIndex,
  scanShapes,
  addedLines,
  scanAddedLines,
  type Baseline,
  type KnownSecretFingerprint,
} from "./check-revoked-secrets-ratchet.ts";

/**
 * Synthetic tokens built at runtime. NOTHING here is a real credential: the
 * signature segment is the literal string "not-a-real-signature" and no private
 * key was ever involved. Built in code rather than committed as a fixture so
 * the repo never carries a Supabase-shaped literal at all.
 */
function synthJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.not-a-real-signature`;
}

const SYNTH_SERVICE_ROLE = synthJwt({
  iss: "supabase",
  ref: "examplerefexampleref",
  role: "service_role",
  iat: 1,
  exp: 2,
});
const SYNTH_ANON = synthJwt({
  iss: "supabase",
  ref: "examplerefexampleref",
  role: "anon",
  iat: 1,
  exp: 2,
});
const SYNTH_FOREIGN_JWT = synthJwt({
  iss: "https://accounts.google.com",
  sub: "1234",
  role: "user",
});
const SYNTH_SBP = `sbp_${"0123456789abcdef0123456789abcdef01234567"}`;

// ── fingerprint: stable, truncated, never the value ───────────────────────────
test("fingerprint is a stable 12-hex SHA-256 prefix", () => {
  const fp = fingerprint("hello");
  assert.match(fp, /^[0-9a-f]{12}$/);
  assert.equal(fp, fingerprint("hello"));
  assert.notEqual(fp, fingerprint("hello!"));
});

// ── shape recognition ─────────────────────────────────────────────────────────
test("jwtPayload decodes a JWT body, returns null on garbage", () => {
  assert.equal(jwtPayload(SYNTH_ANON)?.role, "anon");
  assert.equal(jwtPayload("eyJnot.a.jwt"), null);
});

test("isSupabaseLegacyKey: true for supabase anon/service_role only", () => {
  assert.equal(isSupabaseLegacyKey(SYNTH_SERVICE_ROLE), true);
  assert.equal(isSupabaseLegacyKey(SYNTH_ANON), true);
  assert.equal(isSupabaseLegacyKey(SYNTH_FOREIGN_JWT), false);
});

// ── TEST NÉGATIF RÉEL : la garde doit CASSER sur une réintroduction ───────────
test("NEGATIVE: a Supabase service_role JWT literal is flagged", () => {
  const found = scanContent(
    "backend/scripts/whatever.js",
    `const KEY = '${SYNTH_SERVICE_ROLE}';\n`,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "supabase-legacy-jwt");
  assert.equal(found[0].line, 1);
  assert.match(found[0].detail, /role=service_role/);
  // the report carries the fingerprint, never the token
  assert.ok(!JSON.stringify(found).includes(SYNTH_SERVICE_ROLE));
});

test("NEGATIVE: an anon legacy JWT is flagged too", () => {
  const found = scanContent("backend/.env.test.template", `K="${SYNTH_ANON}"`);
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /role=anon/);
});

test("NEGATIVE: an sbp_ management token literal is flagged", () => {
  const found = scanContent("backend/deploy.sh", `TOKEN="${SYNTH_SBP}"\n`);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "supabase-management-token");
});

test("NEGATIVE: a revoked value returning under any shape is flagged by fingerprint", () => {
  const revoked = new Set([fingerprint(SYNTH_FOREIGN_JWT)]);
  const found = scanContent("a.ts", `const t = '${SYNTH_FOREIGN_JWT}';`, revoked);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "revoked-secret-reintroduced");
});

test("multi-line: line numbers are reported exactly", () => {
  const found = scanContent(
    "x.js",
    `// header\n// more\nconst K = '${SYNTH_SERVICE_ROLE}';\n`,
  );
  assert.equal(found[0].line, 3);
});

// ── NE DOIT PAS bloquer : placeholders, noms de variables, JWT tiers ──────────
test("does NOT flag placeholders and variable names", () => {
  const benign = [
    'SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"',
    "const K = process.env.SUPABASE_SERVICE_ROLE_KEY;",
    "SUPABASE_ACCESS_TOKEN requis (format sbp_...)",
    "empreinte SHA-256 : b7721bff0da8",
  ].join("\n");
  assert.deepEqual(scanContent("doc.md", benign), []);
});

test("does NOT flag a third-party JWT (not a Supabase anon/service_role key)", () => {
  assert.deepEqual(scanContent("a.ts", `const g = '${SYNTH_FOREIGN_JWT}';`), []);
});

test("does NOT flag a short sbp_-looking string", () => {
  assert.deepEqual(scanContent("a.sh", 'X="sbp_short"'), []);
});

// ── exemptions : chemins, jamais valeurs ──────────────────────────────────────
test("exemptions are path-scoped (fixtures/tests/self), never value-scoped", () => {
  assert.equal(isExempt("scripts/audit/__fixtures__/leaky.json"), true);
  assert.equal(isExempt("backend/src/__tests__/a.spec.ts"), true);
  assert.equal(isExempt(".gitleaksignore"), true);
  assert.equal(
    isExempt("audit/baselines/revoked-secrets-baseline.json"),
    true,
  );
  assert.equal(isExempt("scripts/audit/check-revoked-secrets-ratchet.ts"), true);
  assert.equal(isExempt("backend/scripts/list-all-tables.js"), false);
  assert.equal(isExempt("backend/.env.test.template"), false);
});

// ── contrat .gitleaksignore ↔ baseline ────────────────────────────────────────
const BASE: Baseline = {
  schemaVersion: "1.1.0",
  revoked: [
    {
      fingerprint: "abc:file.md:generic-api-key:21",
      revoked_at: "2026-08-13",
      rotation_evidence: "ancienne clé → 401",
    },
    { fingerprint: "def:other.md:jwt:4", revoked_at: null },
  ],
};

test("ignore-contract: a justified fingerprint passes", () => {
  assert.deepEqual(
    checkIgnoreContract(["# comment", "", "abc:file.md:generic-api-key:21"], BASE),
    [],
  );
});

test("ignore-contract: FAIL when the fingerprint is absent from the baseline", () => {
  const v = checkIgnoreContract(["zzz:unknown.md:jwt:1"], BASE);
  assert.equal(v.length, 1);
  assert.match(v[0], /absent de la baseline/);
});

test("ignore-contract: FAIL when revoked_at is null or evidence missing", () => {
  const v = checkIgnoreContract(["def:other.md:jwt:4"], BASE);
  assert.equal(v.length, 2);
  assert.ok(v.some((x) => /revoked_at nul/.test(x)));
  assert.ok(v.some((x) => /rotation_evidence absente/.test(x)));
});


// ── SEC-03 : passe par empreinte pour les secrets sans forme reconnaissable ───
//
// Un HMAC Paybox est 128 caractères hex ; un certificat SystemPay, 16 chiffres.
// Aucune expression régulière ne les distingue d'un hash ou d'un numéro. Seule
// l'empreinte le fait — et l'empreinte ne révèle pas la valeur.
//
// Tous les secrets ci-dessous sont SYNTHÉTIQUES : construits ici, jamais issus
// du dépôt. C'est la propriété que la détection par empreinte rend possible.

const SYNTH_HMAC = "a".repeat(128); // même forme qu'une clé Paybox, valeur bidon
const SYNTH_CERT = "1234567890123456"; // même forme qu'un certificat SystemPay
const SYNTH_SHORT = "12345678"; // un identifiant marchand : 8 chiffres

function known(
  value: string,
  revoked_at: string | null = null,
  secret_type = "secret synthétique de test",
): KnownSecretFingerprint {
  return {
    sha256_12: fingerprint(value),
    secret_type,
    length: value.length,
    revoked_at,
  };
}

const IDX = buildLengthIndex([known(SYNTH_HMAC), known(SYNTH_CERT)]);

// ── 1. POSITIF — le littéral connu est détecté ───────────────────────────────

test("POSITIF: un littéral de secret connu est signalé par empreinte", () => {
  const found = scanContent(
    "backend/PAYBOX-CONFIGURATION.md",
    `PAYBOX_HMAC_KEY=${SYNTH_HMAC}\n`,
    new Set(),
    IDX,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "known-secret-literal");
  assert.equal(found[0].fp, fingerprint(SYNTH_HMAC));
  assert.equal(found[0].line, 1);
});

test("POSITIF: la détection porte sur la valeur, pas sur le nom de variable", () => {
  // Même valeur, variable différente, fichier différent, langage différent.
  const found = scanContent("t.php", `$C = "${SYNTH_HMAC}";`, new Set(), IDX);
  assert.equal(found.length, 1);
});

test("POSITIF: un secret RÉVOQUÉ est étiqueté différemment d'un secret à statut inconnu", () => {
  const revokedIdx = buildLengthIndex([known(SYNTH_CERT, "2026-09-09")]);
  const a = scanContent("a.md", SYNTH_CERT, new Set(), revokedIdx);
  const b = scanContent("b.md", SYNTH_CERT, new Set(), IDX);
  assert.equal(a[0].rule, "revoked-secret-reintroduced");
  assert.equal(b[0].rule, "known-secret-literal");
});

// ── 2. NÉGATIF — ce que la garde ne doit JAMAIS bloquer ──────────────────────

test("NÉGATIF: noms de variables, empreintes SHA-256, fixtures et docs neutralisées", () => {
  const benign = [
    "PAYBOX_HMAC_KEY=<SET_IN_ENV>",
    "SYSTEMPAY_CERTIFICATE_PROD=<SET_IN_ENV>",
    'HMAC_KEY="${PAYBOX_HMAC_KEY:?manquant}"',
    "const k = process.env.PAYBOX_HMAC_KEY;",
    // l'empreinte elle-même, telle qu'elle apparaît dans la baseline — la
    // publier est le but, pas une fuite
    `sha256_12: "${fingerprint(SYNTH_HMAC)}"`,
    `sha256_12: "${fingerprint(SYNTH_CERT)}"`,
    "Certificats : 16 caractères (ex: `9999888877776666`)",
  ].join("\n");
  assert.deepEqual(scanContent("doc.md", benign, new Set(), IDX), []);
});

test("NÉGATIF: le plancher de 12 caractères exclut les identifiants marchands", () => {
  // PAYBOX_RANG (3), PAYBOX_SITE (7), SYSTEMPAY_SITE_ID (8) : transmis dans le
  // formulaire de paiement côté client, donc publics. Les indexer produirait
  // 826 faux positifs pour le seul PAYBOX_RANG (mesuré le 2026-09-09).
  const shortIdx = buildLengthIndex([known(SYNTH_SHORT)]);
  assert.deepEqual(
    scanContent("a.md", `SITE_ID=${SYNTH_SHORT}`, new Set(), shortIdx),
    [],
  );
});

test("NÉGATIF: sans index, la passe par empreinte est inerte", () => {
  assert.deepEqual(scanContent("a.md", SYNTH_HMAC, new Set()), []);
});

test("NÉGATIF: une valeur de même longueur mais différente n'est pas signalée", () => {
  const other = "b".repeat(128);
  assert.deepEqual(scanContent("a.md", other, new Set(), IDX), []);
});

// ── 3. ANCIEN ÉTAT FAUTIF vs 4. NOUVEL ÉTAT PROPRE ───────────────────────────
//
// Les formes rencontrées sur le périmètre SEC-03, avant et après
// assainissement. Le test échouerait si l'assainissement rendait la garde
// aveugle plutôt que le dépôt propre.

const ANCIEN = [
  `SYSTEMPAY_CERTIFICATE_PROD=${SYNTH_CERT}`,
  `HMAC_KEY="${SYNTH_HMAC}"`,
  `$CertificatTest = "${SYNTH_HMAC}";`,
  `if [ "$CERT" = "${SYNTH_CERT}" ]; then`,
  `sed -i 's/^X=.*/X=${SYNTH_CERT}/' .env`,
].join("\n");

const NOUVEAU = [
  "SYSTEMPAY_CERTIFICATE_PROD=<SET_IN_ENV>",
  'HMAC_KEY="${PAYBOX_HMAC_KEY:?PAYBOX_HMAC_KEY manquant}"',
  "$CertificatTest = getenv('PAYBOX_HMAC_KEY');",
  `if [ "$(printf '%s' "$CERT" | sha256sum | cut -c1-12)" = "${fingerprint(SYNTH_CERT)}" ]; then`,
  'sed -i "s/^X=.*/X=${SYSTEMPAY_CERTIFICATE_PROD:?manquant}/" .env',
].join("\n");

test("ANCIEN ÉTAT: les 5 formes fautives sont toutes signalées", () => {
  const found = scanContent("mixed", ANCIEN, new Set(), IDX);
  assert.equal(found.length, 5);
  assert.deepEqual([...new Set(found.map((f) => f.line))], [1, 2, 3, 4, 5]);
});

test("NOUVEL ÉTAT: les 5 formes assainies ne produisent aucun constat", () => {
  assert.deepEqual(scanContent("mixed", NOUVEAU, new Set(), IDX), []);
});

test("buildLengthIndex ignore les entrées sans longueur (schéma hérité)", () => {
  const idx = buildLengthIndex([
    { sha256_12: "aaaaaaaaaaaa", secret_type: "x", revoked_at: null } as KnownSecretFingerprint,
    known(SYNTH_CERT),
  ]);
  assert.equal(idx.size, 1);
  assert.ok(idx.get(SYNTH_CERT.length));
});

// ── 5. SEC-04 : règles de FORME, évaluées sur les LIGNES AJOUTÉES ────────────
//
// Les règles de forme ne connaissent AUCUNE valeur. C'est ce qui leur permet
// d'attraper une clé qui n'existe pas encore : après une rotation, la nouvelle
// valeur collée dans un fichier suivi est signalée dès le commit, sans mise à
// jour de baseline.
//
// Elles s'évaluent sur ce qu'un commit AJOUTE, jamais sur l'état de HEAD. C'est
// ce choix qui permet de les livrer AVANT la purge : les littéraux que
// l'arbre porte déjà ne sont tout simplement pas dans l'entrée, donc il n'y a
// rien à tolérer — et donc aucun inventaire à publier. Sur un dépôt public,
// avant rotation, un inventaire des porteurs serait une carte vers les secrets.

const SYNTH_HEX128_B = "b".repeat(128);

test("POSITIF: une clé HMAC de 128 hex est signalée sans aucune baseline", () => {
  const f = scanShapes("a.md", `PAYBOX_HMAC_KEY=${SYNTH_HMAC}`);
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, "payment-hmac-hex128-literal");
  assert.equal(f[0].fp, fingerprint(SYNTH_HMAC));
});

test("NÉGATIF: 128 hex noyés dans une chaîne hex plus longue ne matchent pas", () => {
  assert.deepEqual(scanShapes("a.md", "c".repeat(160)), []);
});

test("NÉGATIF: 16 chiffres NUS ne matchent pas — 143 lignes de bruit mesurées", () => {
  // Mesuré sur l'arbre suivi : la forme nue touche 143 lignes dans 23 fichiers,
  // dont 86 pour le seul PageContractR6.json. L'ancre n'est pas un confort.
  assert.deepEqual(scanShapes("a.json", `{"ref": "${SYNTH_CERT}"}`), []);
});

test("POSITIF: 16 chiffres ancrés sur le nom de variable sont signalés", () => {
  const f = scanShapes("a.env", `SYSTEMPAY_CERTIFICATE_PROD=${SYNTH_CERT}`);
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, "payment-certificate-literal");
});

test("POSITIF: l'ancre couvre SYSTEMPAY_CERT_PROD — la forme longue le ratait", () => {
  // Les deux orthographes de la variable sont en usage. L'ancre sur la forme
  // longue rate silencieusement la forme abrégée ; élargir au préfixe n'ajoute
  // aucun faux positif, mesuré sur le même arbre.
  const f = scanShapes("s.sh", `if [ "$SYSTEMPAY_CERT_PROD" = "${SYNTH_CERT}" ]; then`);
  assert.equal(f.length, 1);
});

test("NON-DIVULGATION: un constat de forme porte l'empreinte, jamais la valeur", () => {
  const f = scanShapes("a.md", `K=${SYNTH_HMAC}`);
  assert.ok(!JSON.stringify(f).includes(SYNTH_HMAC));
});

// ── addedLines : ce qu'un commit AJOUTE ─────────────────────────────────────

const DIFF = [
  "diff --git a/conf.md b/conf.md",
  "--- a/conf.md",
  "+++ b/conf.md",
  "@@ -4,0 +5,1 @@",
  `+PAYBOX_HMAC_KEY=${SYNTH_HEX128_B}`,
].join("\n");

test("POSITIF: une clé ajoutée par le diff est signalée, au bon numéro de ligne", () => {
  const f = scanAddedLines(addedLines(DIFF));
  assert.equal(f.length, 1);
  assert.equal(f[0].file, "conf.md");
  assert.equal(f[0].line, 5);
});

test("NÉGATIF: une ligne SUPPRIMÉE n'est pas un ajout", () => {
  const del = DIFF.replace(`+PAYBOX_HMAC_KEY=${SYNTH_HEX128_B}`, `-PAYBOX_HMAC_KEY=${SYNTH_HEX128_B}`);
  assert.deepEqual(scanAddedLines(addedLines(del)), []);
});

test("CLÉ DU DÉCOUPAGE: un littéral DÉJÀ présent n'est pas dans l'entrée", () => {
  // La propriété qui rend inutile tout inventaire, donc toute publication de la
  // liste des fichiers porteurs. Un diff qui ne touche pas la ligne du secret
  // ne la contient pas : le mode ne peut pas la voir, donc rien à tolérer.
  const unrelated = [
    "--- a/conf.md",
    "+++ b/conf.md",
    "@@ -9,0 +10,1 @@",
    "+# un commentaire sans rapport",
  ].join("\n");
  assert.deepEqual(scanAddedLines(addedLines(unrelated)), []);
});

test("NÉGATIF: les chemins exemptés restent exemptés en mode lignes ajoutées", () => {
  const inFixture = DIFF.replace(/conf\.md/g, "x/__fixtures__/conf.md");
  assert.deepEqual(scanAddedLines(addedLines(inFixture)), []);
});

test("ANTI-OVERCLAIM: les règles de forme ne touchent PAS l'état de HEAD", () => {
  // scanContent est la garde d'ÉTAT, scanShapes la garde d'AJOUT. Si quelqu'un
  // fusionne un jour les deux, ce test tombe — et il doit tomber : faire tirer
  // les règles de forme sur HEAD exigerait, pour revenir au vert, un inventaire
  // des littéraux existants dans une baseline suivie. Sur un dépôt public et
  // avant rotation, cet inventaire est une carte vers les secrets.
  assert.deepEqual(scanContent("a.md", `K=${SYNTH_HMAC}`, new Set()), []);
  assert.equal(scanShapes("a.md", `K=${SYNTH_HMAC}`).length, 1);
});
