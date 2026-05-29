---
name: fafa-remotion-template-planner
description: Use when choosing the right Remotion composition (NeChangePasTropVite / SymptomeTroisCauses / PieceExpliquee) for a given Fafa script + format + duration target, and building the /render HTTP payload. Triggers — "render vidéo pilote", "préparer Remotion payload", "smoke render Fafa".
---

# Fafa Remotion Template Planner — Skill

> Choisit la composition Remotion appropriée et construit le payload `POST /render` pour le `services/remotion-renderer/` (port 3100).

## Quand invoquer

- Après statut APPROVED + prompts générés (`fafa-video-prompt-builder` complété)
- Pour smoke render (PR #2 livre les 3 compositions)
- Pour itérer un render qui a FAIL render_approval

## Pré-requis

- Script APPROVED + 3 flags : `content_approved=true` (les autres restent à false avant render)
- Asset voix uploadé S3 (référencé via `voiceUrl`)
- Optionnel : assets b-roll Higgsfield S3 (référencés via `brollAssets[]`)
- Composition Remotion enregistrée dans `services/remotion-renderer/src/registry.ts` (livré PR #2)

## Décision template selon format

| Format brief | Composition Remotion | Durée cible | Aspect |
|---|---|---|---|
| `ne-change-pas-trop-vite` | `NeChangePasTropVite` | 30-45 s | 9:16 (1080×1920) |
| `symptome-3-causes` | `SymptomeTroisCauses` | 25-40 s | 9:16 (1080×1920) |
| `piece-expliquee` | `PieceExpliquee` | 30-50 s | 9:16 (1080×1920) |

## Payload `/render` HTTP

```bash
curl -X POST http://localhost:3100/render \
  -H 'Content-Type: application/json' \
  -d @payload.json
```

`payload.json` aligné sur les props de la composition (voir `formats/<format>.md` interface TypeScript).

Exemple pour `NeChangePasTropVite` :

```json
{
  "briefId": "fafa-vanne-egr-001",
  "videoType": "short",
  "composition": "NeChangePasTropVite",
  "resolution": { "width": 1080, "height": 1920 },
  "fps": 30,
  "durationSecs": 38,
  "props": {
    "hook": "Perte de puissance et fumée noire ? Ne change pas ta vanne EGR trop vite.",
    "symptom": "Perte de puissance + fumée noire",
    "pieceWrong": "vanne EGR",
    "causes": [
      { "cause": "Filtre à air bouché", "duration_sec": 8, "check_suggestion": "Inspection visuelle" },
      { "cause": "Débitmètre fatigué", "duration_sec": 4, "check_suggestion": "Test multimètre" },
      { "cause": "Durite percée", "duration_sec": 3, "check_suggestion": "Visuel + écoute" }
    ],
    "advice": "Vérifie dans l'ordre : visuel → multimètre → atelier",
    "cta": "Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.",
    "disclaimer": "Conseil informatif. Diagnostic à confirmer selon véhicule.",
    "voiceUrl": "s3://automecanik-renders/pilots/fafa-vanne-egr-001/voice.wav",
    "brollAssets": [
      {
        "s3_key": "s3://automecanik-renders/higgsfield/fafa-vanne-egr-001/broll-001.mp4",
        "visual_type": "schema",
        "timestamp_sec": 8,
        "truth_dependency": "illustration"
      }
    ]
  }
}
```

## Réponse attendue `/render`

```json
{
  "renderId": "render-...",
  "status": "completed",
  "render_s3_key": "s3://automecanik-renders/pilots/fafa-vanne-egr-001/main.mp4",
  "srt_s3_key": "s3://automecanik-renders/pilots/fafa-vanne-egr-001/captions.srt",
  "checksum_sha256": "...",
  "duration_secs": 38,
  "fileSizeBytes": 4521234,
  "codec": "h264",
  "remotionVersion": "4.0.242",
  "ffmpegVersion": "...",
  "rendered_at": "2026-05-28T..."
}
```

## Workflow

1. Charger script APPROVED + brief + format spec
2. Mapper format → composition Remotion
3. Construire props depuis script + assets
4. POST `/render`
5. Récupérer manifest → écrire dans `manifests/renders/<video_id>.json` (avec 3 flags approval `false` par défaut)
6. Owner inspecte `.mp4` S3 → met `render_approved=true` si conforme
7. Trigger Skill `fafa-brand-safety-reviewer` une dernière fois (G6 sur asset réel)

## Règles strictes

- ❌ Aucun render committé dans repo (`.gitignore` racine bloque)
- ❌ Aucune composition non listée dans le tableau ci-dessus en V1
- ✅ `voiceUrl` toujours présent (voix obligatoire V1)
- ✅ `brollAssets` optionnels (Fafa V1 peut tourner sans avatar IA)
- ✅ Tous assets `truth_dependency` = `illustration` ou `reference` (jamais `proof`)

## Verdict

```json
{
  "skill": "fafa-remotion-template-planner",
  "video_id": "fafa-vanne-egr-001",
  "composition": "NeChangePasTropVite",
  "payload_path": "renders/fafa-vanne-egr-001/payload.json",
  "render_triggered": true,
  "render_id": "render-...",
  "manifest_path": "manifests/renders/fafa-vanne-egr-001.json"
}
```

## Voir aussi

- `[[fafa-script-generator]]`
- `[[fafa-video-prompt-builder]]`
- `[[fafa-brand-safety-reviewer]]` (G6 sur asset réel)
- `services/remotion-renderer/` (microservice port 3100)
- `workspaces/marketing/fafa-media-factory/formats/`
