# Prompts — Templates downstream tools

## Providers V1 (présents)

| Dossier | Provider | Rôle |
|---|---|---|
| `higgsfield/` | Higgsfield MCP officiel | Provider externe prioritaire (multi-modèles : Soul, Cinema Studio, Flux, Seedream, Kling, Minimax Hailuo, Veo + Marketing Studio + brand kits + hooks + virality predictor). Limité à 2-3 pilotes V1. |
| `remotion/` | Remotion compositions | Templates input pour `/render` HTTP du `services/remotion-renderer/` (3 compositions livrées en PR #2 Remotion) |

C'est tout pour V1. Pas d'autres dossiers prévus.

## Politique d'ajout de provider

On ajoute un dossier `prompts/<provider>/` **seulement quand** :
1. Un pilote V1 a effectivement utilisé le provider
2. Au moins 1 template `.md` réel y est posé (jamais un dossier vide avec `.gitkeep`)
3. Le provider apporte une valeur démontrée sur ce pilote (pas hypothétique)

Pattern à suivre : voir `prompts/higgsfield/README.md` (provider documenté, règles strictes, schéma manifest, templates concrets). Reproduire cette structure si un nouveau provider est introduit.

## Règle stricte tous providers (présents et futurs)

Assets générés (Higgsfield, ou tout provider ajouté plus tard) :
- ✅ Stockés en S3/MinIO uniquement (`s3://automecanik-renders/<provider>/`)
- ✅ Référencés via manifest JSON dans `manifests/renders/`
- ❌ JAMAIS committés dans le repo (`.gitignore` racine bloque `*.mp4`/`*.srt`/`*.wav`/`*.mov`/`*.webm`/`*.mkv`)
- ❌ JAMAIS utilisés comme **preuve** mécanique (G6 Visual Honesty STRICT — `truth_dependency=illustration` ou `reference`, jamais `proof`)
- ❌ JAMAIS publiés automatiquement (`publish_approved=false` par défaut)
- ❌ JAMAIS issus de transformation d'asset source concurrent (statut `INSPIRED_PATTERN_ONLY` obligatoire)

## Voir aussi

- Skill `[[fafa-video-prompt-builder]]`
- Skill `[[fafa-remotion-template-planner]]`
- `prompts/higgsfield/README.md` (provider prioritaire détaillé)
