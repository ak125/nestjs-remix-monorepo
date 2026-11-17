---
name: runbook-marketing-pilot-rollback
description: Procédure de rollback du pilote Marketing Operating Layer (Phase 1 LOCAL). Critères d'échec, actions, post-mortem. Pas de DROP de tables — données purgées + agent désactivé, schéma conservé pour relance future.
type: runbook
status: active
date: 2026-04-30
relocated: 2026-11-17
related_adr: ["ADR-013", "ADR-036"]
related_rules: ["AI4", "G2"]
---

# Runbook — Rollback du pilote Marketing Operating Layer (Phase 1 LOCAL)

> Objectif : permettre un rollback **propre, réversible, auditable** du pilote
> `local-business-agent` (Phase 1 ADR-036) si les critères d'échec sont atteints.
> Aucune destruction de schéma — purge données + désactivation agent.

> **Provenance.** Relogé le 2026-11-17 depuis l'archive `ak125/governance-vault`
> (`ledger/knowledge/runbook-marketing-pilot-rollback.md`, `main` `b2e712791bee`), sur décision 129
> de l'owner. Trois passages écrivaient dans le vault ; ils sont réécrits : l'étape 5, la clause
> « nouvel ADR » et le critère de relance. Le reste est repris tel quel. **Procédure jamais jouée.**
>
> **Écarts relevés au relogement, à lever avant usage** : `backend/scripts/operating-matrix-snapshot.ts`
> (vérification de l'étape 3) n'existe pas dans le dépôt ; le frontmatter de
> `local-business-agent.md` n'a pas de champ `status`.

## Critères d'échec déclenchant le rollback

Au moins UN des critères suivants atteint à J+15 ou en cours de pilote :

- **Brand voice drift** : `brand-compliance-gate` retourne `BLOCK` sur > 50 %
  des briefs produits par `local-business-agent`. Indique que la voix LOCAL
  n'est pas correctement spécifiée OU que l'agent dérive systématiquement.
- **Surcharge validation humaine** : temps moyen de validation par brief
  > 30 minutes. Indique que le brief est trop mal cadré pour être utile —
  l'humain refait tout.
- **Incident GBP** : signal spam GBP, suspension compte, ou plainte utilisateur
  sur posts inappropriés. Critique → rollback immédiat.
- **Incident RGPD** : tout brief RETENTION qui contournerait le filtre
  `marketing_consent_at IS NOT NULL`. Critique → rollback immédiat +
  post-mortem (étape 5).
- **Erreurs runtime > 10 %** : taux d'erreur sur les routines Paperclip
  `rt-local-gbp-week` > 10 %. Indique problème infra ou config.
- **Veto QTO** : le QTO assigné (cf. ADR-036 §"Décisions ouvertes" #5) demande
  l'arrêt après ≥ 1 semaine d'observation.

## Actions de rollback (ordre strict)

### 1. Désactiver la routine Paperclip (immédiat)

```bash
# Via Paperclip API — désactive l'auto-trigger sans détruire la routine
curl -X PATCH "$PAPERCLIP_API/routines/rt-local-gbp-week" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN" \
  -d '{"active": false, "deactivation_reason": "marketing-pilot-rollback-YYYY-MM-DD"}'
```

Vérification :

```bash
curl -s "$PAPERCLIP_API/routines/rt-local-gbp-week" | jq '.active'
# → doit retourner false
```

### 2. Archiver les briefs en attente (préserve l'audit trail)

```sql
-- Pas de DELETE — on archive pour analyse post-mortem
UPDATE __marketing_brief
SET status = 'archived',
    reviewed_by = 'rollback-' || current_date::text,
    reviewed_at = now()
WHERE status IN ('draft', 'reviewed')
  AND agent_id = 'local-business-agent';
```

Vérification :

```sql
SELECT status, COUNT(*) FROM __marketing_brief
WHERE agent_id = 'local-business-agent'
GROUP BY status;
-- → 0 rows en draft ou reviewed
```

### 3. Marquer l'agent comme archivé dans OperatingMatrix

```bash
# Édition manuelle du frontmatter de l'agent
# workspaces/marketing/.claude/agents/local-business-agent.md
# Frontmatter : status: planned → status: archived
# + commit + push sur branche dédiée
```

Snapshot OperatingMatrix vérifie :

```bash
node backend/scripts/operating-matrix-snapshot.ts \
  | jq '.agents[] | select(.name=="local-business-agent") | .status'
# → "archived"
```

### 4. Désactiver les feedbacks / dashboards Phase 1

- Page `/admin/marketing/briefs` : ajouter bandeau « Pilote LOCAL en rollback —
  briefs archivés pour analyse ».
- Page `/admin/marketing/feedback` : conservée en lecture seule.

### 5. Post-mortem (obligatoire)

Le vault est une archive : rien ne s'y écrit. Le post-mortem s'écrit dans le monorepo, par PR
(celle de l'étape 6, ou une PR dédiée si aucun code n'est retiré). Sa description porte :

- **Date de déclenchement**
- **Critère(s) atteint(s)** (références numériques de la section "Critères d'échec")
- **Métriques observées** (BLOCK rate, validation time, error rate, etc.)
- **Cause racine identifiée** (drift brand voice ? config canon LOCAL incomplète ?
  prompt sous-spécifié ? infra ?)
- **Actions correctives proposées** pour une relance future
- **Données conservées** : les briefs archivés de `__marketing_brief` (étape 2), qui restent
  en base. Aucun export de la table n'est écrit dans un dépôt.

Si le post-mortem conduit à une règle, cette PR l'ajoute en une ligne à
`.claude/governance/journal-des-principes.md` (approbation de l'owner). Pas de nouvelle ADR.

### 6. PR revert sur la branche

Si le rollback exige le retrait du code Phase 1 (ex : agent dysfonctionnel
au-delà du paramétrage), ouvrir une PR `revert/marketing-pilot-rollback-YYYY-MM-DD`
qui :

- Conserve la migration DB (les 3 tables + colonne `users.marketing_consent_at`
  restent — schéma utile pour relance)
- Retire/désactive le frontmatter de l'agent + la routine Paperclip
- Documente le revert dans la description de la PR, avec le post-mortem de l'étape 5

**Pas de `git revert` brutal** — chirurgical, fichier par fichier.

## Ce qui N'EST PAS rollback

- ❌ **Pas de DROP de tables** `__marketing_brief` / `__marketing_feedback` /
  `__retention_trigger_rules`. Le schéma est conservé pour analyse + relance future.
- ❌ **Pas de DELETE de `users.marketing_consent_at`**. Le consentement
  utilisateur, une fois donné, ne s'efface pas par rollback technique
  (RGPD : un consentement est révoqué par l'utilisateur, pas par un opérateur).
- ❌ **Pas de réécriture d'ADR-036**. L'ADR, dans l'archive, documente la décision de
  l'avoir tenté ; un échec ne réécrit pas l'historique. Les apprentissages s'écrivent
  dans le post-mortem de l'étape 5 ; une règle qui en sort s'écrit au journal des principes.
- ❌ **Pas de désactivation `brand-compliance-gate`**. Le service reste en
  fonction pour les éventuels briefs ECOMMERCE Phase 2.

## Critères de relance (pré-requis avant Phase 1 v2)

- Cause racine du rollback adressée (issue GitHub fermée ; ligne du journal si une règle change)
- Brand-compliance-gate verdicts re-testés sur fixtures à blanc
- Si rollback déclenché par `local_canon_unvalidated` → metier confirme
  toutes les valeurs `local_canon` figées dans
  `.spec/00-canon/canon-distribution/rules-marketing-voice.md`
- 14 jours minimum d'observation post-rollback avant relance

## Références

Textes de l'archive `ak125/governance-vault`, en lecture seule ; ils expliquent une décision, ils
ne sont plus normatifs par eux-mêmes.

- ADR-036 — Marketing Operating Layer, Phase 1 pilote LOCAL
  (`ledger/decisions/adr/ADR-036-marketing-operating-layer.md`)
- ADR-013 — Agent lifecycle governance, G1/G2/G3
- `rules-ai-cos` — AI4, le QTO valide AVANT publication
- `runbook-admin-brand-editorial` — runbook éditorial brand R7 (référence de forme)
