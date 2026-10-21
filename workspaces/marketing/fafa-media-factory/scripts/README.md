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

Les documents de la zone ne décrivent pas tous ce flux de la même façon (relevé du 18/10) :

- **Qui pose `content_approved`** : l'owner, comme le dit cette table. La règle AI2 du vault (`ledger/rules/rules-ai-cos.md` :
  « L'IA propose, analyse, recommande. L'humain valide, decide, engage. »), à laquelle renvoie ADR-036 (`accepted`), réserve la
  validation à un humain ; le manifeste du pilote réserve de même `render_approved` à l'owner (« render_approved reste false tant
  que l'owner n'a pas inspecté ce MP4 exact », `manifests/renders/fafa-plaquettes-frein-001.json:8`). Depuis son réalignement du
  18/10, `fafa-brand-safety-reviewer` rend une proposition et ne pose aucun drapeau ; la description du schéma (l.45) le dit aussi.
  Le schéma n'exige qu'une chaîne non vide dans `content_approved_by` (`governance/approval-record.schema.json:79-86`) : il ne
  prouve pas qu'un humain a signé.
- **Quand la vidéo est rendue** : non tranché. Le statut 6 exige déjà `render_approved=true`, et le pilote a été rendu en
  `DRAFT_ONLY` (`manifests/renders/fafa-plaquettes-frein-001.json:4,8`) ; `fafa-remotion-template-planner` (« Quand invoquer »,
  « Pré-requis ») et `../README.md` rendent la vidéo après `APPROVED`.

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
  render-payload.json     # (si rendu) corps de la requête POST /render, sans schéma ; chemin et empreinte cités
                          # par manifests/renders/<video_id>.json (renderPayload, renderPayloadSha256)
```

## Règle anti-régression

- Le dossier `scripts/<statut>/` correspond toujours au statut **réel** de la vidéo
- Toute promotion de statut = `git mv` du dossier + update `brief.json.status` + entrée `approval.json.history`
- Pas de duplication entre dossiers — une seule SoT par vidéo à un instant T

## V1 — état au 18/10

Un seul pilote sur les 10 prévus (`../README.md`) : `draft/fafa-plaquettes-frein-001/` (#1260, 14/07/2026), statut `DRAFT_ONLY`.
Ses 7 gates sont évaluées par le skill de revue, et aucun des trois drapeaux d'approbation n'est posé (`approval.json`). Son rendu
muet est consigné dans `manifests/renders/fafa-plaquettes-frein-001.json` (#1273). `review-ready/`, `approved/` et `published/`
sont vides (`.gitkeep` seul).
