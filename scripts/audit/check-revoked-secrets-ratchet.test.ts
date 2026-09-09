#!/usr/bin/env tsx
/**
 * Tests adversariaux du ratchet revoked-secrets (SEC-01 / SEC-02).
 *
 * Les comparateurs sont purs — exemptions, baseline et contenus de fichiers sont injectés —
 * donc chaque cas est déterministe et sans I/O.
 *
 * Les jetons de test sont FABRIQUÉS À L'EXÉCUTION, jamais écrits en littéral : un JWT
 * codé en dur dans ce fichier ferait échouer le ratchet sur son propre fichier de test
 * (R2 scanne tout l'arbre suivi, sans allowlist de chemin — c'est le but).
 *
 * Trois tests portent l'édifice :
 *   - EXEMPTION_WITHOUT_PROOF  une exemption gitleaks non adossée à une révocation prouvée
 *                              doit échouer — c'est le défaut que le contrat prose n'a
 *                              jamais attrapé faute d'implémentation.
 *   - ROLE_DRIVEN_DETECTION    la détection porte sur la claim `role`, pas sur une valeur
 *                              connue : une clé RÉÉMISE est attrapée elle aussi.
 *   - NO_FALSE_POSITIVE        un JWT utilisateur (`role=authenticated`) n'est pas un
 *                              secret serveur : le ratchet ne doit pas le signaler.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkContract,
  decodeJwtRole,
  scanContents,
  type SecretsBaseline,
} from './check-revoked-secrets-ratchet.ts';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** Fabrique un JWT syntaxiquement valide — signature factice, aucune valeur réelle. */
const jwt = (role: string, ref = 'exampleprojectref1234') =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ref, role, iat: 1, exp: 2 })}.${'s'.repeat(43)}`;

const FP = 'aaaa1111:path/to/file.yml:generic-api-key:12';
const sound = (): SecretsBaseline => ({
  revoked: [{ fingerprint: FP, revoked_at: '2026-08-13', rotation_evidence: 'ancienne clé → 401' }],
});

// ------------------------------------------------------------------------ R1
test('R1 happy path — exemption adossée à une révocation prouvée', () => {
  assert.deepEqual(checkContract(new Set([FP]), sound()), []);
});

test('EXEMPTION_WITHOUT_PROOF — exemption sans entrée de baseline', () => {
  const v = checkContract(new Set([FP]), { revoked: [] });
  assert.equal(v.length, 1);
  assert.match(v[0], /sans entrée de baseline/);
});

test('EXEMPTION_WITHOUT_PROOF — baseline présente mais revoked_at null', () => {
  const base: SecretsBaseline = { revoked: [{ fingerprint: FP, revoked_at: null, rotation_evidence: 'x' }] };
  assert.match(checkContract(new Set([FP]), base).join('\n'), /non révoqué/);
});

test('EXEMPTION_WITHOUT_PROOF — révocation annoncée sans preuve de rotation', () => {
  const base: SecretsBaseline = { revoked: [{ fingerprint: FP, revoked_at: '2026-08-13', rotation_evidence: '  ' }] };
  assert.match(checkContract(new Set([FP]), base).join('\n'), /sans rotation_evidence/);
});

test('R1 — entrée de baseline orpheline (exemption retirée sans nettoyer la baseline)', () => {
  assert.match(checkContract(new Set(), sound()).join('\n'), /orpheline/);
});

test('R1 — une entrée pending ne peut pas se déclarer révoquée ET active', () => {
  const base: SecretsBaseline = {
    exposed_pending_revocation: [
      { value_fingerprint: 'sha256:dead', revoked_at: '2026-09-09', status: 'ACTIVE', evidence: 'e' },
    ],
  };
  assert.match(checkContract(new Set(), base).join('\n'), /contradictoire/);
});

test('R1 — une entrée pending sans evidence est refusée', () => {
  const base: SecretsBaseline = {
    exposed_pending_revocation: [{ value_fingerprint: 'sha256:dead', revoked_at: null, status: 'ACTIVE' }],
  };
  assert.match(checkContract(new Set(), base).join('\n'), /sans evidence/);
});

// ------------------------------------------------------------------------ R2
test('ROLE_DRIVEN_DETECTION — une clé service_role RÉÉMISE (ref inédite) est attrapée', () => {
  const v = scanContents(new Map([['backend/scripts/x.js', `const K = '${jwt('service_role', 'brandnewprojectref99')}';`]]));
  assert.equal(v.length, 1);
  assert.match(v[0], /R2 .*role=service_role.*backend\/scripts\/x\.js/);
});

test('R2 — la clé anon est signalée elle aussi', () => {
  assert.match(scanContents(new Map([['a.env', jwt('anon')]])).join('\n'), /role=anon/);
});

test('NO_FALSE_POSITIVE — un JWT utilisateur (role=authenticated) n’est pas signalé', () => {
  assert.deepEqual(scanContents(new Map([['t.ts', jwt('authenticated')]])), []);
});

test('NO_FALSE_POSITIVE — une chaîne non-JWT commençant par eyJ n’est pas signalée', () => {
  assert.deepEqual(scanContents(new Map([['t.md', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9']])), []);
});

test('R2 — plusieurs jetons dans un même fichier sont tous signalés', () => {
  const content = `${jwt('service_role')}\n${jwt('anon')}`;
  assert.equal(scanContents(new Map([['multi.env', content]])).length, 2);
});

// ------------------------------------------------------------------------ R3
test('R3 — un PAT de management sbp_ est signalé', () => {
  const v = scanContents(new Map([['deploy.sh', `TOKEN="sbp_${'a'.repeat(40)}"`]]));
  assert.match(v.join('\n'), /R3 .*deploy\.sh/);
});

test('NO_FALSE_POSITIVE — le préfixe sbp_ seul (prose, regex) n’est pas un jeton', () => {
  assert.deepEqual(scanContents(new Map([['doc.md', 'le préfixe sbp_ identifie un PAT']])), []);
});

// ------------------------------------------------------------------- décodage
test('decodeJwtRole — renvoie null sur une entrée illisible plutôt que de jeter', () => {
  assert.equal(decodeJwtRole('pas-un-jwt'), null);
  assert.equal(decodeJwtRole('a.!!!!.c'), null);
  assert.equal(decodeJwtRole(''), null);
});

test('scanContents — un arbre propre ne produit aucune violation', () => {
  assert.deepEqual(scanContents(new Map([['ok.ts', 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;']])), []);
});
