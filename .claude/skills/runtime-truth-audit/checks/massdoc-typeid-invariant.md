---
check: massdoc-typeid-invariant
severity: high
confidence: high
expected_false_positive_rate: 0.01
autofixable: false
sources:
  - auto_type (type_id_i) via supabase MCP
  - tecdoc_map.type_id_remap (old_id, new_id) via supabase MCP
  - tecdoc_map.type_id_seq (last_value, is_called) via supabase MCP
incidents_proven:
  - "#998 / vault #319 (2026-06-15, ADR-085) — allocateur gouverné type_id ; bug setval/MINVALUE attrapé à l'apply"
risk_documented:
  - ADR-085 (governance-vault) — invariant numérotation interne véhicule Massdoc-séquentiel
  - backend/supabase/migrations/20260615_massdoc_type_id_allocator.sql
---

# Check : Intégrité de l'invariant de numérotation interne véhicule (Massdoc, ADR-085)

## Pattern audité

L'invariant canon ADR-085 : `auto_type.type_id` = séquence globale Massdoc ; le KTYPNR TecDoc est une **clé
source** (dans `tecdoc_map.type_id_remap.old_id`), jamais adopté comme id ; aucune réutilisation des trous legacy ;
aucune renumérotation. L'**unique** voie d'allocation gouvernée est `tecdoc_map.allocate_massdoc_type_id`.

Ce check détecte une **dérive d'intégrité** : un véhicule inséré dans `auto_type` **hors** de la voie gouvernée
(ex. INSERT manuel, ré-exécution du script déprécié `fix-vehicles-massdoc.py`), qui adopterait un KTYPNR comme id,
bypasserait l'allocateur, casserait le pont remap, ou désynchroniserait la séquence.

**Impact** : collision d'ids / URLs véhicule cassées (URLs keyées `type_id`) / 301 perdus / duplicate-content —
silencieux (aucune erreur runtime tant que personne ne tombe sur la page). D'où la détection proactive.

## Origine

PR #998 (migration) + vault PR #319 (ADR-085), 2026-06-15. L'allocateur remplace le script ad-hoc. Cet allocateur
est **inerte tant qu'aucune vague ne l'appelle** ; ce check est la **tripwire** qui garantit que, le jour où une
vague (ou un INSERT manuel) tourne, toute violation de l'invariant remonte au lieu de corrompre en silence.

## Méthode (4 sous-invariants, chacun doit retourner 0 / OK)

```sql
-- A. KTYPNR source adopté comme id interne (doit être 0)
SELECT count(*) FROM auto_type WHERE type_id_i IN (SELECT old_id FROM tecdoc_map.type_id_remap);

-- B. type_id >= 60000 hors gouvernance = bypass allocateur (pas dans remap.new_id) (doit être 0)
SELECT count(*) FROM auto_type
 WHERE type_id_i >= 60000 AND type_id_i NOT IN (SELECT new_id FROM tecdoc_map.type_id_remap);

-- C. remap orphelin : new_id absent de auto_type (doit être 0)
SELECT count(*) FROM tecdoc_map.type_id_remap r
 WHERE NOT EXISTS (SELECT 1 FROM auto_type a WHERE a.type_id_i = r.new_id);

-- D. séquence désynchronisée : un id >= prochain-allouable sans avoir avancé la séquence (doit être OK)
SELECT (SELECT last_value FROM tecdoc_map.type_id_seq) AS seq_last,
       (SELECT max(type_id_i) FROM auto_type)          AS max_id;   -- DRIFT si seq_last <= max_id (is_called=false)
```

Baseline vérifiée 2026-06-15 : A=0, B=0, C=0, D=OK (seq 83457 > max 83456). Toute déviation = finding.

## Sortie attendue (JSON)

```json
{
  "check": "massdoc-typeid-invariant",
  "pass": true,
  "findings": [],
  "summary": { "A_ktypnr_adopted": 0, "B_allocator_bypass": 0, "C_remap_orphan": 0, "D_seq_sync": "OK" }
}
```

Un `pass: false` liste le(s) sous-invariant(s) violé(s) avec le compte. Exemple de finding :
`{ "invariant": "B", "drift_count": 3, "severity": "high", "fix_hint": "véhicules ajoutés hors allocateur — remapper via tecdoc_map.allocate_massdoc_type_id (owner-gated), ne PAS renuméroter" }`.

## Faux positifs connus

- **Legacy 0–59999** où `type_id == KTYPNR` (grandfathered) : exclus par design (A teste l'overlap avec
  `remap.old_id` qui est ≥100001 ; B ne teste que ≥60000). Pas de FP attendu.
- Fenêtre transactionnelle pendant une vague gouvernée en cours (allocate → INSERT non encore committé) : lire en
  dehors d'une vague active, ou tolérer un écart transitoire.

## Limites

- Détection d'**état**, pas de l'auteur : signale la dérive, pas qui l'a causée (volontaire — pas de surveillance d'identité).
- Ne couvre pas les codes moteur (`auto_type_motor_code`) — périmètre = numérotation `type_id` uniquement (un check = une responsabilité).

## Action recommandée pour les findings

- **Aucune auto-correction** (autofixable=false, doctrine no-silent-fallback). Tout fix = **owner-gated** :
  re-router les ids hors-gouvernance via `tecdoc_map.allocate_massdoc_type_id`, **jamais** renuméroter l'existant
  (no URL changes). Rollback allocateur = `DROP FUNCTION/SEQUENCE` (additif). Voir ADR-085.
