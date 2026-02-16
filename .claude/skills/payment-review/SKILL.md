---
name: payment-review
description: "Payment flow security review: HMAC signatures, callback validation, order normalization for Paybox + SystemPay."
argument-hint: "[file-path or PR-number]"
allowed-tools: Read, Grep, Glob
version: "1.1"
---

# Payment Review Skill

Validates payment flow security: HMAC signatures, callback handling, order normalization, and gateway configuration for Paybox + SystemPay.

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| Modification dans `modules/payments/` | `/payment-review [fichier]` |
| PR touchant callbacks, HMAC, signatures | `/payment-review [PR]` |
| Audit securite paiements (Paybox/SystemPay) | `/payment-review` |
| Chaine securite avec `/code-review` | `/payment-review` + `/backend-test` (parallele) |

---

## Workflow 3 Phases (OBLIGATOIRE)

### Phase 1 — Scan (identification du perimetre)

1. Lister tous les fichiers modifies dans `modules/payments/`
2. Classer par type : controller, service, utils, config
3. Identifier les fonctions touchees (signature verification, callback handling, order processing)
4. Verifier si les fichiers de test associes sont modifies

### Phase 2 — Validate (checklist par fichier)

Appliquer la checklist de securite ci-dessous a **chaque fichier modifie**. Chaque item a un niveau de severite :

| # | Check | Severite | Details |
|---|-------|----------|---------|
| 1 | HMAC signature verification preservee | **BLOQUANT** | Jamais supprimee ou affaiblie |
| 2 | `timingSafeEqual` utilise (pas `===`) | **BLOQUANT** | Previent les timing attacks |
| 3 | `normalizeOrderId()` appele avant lookup DB | **BLOQUANT** | Garantit le matching coherent |
| 4 | Code erreur valide avant marquage "paye" | **BLOQUANT** | `Erreur:00000` = succes Paybox |
| 5 | Idempotence : replay callbacks sans double-traitement | **BLOQUANT** | Verifier guard idempotence |
| 6 | PBX_SITE/RANG/IDENTIFIANT = valeurs production | **WARNING** | Pas de valeurs test en prod |
| 7 | Pas d'endpoints de test exposes | **WARNING** | callback-test retire de prod |
| 8 | CSP autorise uniquement les domaines gateway | **WARNING** | Pas de wildcard origins |

**Regle d'arret** : Si un item BLOQUANT echoue → STOP. Le changement ne peut PAS etre merge.

### Phase 3 — Test (scenarios de validation)

Apres validation de la checklist, verifier ces scenarios :

| Scenario | Methode | Resultat attendu |
|----------|---------|-----------------|
| Callback valide Paybox | Rejouer un callback avec signature correcte | Commande marquee payee, reponse 200 |
| Callback signature invalide | Modifier 1 char dans la signature | Rejet 403, commande inchangee |
| Callback replay (idempotence) | Envoyer le meme callback 3x | 1 traitement, 2 idempotent OK |
| Callback timeout | Simuler reponse > 30s | Pas de lock permanent sur commande |
| Order ID non-normalise | Envoyer `Ref:ord-123` vs `Ref:ORD-123` | Meme commande matchee |
| Code erreur != 00000 | Callback avec `Erreur:00003` | Commande NOT marquee payee |

---

## Configuration Audit

Verifier la presence et coherence des variables d'environnement :

```bash
# Paybox
PAYBOX_SITE        # 7 chiffres
PAYBOX_RANG        # 2 chiffres
PAYBOX_IDENTIFIANT # ~10 chiffres
PAYBOX_HMAC_KEY    # 128 hex chars (SHA512)

# SystemPay
SYSTEMPAY_SITE_ID         # 8 chiffres
SYSTEMPAY_CERTIFICATE_PROD # 32 chars
SYSTEMPAY_CERTIFICATE_TEST # 32 chars (different de PROD)
```

**Checks :**
- [ ] HMAC_KEY n'est PAS dans le code source (uniquement .env)
- [ ] CERTIFICATE_PROD != CERTIFICATE_TEST
- [ ] Pas de valeurs par defaut dans le code (`process.env.X || 'default'`)

---

## Key Files

- `backend/src/modules/payments/services/paybox-callback-gate.service.ts` — Callback validation gate
- `backend/src/modules/payments/services/cyberplus.service.ts` — SystemPay integration
- `backend/src/modules/payments/services/paybox.service.ts` — Paybox integration
- `backend/src/modules/payments/controllers/paybox-callback.controller.ts` — Callback endpoint
- `backend/src/modules/payments/utils/normalize-order-id.ts` — Order ID normalization

## Signature Verification Patterns

**Paybox (HMAC-SHA512) :**
- Response : `Mt:10050;Ref:ORD123;Auto:XXXXX;Erreur:00000;Signature:...`
- Verify : HMAC-SHA512 of response body (without Signature param) using PAYBOX_HMAC_KEY
- Compare avec `crypto.timingSafeEqual()`

**SystemPay (HMAC-SHA256) :**
- Vads_* parameters sorted alphabetically
- Concatenated avec `+` separator + certificate
- SHA256 hash comparison

## Anti-Patterns (BLOCK ces changements)

- Using `===` for signature comparison (timing attack vulnerability)
- Skipping or commenting out signature verification
- Hardcoded HMAC keys in source code
- Test callback endpoints accessible in production
- Missing error code validation before marking order as paid
- Removing normalizeOrderId() call

---

## Format de Sortie

```markdown
## Payment Review — [fichier ou PR]

### Phase 1 — Perimetre
- Fichiers modifies : [liste]
- Fonctions touchees : [liste]

### Phase 2 — Checklist Securite

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | HMAC verification | PASS/FAIL | ... |
| 2 | timingSafeEqual | PASS/FAIL | ... |
| ... | ... | ... | ... |

### Phase 3 — Scenarios Test

| Scenario | Status | Observation |
|----------|--------|-------------|
| Callback valide | PASS/FAIL | ... |
| Signature invalide | PASS/FAIL | ... |
| ... | ... | ... |

### Verdict
- [ ] **APPROVE** — Tous les BLOQUANTS passent, securite preservee
- [ ] **BLOCK** — [N] BLOQUANT(s) en echec : [liste]
```

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `code-review` | ← recoit | `/code-review` detecte modifications `modules/payments/` → propose `/payment-review` |
| `backend-test` | → propose | Apres review, proposer `/backend-test` pour tester les endpoints gateway |
