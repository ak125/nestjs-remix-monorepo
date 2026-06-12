# Inspiration — Creative Pattern Extraction

> **Copyright-safe extraction**. On stocke des **patterns** (metadata structurelle), jamais d'asset source **commité, publié ou réutilisé en sortie**.
> L'analyse éphémère d'une source publique (`/watch` / claude-video, mode `REFERENCE_ANALYSIS_ONLY`) est autorisée ; sa sortie ne devient jamais du contenu.
> Statut `INSPIRED_PATTERN_ONLY` obligatoire avant tout passage en `DRAFT_ONLY`.

## Règle d'or

| Autorisé | Interdit |
|---|---|
| ✅ Analyser hook, structure, durée, rythme, CTA, format, type de plan | ❌ **Committer / publier / réutiliser en sortie** un asset source (frame, cut, montage, texte écran) |
| ✅ **Analyse éphémère** d'une source publique via `/watch` (frames + transcript, `/tmp` hors-repo, auto-cleanup) — `REFERENCE_ANALYSIS_ONLY` | ❌ Recopier script trop proche (G5 Reuse Risk cosine ≥0.7 = FAIL) |
| ✅ Citer URL source pour traçabilité | ❌ Reprendre montage **frame-by-frame** — plans / cadrages / durées / séquence (voir Enforcement) |
| ✅ Stocker pattern JSONL (metadata structurelle) | ❌ Imiter une personne réelle identifiable |
| ✅ Anonymiser la source dans le brief Fafa | ❌ Reprendre branding concurrent (logos, jingles, mascotte, habillage) |
| ✅ Marquer `do_not_copy_visuals`, `do_not_reuse_script`, `reference_analysis_only` | ❌ Reproduire l'**expression** d'une source (même rebrandée AutoMecanik) |

### Enforcement — analyse en entrée ≠ copie en sortie (anti-loophole)

`/watch` (claude-video) est autorisé **uniquement comme entrée d'analyse**. Son output (frames, transcript, timing) :

- ❌ n'entre **jamais** dans un script / brief / manifest comme contenu réutilisé ;
- ❌ ne sert **jamais** de preuve visuelle (`truth_dependency != illustration` → **FAIL G6**) ;
- ❌ n'autorise **aucune** copie frame-by-frame en sortie, **même avec le branding AutoMecanik/Fafa**.

**Ligne directrice (idée libre / expression protégée)** — on copie la *fonction* d'un beat
(hook → symptôme → cause → test → CTA), jamais l'*expression* (plans, cadrages, durées,
montage, texte exact). Un clone plan-pour-plan avec script réécrit + visuels d'illustration
**passe G5 et G6 mécaniquement mais reste une contrefaçon** (droit d'auteur audiovisuel CPI
+ parasitisme art. 1240 C. civ.) : cette ligne « Interdit » est l'**unique barrière**, pas les gates.
→ `shot-by-shot functional rebuild` = OK · `frame-by-frame copy` = FAIL, rebrand non opposable.

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
- Vault rule `rules-video-creative-reuse-policy.md` (**draft prêt** — ratification G3 vault en attente, owner ouvre la PR vault)
- Gate G5 Reuse Risk + G6 Visual Role (`.spec/00-canon/video-governance-p0.md`)
