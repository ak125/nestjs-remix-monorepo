---
name: fafa-brand-safety-reviewer
description: Use when validating a video brief/script/render against the 7 gates (G1 Truth, G2 Safety, G3 Brand, G4 Platform, G5 Reuse Risk, G6 Visual Honesty, G7 Final QA) before owner approval. Triggers — "valider brand safety", "vérifier 7 gates Fafa", "review vidéo pré-approval". STRICT G2 + G6 (1 violation = FAIL).
---

# Fafa Brand Safety Reviewer — Skill

> Applique les 7 gates de gouvernance vidéo (`.spec/00-canon/video-governance-p0.md`) à un script + claims + evidence + render. Statut REVIEW_READY → APPROVED ou REJECTED.

## Quand invoquer

- Après statut DRAFT_ONLY (script généré, claims/evidence/disclaimer présents)
- Après render reçu (validation finale incluant G6 Visual Honesty sur assets réels)
- Re-validation après itération (FAIL précédent corrigé)

## Pré-requis

- Brief + script + claim-table + evidence-pack + disclaimer-plan (5 artefacts P0)
- Persona Fafa (`fafa-persona-canon` invoqué)
- Si render disponible : manifest JSON dans `manifests/renders/`

## Les 7 gates (P0 spec)

| Gate | Nom | Mesure | Warn | Fail | Strict |
|---|---|---|---|---|---|
| **G1** | Truth | Ratio claims non-sourcés / total | 0.15 | 0.30 | non |
| **G2** | Safety | Nb claims procedure/safety sans validation humaine | 0 | 1 | **STRICT** |
| **G3** | Brand | Nb violations ton/style/interdits | 1 | 3 | non |
| **G4** | Platform | Déviation durée vs format spec (%) | 0% | 10% | non |
| **G5** | Reuse Risk | Score cosine vs corpus | 0.5 | 0.7 | non |
| **G6** | Visual Role | Nb visuels utilisés comme preuve (truth_dependency=proof) | 0 | 1 | **STRICT** |
| **G7** | Final QA | Nb artefacts manquants + approval | 0 | 1 | non |

`canPublish = true` ssi **AUCUN** gate FAIL. Sinon `content_approved=false`.

## Workflow

1. Charger tous les artefacts du `scripts/<statut>/<video_id>/`
2. Pour chaque gate G1-G7, calculer mesure + comparer thresholds
3. Construire verdict array conforme `governance/approval-record.schema.json` (`gate_results[]`)
4. Si tous PASS → `content_approved=true`, déplacer vers `scripts/review-ready/`
5. Si ≥1 FAIL → produire rapport détaillé, rester en `scripts/draft/` pour itération
6. Owner inspecte verdict + signe Approval Record (3 flags)

## Détail par gate

### G1 Truth
- `measured = unsourced_claims / total_claims`
- Lire chaque claim → vérifier présence `evidence_refs` non vide
- Trigger items = liste des `claim_id` sans evidence

### G2 Safety (STRICT)
- `measured = claims_procedure_safety_sans_validation`
- Filtrer claims avec `kind ∈ ['procedure', 'safety']`
- Vérifier chaque a `human_validated=true` + `human_validated_by/at` non null
- 1 seule violation = FAIL

### G3 Brand
- `measured = count(interdits_match)`
- Patterns interdits issus de `personas/fafa.md` + `rules-fafa-persona-canon-v1.md` (vault PR A)
- Liste : « certain », « garanti », « urgent », « pas cher », « code promo », « casse auto », etc.

### G4 Platform
- `measured = |script_duration_estimate - format_target| / format_target`
- Format target lu depuis `formats/<format>.md` (30-45s pour ne-change-pas-trop-vite, etc.)

### G5 Reuse Risk
- `measured = max(cosine_similarity(script, pattern_corpus))`
- Si dérivé d'un pattern (`inspired_from_pattern`) : cible <0.5
- Calcul via embedding simple (cosine sur tokens) ou via API

### G6 Visual Role (STRICT)
- `measured = count(brollAssets where truth_dependency == 'proof')`
- Vérifier chaque asset dans manifest render
- 1 seul `truth_dependency=proof` = FAIL

### G7 Final QA
- `measured = count(missing_artefacts) + (approval_missing ? 1 : 0)`
- Check les 5 artefacts P0 + Approval Record initial présent

## Output (Approval Record gate_results)

```json
{
  "skill": "fafa-brand-safety-reviewer",
  "video_id": "fafa-vanne-egr-001",
  "verdict_overall": "PASS|FAIL|WARN",
  "can_publish_eligible": true,
  "gate_results": [
    {
      "gate": "G1",
      "verdict": "PASS",
      "measured": 0.10,
      "warn_threshold": 0.15,
      "fail_threshold": 0.30,
      "strict": false,
      "details": "1 claim sur 10 sans evidence (acceptable < warn)",
      "trigger_items": ["claim-7"]
    }
    // ... G2..G7
  ],
  "next_action": "promote_to_review_ready|stay_in_draft|reject_with_reasons"
}
```

## Voir aussi

- `[[fafa-persona-canon]]`
- `[[fafa-script-generator]]`
- `[[creative-pattern-extractor]]` (pour G5 corpus)
- `.spec/00-canon/video-governance-p0.md`
- `workspaces/marketing/fafa-media-factory/governance/approval-record.schema.json`
- Vault `rules-video-disclaimer-safety.md` (PR vault C)
