---
name: creative-pattern-extractor
description: Use when analyzing competitor TikTok/YouTube/Instagram videos to extract reusable structural patterns (hook, structure, pace, CTA, format) WITHOUT copying assets, scripts, or branding. Triggers — "analyser vidéo concurrente", "extraire pattern", "veille créative auto repair". Output JSONL pattern only.
---

# Creative Pattern Extractor — Skill

> Anti-copyright. On stocke des **patterns structurels** (metadata), JAMAIS d'assets sources.
> Statut `INSPIRED_PATTERN_ONLY` obligatoire avant tout passage en `DRAFT_ONLY`.

## Quand invoquer

- Owner identifie une vidéo performante (TikTok/YT/IG/FB) dans la niche auto repair
- Avant de briefer un nouveau pilote Fafa
- Pour enrichir `inspiration/patterns/*.jsonl`

## Périmètre AUTORISÉ

- ✅ Analyser hook, structure narrative, durée, rythme, CTA, format visuel
- ✅ Citer URL source pour traçabilité (jamais dans la vidéo finale)
- ✅ Anonymiser la source dans le brief Fafa

## Périmètre INTERDIT (FAIL G5 Reuse Risk)

- ❌ Télécharger asset vidéo/audio source
- ❌ Recopier script trop proche (cosine ≥0.7 = FAIL)
- ❌ Reprendre montage frame-by-frame
- ❌ Imiter une personne réelle identifiable
- ❌ Reprendre branding concurrent (logos, jingles, mascot)

## Workflow

1. Owner fournit URL source
2. Skill analyse manuellement (visionnage humain, pas scraping automatique)
3. Sortie JSONL ajoutée à `inspiration/patterns/<platform>-<niche>.jsonl`
4. Pattern marqué `INSPIRED_PATTERN_ONLY` quand transformé en brief Fafa
5. Vérification G5 Reuse Risk avant publication (cosine cible <0.5)

## Format JSONL (un pattern par ligne)

```json
{
  "source_url": "https://www.tiktok.com/@example/video/123",
  "platform": "tiktok|youtube|instagram|facebook",
  "niche": "auto repair|car parts|mechanic tips",
  "discovered_at": "2026-05-28",
  "hook_type": "warning_before_purchase|symptom_reveal|piece_explained",
  "duration_sec": 31,
  "structure": ["hook", "symptom", "causes", "advice", "cta"],
  "visual_patterns": ["facecam", "close-up part", "caption-heavy"],
  "pace": "fast|medium|slow",
  "caption_density": "high|medium|low",
  "cta_type": "check_compatibility|learn_more|visit_store",
  "engagement_signals": {
    "comments_useful": "high|medium|low",
    "shares_proxy": "high|medium|low"
  },
  "risk_flags": ["do_not_copy_visuals", "do_not_reuse_script", "no_person_imitation"],
  "extracted_at": "2026-05-28",
  "extracted_by": "creative-pattern-extractor-v1"
}
```

## Verdict

```json
{
  "skill": "creative-pattern-extractor",
  "pattern_id": "tiktok-vanne-egr-warning-001",
  "stored_at": "inspiration/patterns/tiktok-auto-repair.jsonl",
  "reusability_score": 0.8,
  "risk_flags_count": 3,
  "ready_for_brief": true
}
```

## Voir aussi

- `[[fafa-persona-canon]]`
- `[[fafa-script-generator]]`
- `[[fafa-brand-safety-reviewer]]` (gate G5)
- `workspaces/marketing/fafa-media-factory/inspiration/README.md`
- Vault rule `rules-video-creative-reuse-policy.md` (PR vault B)
