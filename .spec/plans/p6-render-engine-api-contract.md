# P6 — Render Engine API Contract

> Version: 1.0.0 | Statut: Active | Date: 2026-02-24

## 1. Vue d'ensemble

Le service render (`remotion-renderer`) expose 2 endpoints HTTP synchrones.
Le backend (`RemotionRenderEngine`) est le seul client.

```
Backend (NestJS)                    Render Service (Fastify)
RemotionRenderEngine ──POST /render──▶ render-video.ts
                     ◀──JSON response── s3-upload.ts
                                        │
RenderAdapterService ──GET /health───▶ health.ts
                     ◀──JSON response──
```

## 2. POST /render — Rendu video synchrone

### Request

```json
{
  "schemaVersion": "1.0.0",
  "briefId": "prod-freinage-001",
  "executionLogId": 42,
  "videoType": "film_socle",
  "vertical": "freinage",
  "templateId": "template-brake-v1",
  "composition": "TestCard",
  "outputFormat": "mp4",
  "resolution": { "width": 1920, "height": 1080 },
  "fps": 30,
  "durationSecs": null
}
```

| Champ | Type | Requis | Default | Description |
|-------|------|--------|---------|-------------|
| `schemaVersion` | string | non | `"1.0.0"` | Version du contrat |
| `briefId` | string | **oui** | — | Identifiant production |
| `executionLogId` | int | **oui** | — | ID log d'execution |
| `videoType` | enum | **oui** | — | `film_socle`, `film_gamme`, `short` |
| `vertical` | string | **oui** | — | Verticale metier (ex: freinage) |
| `templateId` | string | non | `null` | Template specifique |
| `composition` | string | non | `"TestCard"` | ID composition Remotion |
| `outputFormat` | enum | non | `"mp4"` | Format sortie |
| `resolution` | object | non | `{1920,1080}` | Resolution en pixels |
| `fps` | int | non | `30` | Images par seconde |
| `durationSecs` | number | non | `null` | Duree forcee (null = duree composition) |

### Response — Succes (200)

```json
{
  "schemaVersion": "1.0.0",
  "status": "success",
  "outputPath": "s3://automecanik-renders/renders/prod-freinage-001/42/1708790400000.mp4",
  "durationMs": 45230,
  "metadata": {
    "codec": "h264",
    "resolution": "1920x1080",
    "fps": 30,
    "fileSizeBytes": 8542100,
    "remotionVersion": "4.0.242",
    "ffmpegVersion": "ffmpeg version 6.1.1",
    "compositionId": "TestCard"
  },
  "errorMessage": null,
  "errorCode": null
}
```

### Response — Echec (500)

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "outputPath": null,
  "durationMs": 12450,
  "metadata": null,
  "errorMessage": "Composition 'Unknown' not found. Available: TestCard",
  "errorCode": "RENDER_PROCESS_FAILED"
}
```

### Response — Validation error (400)

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "outputPath": null,
  "durationMs": 2,
  "metadata": null,
  "errorMessage": "Validation error: briefId is required",
  "errorCode": "INVALID_REQUEST"
}
```

### Error codes service render

| Code | Signification | Retryable |
|------|--------------|-----------|
| `INVALID_REQUEST` | Payload invalide (Zod) | Non |
| `COMPOSITION_NOT_FOUND` | Composition ID inconnue | Non |
| `RENDER_PROCESS_FAILED` | Remotion/FFmpeg crash | Oui |
| `RENDER_TIMEOUT` | Render depasse le timeout interne | Oui |
| `S3_UPLOAD_FAILED` | Upload S3/MinIO echoue | Oui |
| `OUTPUT_EMPTY` | Fichier rendu existe mais taille 0 | Oui |

### Invariants

1. **status=success implique outputPath non null** (Rule 3)
2. **status=failed implique errorCode non null** (Rule 4)
3. **errorCode toujours present si echec** (pas de "unknown" generique si categorie identifiable)
4. **durationMs toujours present** (meme en cas d'echec)
5. **schemaVersion toujours present** dans request et response

## 3. GET /health — Health check

### Response (200)

```json
{
  "status": "ok",
  "schemaVersion": "1.0.0",
  "ffmpegAvailable": true,
  "chromiumAvailable": true,
  "s3Connected": true,
  "timestamp": "2026-02-24T14:30:00.000Z"
}
```

### Interpretation

| status | Signification | Action |
|--------|--------------|--------|
| `ok` | Tout operationnel | Canary eligible |
| `degraded` | ffmpeg ou chromium manquant | Ne pas activer canary |
| `error` | Service en erreur | Fallback stub garanti |

### Timing

- Reponse attendue < 2s (local) / < 5s (remote)
- Si timeout → considerer engine indisponible

## 4. Chemin S3 des outputs

```
s3://{S3_BUCKET_NAME}/renders/{briefId}/{executionLogId}/{timestamp}.mp4
```

Exemple: `s3://automecanik-renders/renders/prod-freinage-001/42/1708790400000.mp4`

## 5. Compatibilite avec P5

Le backend `RemotionRenderEngine` envoie ce payload enrichi. L'ancien format P5 (sans `schemaVersion`, `composition`, `resolution`, `fps`) reste accepte par le service render grace aux defaults Zod.
