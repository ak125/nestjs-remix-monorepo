# Fafa Media Factory — V1 Foundation

> **Zone éditoriale non-runtime** pour la production de vidéos courtes AutoMecanik.
> Extension du workspace marketing existant (ADR-036). Aucun impact runtime e-commerce.

## Pourquoi cette zone

Le moteur Remotion (`services/remotion-renderer/`) existe et fonctionne. Le backend orchestrateur `media-factory/`, supprimé le 2026-04-10 (CVE axios transitive des dépendances TTS), a été rétabli le 2026-06-20 (#1043) derrière le drapeau `MEDIA_FACTORY_ENABLED`, OFF par défaut : tant qu'il est OFF, ni le module HTTP ni le processeur BullMQ ne sont enregistrés (`backend/src/modules/media-factory/media-factory.flag.ts`). Code présent ne veut pas dire activé : V1 n'en dépend pas et prouve le **système éditorial** (Fafa persona + creative intel + gouvernance + 10 pilotes DRAFT_ONLY) en mode fichiers + skills + Remotion appelé manuellement via HTTP.

V2 (différée post-mesure) : recâblage backend + admin UI + DB matérialisée.

## Périmètre V1

- ✅ Fafa persona comme voix de marque distincte
- ✅ Creative pattern extraction copyright-safe (statut `INSPIRED_PATTERN_ONLY`)
- ✅ Script Factory original avec claims + evidence + disclaimer
- ✅ 7 gates de gouvernance vidéo (P0 spec) applicables manuellement
- ✅ 3 templates Remotion (#794, 29/05/2026)
- ⏳ 10 vidéos DRAFT_ONLY : 1 pilote au 18/10 (`scripts/draft/fafa-plaquettes-frein-001/`, #1260), rendu muet (#1273)

**Hors V1** : backend, DB, admin UI, BullMQ queue, publication automatique, 11ᵉ vidéo, brief LOCAL/HYBRID (bloqués tant que `local_canon.validated: false`).

## Workflow scripts (8 statuts)

```
DISCOVERED              # pattern repéré ; asset source jamais stocké/committé (analyse éphémère /watch OK, REFERENCE_ANALYSIS_ONLY, hors repo)
  ↓
PATTERN_EXTRACTED       # Skill creative-pattern-extractor → JSONL
  ↓
INSPIRED_PATTERN_ONLY   # transformé en brief Fafa original (anti-recyclage)
  ↓
DRAFT_ONLY              # Skill fafa-script-generator → scripts/draft/
  ↓
REVIEW_READY            # Skill fafa-brand-safety-reviewer 7 gates → scripts/review-ready/
  ↓
APPROVED                # owner signe Approval Record → scripts/approved/
  ↓ (render Remotion via skill fafa-remotion-template-planner)
  ↓ (manifest JSON → manifests/renders/)
PUBLISHED               # owner publie manuellement → scripts/published/
  ↓
MEASURED                # KPIs CSV J+7 → skill fafa-performance-analyzer
```

**STOP V1** : aucune publication automatique. `publish_approved=false` strict par défaut.

## Approval Record — 3 flags discriminés

```jsonc
{
  "content_approved": false,   // owner : script + claims + evidence + disclaimer valides (verdict du skill brand-safety en entrée)
  "render_approved": false,    // owner a inspecté le .mp4
  "publish_approved": false    // owner geste explicite séparé pour publier
}
```

Une vidéo `content_approved=true + render_approved=true + publish_approved=false` = prête, et reste dans `scripts/approved/` tant que l'owner n'a pas signé la publication.

Qui pose `content_approved` (l'owner, règle AI2 du vault) et à quel statut la vidéo est rendue (non tranché) : voir
`scripts/README.md`, qui relève les écarts entre documents.

## Stockage — règle stricte

| Élément | Lieu |
|---|---|
| Patterns inspiration (metadata) | `inspiration/patterns/*.jsonl` (repo) |
| Scripts + claims + evidence + approval | `scripts/{statut}/*.json` (repo) |
| Schemas governance | `governance/*.schema.json` (repo) |
| Manifests renders (checksum + S3 key) | `manifests/renders/*.json` (repo) |
| **Vidéos `.mp4` / `.srt` / `.wav`** | **S3 exclusif** (`s3://automecanik-renders/pilots/`) — JAMAIS dans le repo |
| Métriques performance | `manifests/metrics/video-performance.csv` (MVP V1 only, **PAS SoT**) |

Le `.gitignore` racine bloque `*.mp4`/`*.srt`/`*.wav`/`*.mov`/`*.webm`/`*.mkv` globalement.

## Métriques V1

`manifests/metrics/video-performance.csv` est explicitement **outil de saisie/export temporaire**, pas source de vérité. V2 → table `__video_kpi_*` ou manifest JSON structuré.

## Liens canon

- Doctrine vidéo : `.spec/00-canon/video-governance-p0.md` (7 gates, 5 artefacts, 3 modes)
- Brand voice : `.claude/canon-mirrors/marketing-voice.md` (ECOMMERCE / LOCAL / HYBRID)
- Fafa persona : `personas/fafa.md`. La règle vault `rules-fafa-persona-canon-v1.md` qu'il désigne est introuvable au 18/10 (`main` du
  vault, `eb97222`) ; aucune des 355 PR du vault ne cite Fafa ni persona dans son titre.
- Frontière auto-publication : aucune ADR vault dédiée au 18/10. Elle tient à ADR-036 (`accepted`), anti-pattern 6 « Pas d'agent qui
  publie (validation humaine AI4) », et à `publish_approved` posé par l'owner seul. Media Factory s'arrête à `scripts/approved/`.

## Skills associés

Sous `workspaces/marketing/.claude/skills/` (chargés uniquement en session `cd workspaces/marketing && claude`) :

1. `fafa-persona-canon` — lock persona Fafa
2. `creative-pattern-extractor` — extraction patterns copyright-safe
3. `fafa-script-generator` — script original Fafa depuis brief
4. `fafa-video-prompt-builder` — prompts downstream (Higgsfield MCP prioritaire)
5. `fafa-brand-safety-reviewer` — 7 gates verdict
6. `fafa-remotion-template-planner` — choix template + payload `/render`
7. `fafa-performance-analyzer` — analyse CSV → next batch

## Phase actuelle

État au 18/10 :

- **PR #1 Foundation** : fusionnée (#789, 29/05/2026).
- **PR #2 Remotion** : fusionnée (#794, 29/05/2026), 3 compositions.
- **PR #3 Pilotes** : 1 pilote sur 10, `DRAFT_ONLY` (#1260, 14/07/2026), rendu muet sans voix ni avatar (#1273) ; aucun drapeau
  d'approbation posé.
