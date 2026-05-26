# Doctrine v15.3 cross-validation — Pilot #1 (filtre-a-air) vs Pilot #2 (MEMORY.md-compaction)

> **Anti-bias check Task A6 ADR-082** — vérifier que la doctrine d'amélioration continue globale n'est pas biaisée par filtre-a-air en l'appliquant à un sujet radicalement différent.

**Date** : 2026-05-26
**Verdict cross-validation** : `DOCTRINE_NON_BIAISÉE` — doctrine ADR-082 s'applique sans modification sur les 2 pilots, verdicts identiques `PARTIAL_READY / CONTINUE_LIMITED`, sémantique 9 verdicts + filtre 6 questions + SAFE intégré + hiérarchie P1-P6 utilisée sur les 2 cas.

---

## Comparaison synoptique

| Dimension | Pilot #1 filtre-a-air | Pilot #2 MEMORY.md-compaction | Anti-bias check |
|---|---|---|---|
| **Domaine** | wiki_proposal_gamme (content) | other / memory governance | ✅ radicalement différent |
| **Scope** | global | local | ✅ scope schema utilisé différemment, OK |
| **Severity level** | 2 Important | 3 Faible | ✅ niveaux différents, hiérarchie utilisée |
| **Priority v12** | P2 Acquisition SEO | P5 Simplification | ✅ priorités différentes, hiérarchie utilisée |
| **Score v12** | HIGH_VALUE | MEDIUM_VALUE | ✅ score différent, échelle utilisée |
| **SAFE level** | SAFE_1 | SAFE_1 | ✅ dimension SAFE applicable identique |
| **Filter 6 questions OUI count** | 6/6 (ameliore + mesurable + prioritaire + simple + sûr + business) | 4/6 (pas P-prioritaire, pas business direct) | ✅ filtre discriminant — Pilot #2 montre que doctrine accepte cas non-business-direct via PARTIAL_READY |
| **Anti-complexity check** | passed (no new layer) | simplification_applied (compaction = réduction) | ✅ 2 modes du même check, schema accepte les 2 |
| **Non-regression 9/9** | 9/9 vert | 9/9 vert | ✅ identique |
| **Proof minimal v7** | 6/6 accumulées | 6/6 accumulées | ✅ identique |
| **Failure map count** | 4 FM (1 fixé auto + 3 humain-gated) | 2 FM (1 fixé auto + 1 stabilize-decision) | ✅ structure schema utilisée différemment |
| **Owner required** | true (4 owner_actions) | false (0 owner_action critique) | ✅ schema permet les 2, allOf conditionnel respecté |
| **Status** | PARTIAL_READY | PARTIAL_READY | ✅ verdict canon identique sur cas différents |
| **Execution mode v15.3** | CONTINUE_LIMITED | CONTINUE_LIMITED | ✅ sémantique v15.3 cohérente |
| **Decision (cycle)** | PARTIAL_READY → STABILIZE | PARTIAL_READY → STABILIZE | ✅ même pattern d'arrêt intelligent |
| **Iterations used / budget** | 1/3 | 2/3 | ✅ budget v7 utilisé naturellement |
| **Improvements produced** | 3 (Corrective + Observabilité + Gouvernance) | 2 (Corrective + Gouvernance) | ✅ 5 types schema utilisés, pas forcés sur 1 type |
| **Doctrine compliance v1→v15.3** | 15/15 true | 16/16 true (incl. v15_3) | ✅ doctrine self-cohérente |

---

## Validation anti-bias par les 5 critères du plan v15.1

> Critères v15.1 §Task A6 Step 3 — « la doctrine n'est pas biaisée si OUI à chacun »

### 1. Le schema JSON Schema 2020-12 a-t-il pu décrire les 2 sujets sans extension ?

✅ **OUI** — `improvement-report.schema.json` (32 properties + 6 allOf conditionnels) a couvert les 2 pilots sans modification. `tested_entity_type` enum incluait déjà `other` qui a accommodé memory-md-compaction. `axis` enum a couvert simplification + governance + observability pour Pilot #2 (vs seo + content pour Pilot #1).

### 2. Les 9 verdicts terminaux ont-ils couvert les 2 cas réalistes ?

✅ **OUI** — `PARTIAL_READY` applicable aux 2 cas avec sémantique cohérente (CONTINUE_LIMITED v15.3). Pas besoin d'inventer un nouveau verdict ni de modifier l'enum.

### 3. La hiérarchie P1-P6 a-t-elle été utile ?

✅ **OUI** — Pilot #1 = P2 (Acquisition SEO, signal GSC 2400 imp/30j) vs Pilot #2 = P5 (Simplification, dette technique mémoire). 2 priorités distinctes, échelle utilisée naturellement. Pas de "tout est P1".

### 4. La règle anti-complexité a-t-elle été pertinente sur le Pilot #2 ?

✅ **OUI** — Pilot #2 a explicitement utilisé `anti_complexity_check: simplification_applied` (vs `passed` pour Pilot #1) parce que la compaction EST une simplification active. Le schema accepte les 4 valeurs `passed / simplification_applied / new_layer_justified / failed` ; les 2 pilots ont utilisé 2 valeurs différentes.

### 5. Les 6 questions filtre étaient-elles applicables ?

✅ **OUI** — appliquées sur les 2 cas. Pilot #1 a répondu 6/6 OUI (justifie HIGH_VALUE). Pilot #2 a répondu 4/6 OUI (pas P-prioritaire, pas business direct) → justifie MEDIUM_VALUE + STABILIZE plutôt que CONTINUE infini. C'est exactement le comportement attendu : le filtre discrimine entre cas similaires (HIGH vs MEDIUM value) et calibre l'engagement.

---

## Application v6 intelligence d'arrêt — démontrée sur Pilot #2

Le Pilot #2 illustre la doctrine v6 d'arrêt intelligent :

- **Cycle 1** (T0→T1) : 11 compactions, gain 1950B (~177B/edit)
- **Cycle 2** (T1→T2) : 5 compactions, gain 328B (~66B/edit) → **gain marginal 2.7× plus faible**
- **Décision STABILIZE** : poursuite cycle 3 risquerait dette sémantique > gain bytes négligeable

C'est exactement le pattern v6 « la boucle s'arrête quand le gain devient faible (gain marginal < coût de correction) ». L'application est self-meta cohérente : la doctrine arrête sa propre application avant l'effet pervers de sur-compactage.

## Application v15.3 PARTIAL_READY ≠ stop — démontrée

Pilot #2 verdict `PARTIAL_READY` n'a PAS bloqué l'avancement :
- ✅ La compaction a été appliquée (16 entrées)
- ✅ Le verdict.json a été produit + validé ajv
- ✅ Le rapport cross-validation est produit (ce fichier)
- ✅ Le système continue à fonctionner (MEMORY.md toujours lisible, sémantique préservée)

Seul est bloqué : la compaction profonde vers limite stricte 24400B (Phase 2 / session dédiée), conformément à la sémantique v15.3.

## Différences attendues (pas un signe de biais)

Pilot #1 et Pilot #2 ont DES différences — c'est sain :

- **Owner required** : Pilot #1 true (promotion humaine wiki) vs Pilot #2 false (memory privée). Le schema accepte les 2 via `allOf` conditionnel sur BLOCKED_OWNER.
- **Axis combinations** : différentes par nature (seo+content vs simplification+governance).
- **Score v12** : différent (HIGH vs MEDIUM) parce que P5 < P2 en hiérarchie.

Ces différences sont **causées par le sujet, pas par la doctrine**. La doctrine fournit les axes pour exprimer ces différences sans les forcer.

## Conclusion : DOCTRINE_NON_BIAISÉE

La doctrine ADR-082 (Phase 1 v15.3) a passé l'anti-bias check :

1. ✅ Schema JSON Schema 2020-12 sans modification sur 2 domaines radicalement différents
2. ✅ Verdicts 9 + filtre 6 + SAFE 4 niveaux + hiérarchie P1-P6 utilisés sur 2 cas
3. ✅ Doctrine v6 (intelligence d'arrêt) démontrée empiriquement sur Pilot #2 cycle 1→2
4. ✅ Doctrine v15.3 (PARTIAL_READY = CONTINUE_LIMITED) cohérente sur 2 verdicts identiques
5. ✅ Différences entre pilots = causées par les sujets, pas par défaut doctrine

**Décision Phase 2 — owner-gated** : critères Phase 2 v15.2 §File Structure remplis (Pilot #1 + #2 PASS/PARTIAL_READY + cross-validation = DOCTRINE_NON_BIAISÉE). Owner peut décider d'activer Phase 2 (wrapper validate-improvement-report.sh + references/checklist.md + workflow improvement-gate.yml informationnel). Phase 3 ratchet bloquant reste différée (5 critères cumulatifs : ≥3-5 PRs réelles + <10 min friction + 0 false blocker + ≥1 vraie erreur captée + owner GO explicite).

---

🤖 Generated by Claude Opus 4.7 — Pilot #2 anti-bias ADR-082 — 2026-05-26
