---
name: fafa-script-generator
description: Use when transforming a video brief (gamme, symptom, format, URL cible) into an original Fafa-voiced script with hook + script_voice + screen_text + CTA + disclaimer. Triggers — "générer script Fafa", "écrire vidéo pilote", "script depuis brief". Invokes fafa-persona-canon as dependency.
---

# Fafa Script Generator — Skill

> Transforme un Video Brief en script Fafa **original** (signature `INSPIRED_PATTERN_ONLY` si dérivé d'un pattern). Toujours invoquer `fafa-persona-canon` en pré-requis pour aligner ton + interdits.

## Quand invoquer

- Après création du Brief (statut DRAFT_ONLY)
- Pour réécrire/itérer un script qui a FAIL Brand Safety
- Pour produire les 10 pilotes V1 (Lots 1 + 2)

## Pré-requis

- Brief JSON conforme `governance/video-brief.schema.json`
- Si `inspiration_pattern_id` présent : pattern JSONL dans `inspiration/patterns/`
- Persona Fafa figée (`personas/fafa.md`)
- Format choisi parmi 3 specs disponibles (`formats/*.md`)

## Input

```json
{
  "video_id": "fafa-vanne-egr-001",
  "format": "ne-change-pas-trop-vite|symptome-3-causes|piece-expliquee",
  "gamme": "vanne-egr",
  "symptom": "perte de puissance et fumée noire",
  "url_cible": "https://www.automecanik.com/pieces/vanne-egr.html",
  "inspiration_pattern_id": "tiktok-vanne-egr-warning-001"
}
```

## Output (script JSON)

```json
{
  "video_id": "fafa-vanne-egr-001",
  "format": "ne-change-pas-trop-vite",
  "hook": "Perte de puissance et fumée noire ? Ne change pas ta vanne EGR trop vite.",
  "script_voice": "Oui, elle peut être en cause. Mais un filtre à air bouché, un débitmètre fatigué ou une durite percée peuvent donner des symptômes proches...",
  "screen_text": ["Perte de puissance", "Fumée noire", "Vérifie avant d'acheter"],
  "cta": "Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.",
  "disclaimer": "Conseil informatif. Diagnostic à confirmer selon véhicule.",
  "duration_estimate_sec": 38,
  "generated_at": "2026-05-28T...",
  "generated_by": "fafa-script-generator-v1",
  "persona_signature": "fafa-v1-figée",
  "inspired_from_pattern": "tiktok-vanne-egr-warning-001"
}
```

## Règles strictes

- ✅ Hook <80 chars, accroche émotionnelle non agressive
- ✅ `script_voice` adapté à la durée cible du format (G4 Platform ±10%)
- ✅ `screen_text` 3-5 items max (lisibilité 9:16 mobile)
- ✅ CTA pédagogique avec verbe « vérifie » / « sélectionne » / « comprends »
- ✅ Disclaimer présent (G2 Safety + G6 Visual Honesty)
- ❌ Aucun prix, code promo, urgence artificielle
- ❌ Aucune promesse absolue (« certain », « garanti »)
- ❌ Si dérivé d'un pattern, cosine cible <0.5 vs script source (G5 Reuse Risk)
- ❌ Aucune référence à la source d'inspiration dans le script final (anonymisation)

## Workflow

1. Charger brief + format spec + persona canon
2. Si `inspiration_pattern_id` : charger pattern + marquer statut `INSPIRED_PATTERN_ONLY`
3. Générer script aligné format narratif + persona
4. Sortir JSON dans `scripts/draft/<video_id>/script.json`
5. Mettre à jour brief `status=DRAFT_ONLY`
6. Trigger Skill `fafa-brand-safety-reviewer` pour 7 gates

## Verdict structure

```json
{
  "skill": "fafa-script-generator",
  "video_id": "fafa-vanne-egr-001",
  "script_path": "scripts/draft/fafa-vanne-egr-001/script.json",
  "duration_estimate_sec": 38,
  "format_compliance": "PASS",
  "persona_check": "PASS",
  "ready_for_brand_safety": true
}
```

## Voir aussi

- `[[fafa-persona-canon]]` (dépendance obligatoire)
- `[[creative-pattern-extractor]]` (input pattern)
- `[[fafa-brand-safety-reviewer]]` (next step)
- `workspaces/marketing/fafa-media-factory/formats/`
- `workspaces/marketing/fafa-media-factory/governance/video-brief.schema.json`
