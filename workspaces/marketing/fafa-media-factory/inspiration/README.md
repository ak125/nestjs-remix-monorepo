# Inspiration — Creative Pattern Extraction

> **Copyright-safe extraction**. On stocke des **patterns** (metadata structurelle), JAMAIS d'assets sources.
> Statut `INSPIRED_PATTERN_ONLY` obligatoire avant tout passage en `DRAFT_ONLY`.

## Règle d'or

| Autorisé | Interdit |
|---|---|
| ✅ Analyser hook structure, durée, rythme, CTA, format, type de plan | ❌ Télécharger asset vidéo/audio source |
| ✅ Citer URL source pour traçabilité | ❌ Recopier script trop proche (G5 Reuse Risk cosine ≥0.7 = FAIL) |
| ✅ Stocker pattern JSONL | ❌ Reprendre montage frame-by-frame |
| ✅ Anonymiser la source dans le brief Fafa | ❌ Imiter une personne réelle identifiable |
| ✅ Marquer `do_not_copy_visuals`, `do_not_reuse_script` | ❌ Reprendre branding concurrent (logos, jingles) |

## Format JSONL canon (un pattern par ligne)

```json
{
  "source_url": "https://www.tiktok.com/@example/video/123",
  "platform": "tiktok|youtube|instagram|facebook",
  "niche": "auto repair|car parts|mechanic tips",
  "discovered_at": "2026-05-28",
  "hook_type": "warning_before_purchase|symptom_reveal|piece_explained|...",
  "duration_sec": 31,
  "structure": ["hook", "symptom", "causes", "advice", "cta"],
  "visual_patterns": ["facecam", "close-up part", "caption-heavy"],
  "pace": "fast|medium|slow",
  "caption_density": "high|medium|low",
  "cta_type": "check_compatibility|learn_more|visit_store|...",
  "engagement_signals": {
    "comments_useful": "high|medium|low",
    "shares_proxy": "high|medium|low"
  },
  "risk_flags": ["do_not_copy_visuals", "do_not_reuse_script", "no_person_imitation"],
  "extracted_at": "2026-05-28",
  "extracted_by": "creative-pattern-extractor-v1"
}
```

## Fichiers attendus (vides V1)

- `patterns/tiktok-auto-repair.jsonl`
- `patterns/youtube-shorts-mechanic.jsonl`
- `patterns/instagram-reels-garage.jsonl`

Vides au début ; populés au fil de l'usage du skill `creative-pattern-extractor` (Phase 5 pilotes).

## Workflow obligatoire

1. Pattern extrait → `inspiration/patterns/*.jsonl` (statut `PATTERN_EXTRACTED`)
2. Transformation Fafa → brief original avec signature explicite « inspiré du pattern X, œuvre originale Fafa »
3. Statut `INSPIRED_PATTERN_ONLY` enregistré dans `scripts/draft/<video_id>/inspiration.json`
4. Seulement après → passage en `DRAFT_ONLY`

**Sans signature `INSPIRED_PATTERN_ONLY` → Skill `fafa-brand-safety-reviewer` retourne G5 Reuse Risk FAIL.**

## Voir aussi

- Skill `[[creative-pattern-extractor]]`
- Vault rule `rules-video-creative-reuse-policy.md` (PR vault B en cours)
- Gate G5 Reuse Risk (`.spec/00-canon/video-governance-p0.md`)
