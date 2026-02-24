# P6 — Render Environment Contract

> Version: 1.0.0 | Statut: Active | Date: 2026-02-24

## 1. Variables d'environnement — Inventaire complet

### Existantes (P5, inchangees)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VIDEO_PIPELINE_ENABLED` | bool | `false` | Active/desactive le pipeline video complet |
| `VIDEO_GATES_BLOCKING` | bool | `false` | Gates en mode bloquant (vs observe-only) |
| `VIDEO_RENDER_ENGINE` | enum | `stub` | Engine actif: `stub` ou `remotion` |
| `VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES` | csv | `''` | Types video eligibles canary (vide = aucun) |
| `VIDEO_CANARY_ELIGIBLE_TEMPLATE_IDS` | csv | `''` | Templates eligibles (vide = tous) |
| `VIDEO_CANARY_QUOTA_PER_DAY` | int | `10` | Max executions canary par jour UTC |
| `VIDEO_REMOTION_ENDPOINT` | url | `''` | URL HTTP engine Remotion (legacy P5) |
| `VIDEO_REMOTION_TIMEOUT_MS` | int | `120000` | Timeout specifique Remotion (ms) |
| `RENDER_TIMEOUT_MS` | int | `30000` | Timeout stub engine (ms) |

### Nouvelles (P6)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VIDEO_RENDER_ENABLED` | bool | `false` | Coupe-circuit rendu reel (master switch) |
| `VIDEO_RENDER_BASE_URL` | url | `''` | Base URL service render HTTP (ex: `http://remotion_renderer:3100`) |

### Service Render (container remotion-renderer)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RENDER_SERVICE_PORT` | int | `3100` | Port ecoute HTTP service render |
| `CHROMIUM_PATH` | path | `/usr/bin/chromium` | Chemin binaire Chromium |
| `S3_ENDPOINT` | url | `''` | Endpoint S3/MinIO (vide = AWS S3 natif) |
| `S3_BUCKET_NAME` | string | `automecanik-renders` | Bucket pour outputs video |
| `S3_ACCESS_KEY` | secret | `''` | Cle acces S3/MinIO |
| `S3_SECRET_KEY` | secret | `''` | Cle secrete S3/MinIO |
| `S3_REGION` | string | `eu-central-1` | Region S3 |

## 2. Valeurs par environnement

### Dev (localhost)

```env
VIDEO_PIPELINE_ENABLED=false
VIDEO_RENDER_ENGINE=stub
VIDEO_RENDER_ENABLED=false
VIDEO_RENDER_BASE_URL=http://localhost:3100
S3_ENDPOINT=http://localhost:9000
S3_BUCKET_NAME=automecanik-renders-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```

### Preprod

```env
VIDEO_PIPELINE_ENABLED=true
VIDEO_RENDER_ENGINE=stub
VIDEO_RENDER_ENABLED=false
VIDEO_RENDER_BASE_URL=http://remotion_renderer:3100
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=automecanik-renders-preprod
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
```

### Prod (canary actif)

```env
VIDEO_PIPELINE_ENABLED=true
VIDEO_RENDER_ENGINE=remotion
VIDEO_RENDER_ENABLED=true
VIDEO_RENDER_BASE_URL=http://remotion_renderer:3100
VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES=short
VIDEO_CANARY_QUOTA_PER_DAY=5
S3_ENDPOINT=${S3_ENDPOINT}
S3_BUCKET_NAME=automecanik-renders
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
```

## 3. Valeurs interdites

| Variable | Valeur interdite | Raison |
|----------|-----------------|--------|
| `VIDEO_RENDER_ENGINE` | tout sauf `stub`/`remotion` | Seuls 2 engines implementes |
| `VIDEO_CANARY_QUOTA_PER_DAY` | `0` avec engine=remotion | Canary actif mais 0 quota = dead config |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | vide en prod | Upload echouera silencieusement |
| `VIDEO_REMOTION_TIMEOUT_MS` | < 10000 | Aucun rendu reel ne termine en < 10s |

## 4. Dependances systeme (container render)

| Dependance | Version min | Verification |
|-----------|-------------|--------------|
| FFmpeg | 5.x | `ffmpeg -version` |
| Chromium | 120+ | `chromium --version` ou `CHROMIUM_PATH` accessible |
| Node.js | 20.x | `node --version` |
| fonts-liberation | any | Polices texte pour compositions Remotion |

## 5. Endpoints service render

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/health` | Health check (ffmpeg, chromium, s3) |
| POST | `/render` | Rendu video synchrone |

## 6. Hierarchie des flags (priorite)

```
VIDEO_PIPELINE_ENABLED=false → pipeline coupe, rien ne s'execute
  ↓ true
VIDEO_RENDER_ENABLED=false → rendu reel coupe, adapter evalue canary mais engine throw
  ↓ true
VIDEO_RENDER_ENGINE=stub → evaluateCanary() retourne useCanary=false
  ↓ remotion
evaluateCanary() → verifie eligibilite + quota → useCanary true/false
```

Rollback a n'importe quel niveau = retour instantane au comportement precedent.
