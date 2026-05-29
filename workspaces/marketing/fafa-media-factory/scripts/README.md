# Scripts — Workflow 8 statuts

Chaque vidéo Fafa traverse 8 statuts. Le dossier reflète le statut courant.

| # | Statut | Dossier | Quoi |
|---|---|---|---|
| 1 | `DISCOVERED` | (hors `scripts/`) | URL source repérée, asset NON téléchargé |
| 2 | `PATTERN_EXTRACTED` | (hors `scripts/`) | Pattern JSONL stocké dans `inspiration/patterns/` |
| 3 | `INSPIRED_PATTERN_ONLY` | (hors `scripts/`) | Pattern transformé en brief Fafa original (signature explicite anti-recyclage) |
| 4 | `DRAFT_ONLY` | `scripts/draft/<video_id>/` | Skill `fafa-script-generator` → brief.json + script.json |
| 5 | `REVIEW_READY` | `scripts/review-ready/<video_id>/` | Skill `fafa-brand-safety-reviewer` → 7 gates verdict + claims/evidence/disclaimer |
| 6 | `APPROVED` | `scripts/approved/<video_id>/` | Owner signe Approval Record (`content_approved=true` + `render_approved=true`, `publish_approved=false` strict) |
| 7 | `PUBLISHED` | `scripts/published/<video_id>/` | Owner publie manuellement, met `publish_approved=true` + record `manifests/publishing/` |
| 8 | `MEASURED` | (reste dans `published/`) | KPIs CSV J+7 dans `manifests/metrics/video-performance.csv` |

## Structure dossier par vidéo

```
scripts/<statut>/<video_id>/
  brief.json              # video-brief.schema.json
  script.json             # script Fafa généré (hook/script_voice/screen_text/cta/disclaimer)
  claims.json             # claim-table.schema.json
  evidence.json           # evidence-pack.schema.json
  disclaimer.json         # disclaimer-plan.schema.json
  approval.json           # approval-record.schema.json (3 flags + 7 gates + history)
  inspiration.json        # (si applicable) référence pattern source + signature INSPIRED_PATTERN_ONLY
```

## Règle anti-régression

- Le dossier `scripts/<statut>/` correspond toujours au statut **réel** de la vidéo
- Toute promotion de statut = `git mv` du dossier + update `brief.json.status` + entrée `approval.json.history`
- Pas de duplication entre dossiers — une seule SoT par vidéo à un instant T

## V1 — pas de pilotes encore

Les dossiers `draft/`, `review-ready/`, `approved/`, `published/` sont vides en PR #1 Foundation.
Les 10 pilotes V1 arrivent en PR #3 Pilotes (backlog post-merge PR #2).
