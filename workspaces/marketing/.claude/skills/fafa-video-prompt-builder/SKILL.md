---
name: fafa-video-prompt-builder
description: Use when generating downstream tool prompts (Higgsfield MCP b-roll/avatar/scene, Remotion composition input, voice TTS) from an approved Fafa script. Triggers — "générer prompts vidéo", "préparer assets pour render", "Higgsfield prompt Fafa". Outputs prompts stored under prompts/<provider>/.
---

# Fafa Video Prompt Builder — Skill

> Transforme un script APPROVED en prompts pour chaque outil downstream. **Règle stricte tous providers** : assets stockés S3, jamais committés repo, jamais utilisés comme preuve, jamais auto-publiés.

## Quand invoquer

- Après statut APPROVED (script + claims + evidence + disclaimer validés)
- Avant invocation outils externes (Higgsfield, TTS, etc.)
- Pour reproduire/itérer prompts d'un pilote V1 ayant FAIL render approval

## Providers V1

| Provider | Rôle | Statut V1 |
|---|---|---|
| **Higgsfield MCP** (`https://mcp.higgsfield.ai/mcp`) | Multi-modèles (Soul, Cinema Studio, Flux, Seedream, Kling, Minimax Hailuo, Veo) + Marketing Studio + brand kits + hooks + virality predictor | Prioritaire (test 2-3 pilotes V1 max) |
| **Remotion compositions** | Templates input pour `/render` HTTP du `services/remotion-renderer/` | Utilisé (PR #2 Remotion livre 3 compositions) |

Autres providers ajoutés à la demande seulement (voir `prompts/README.md`).

## Pré-requis

- Script JSON validé + `approval.content_approved=true`
- Persona Fafa (`fafa-persona-canon`)
- Format spec + brief

## Templates Higgsfield disponibles

- `prompts/higgsfield/broll-prompt-template.md` — atelier, schéma animé, ambiance
- `prompts/higgsfield/avatar-prompt-template.md` — avatar Fafa (4 pré-requis figés)
- `prompts/higgsfield/product-scene-template.md` — pièce close-up macro / schéma technique

## Règles strictes (PASS/FAIL Brand Safety)

- ❌ Aucun asset utilisé comme **preuve** mécanique (G6 STRICT, `truth_dependency=illustration|reference` jamais `proof`)
- ❌ Aucune transformation d'asset source concurrent (G5, statut `INSPIRED_PATTERN_ONLY` obligatoire)
- ❌ Aucun visage humain identifiable, aucun logo concurrent, aucune plaque immat lisible
- ✅ Assets stockés S3 (`s3://automecanik-renders/<provider>/<video_id>/`)
- ✅ Manifest JSON dans `manifests/renders/` avec `provider`, `model`, `prompt_hash_sha256`
- ✅ Mention IA assumée dans disclaimer plan (`type: ai_generated_notice`)

## Workflow

1. Charger script APPROVED + brief + format spec
2. Identifier assets requis (b-roll, avatar, scenes produit, voix)
3. Pour chaque asset : choisir template prompt + provider + modèle
4. Personnaliser slots (`{{scene_type}}`, `{{piece_name}}`, etc.)
5. Sauvegarder prompts dans `prompts/<provider>/<video_id>/<asset_id>.md`
6. Owner exécute manuellement les prompts (V1, pas d'orchestration runtime)
7. Asset généré → upload S3 + manifest JSON dans `manifests/renders/`

## Output (par prompt généré)

```json
{
  "skill": "fafa-video-prompt-builder",
  "video_id": "fafa-vanne-egr-001",
  "asset_id": "higgsfield-broll-001",
  "provider": "higgsfield",
  "model_hint": "kling-2.5",
  "template_used": "broll-prompt-template",
  "prompt_path": "prompts/higgsfield/fafa-vanne-egr-001/broll-001.md",
  "prompt_hash_sha256": "...",
  "truth_dependency": "illustration",
  "estimated_credits": 12,
  "ready_for_execution": true
}
```

## Budget Higgsfield V1

- Plafond strict : 2-3 pilotes V1 max
- ~50-100 crédits Higgsfield estimés totaux V1
- Suivi crédits dans CSV `manifests/metrics/video-performance.csv` (colonne `notes`)

## Voir aussi

- `[[fafa-persona-canon]]`
- `[[fafa-script-generator]]`
- `[[fafa-remotion-template-planner]]`
- `[[fafa-brand-safety-reviewer]]`
- `workspaces/marketing/fafa-media-factory/prompts/higgsfield/README.md`
