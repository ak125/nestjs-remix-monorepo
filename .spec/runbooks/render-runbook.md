# Render Service — Runbook Exploitation

> Version: 1.0.0 | Service: remotion-renderer | Port: 3100

## 1. Demarrage

```bash
# Dev (standalone)
cd services/remotion-renderer
docker build -t automecanik/remotion-renderer:dev .
docker run -d --name render-dev -p 3100:3100 \
  -e S3_ENDPOINT=http://host.docker.internal:9000 \
  -e S3_ACCESS_KEY=minioadmin \
  -e S3_SECRET_KEY=minioadmin \
  -e S3_BUCKET_NAME=automecanik-renders-dev \
  automecanik/remotion-renderer:dev

# Prod (via docker-compose)
docker compose -f docker-compose.prod.yml up -d remotion_renderer
```

## 2. Arret

```bash
# Dev
docker stop render-dev && docker rm render-dev

# Prod
docker compose -f docker-compose.prod.yml stop remotion_renderer
```

**Impact arret en prod:** Si `VIDEO_RENDER_ENGINE=remotion`, les rendus canary echoueront et le fallback stub prendra le relais automatiquement. Aucun impact sur le pipeline stub.

## 3. Health validation

```bash
# Check rapide
curl -sf http://localhost:3100/health | jq .

# Check automatise
curl -sf http://localhost:3100/health | jq -e '.status == "ok" and .ffmpegAvailable == true and .chromiumAvailable == true'
```

**Reponse attendue:**
```json
{"status":"ok","schemaVersion":"1.0.0","ffmpegAvailable":true,"chromiumAvailable":true,"s3Connected":true}
```

**Si degraded:**
- `ffmpegAvailable: false` → FFmpeg non installe ou non dans PATH
- `chromiumAvailable: false` → Chromium absent ou `CHROMIUM_PATH` incorrect
- `s3Connected: false` → MinIO/S3 inaccessible ou credentials invalides

## 4. Logs

```bash
# Derniers logs
docker logs remotion-renderer-prod --tail 100

# Suivre en temps reel
docker logs -f remotion-renderer-prod

# Filtrer erreurs
docker logs remotion-renderer-prod 2>&1 | grep -i error
```

## 5. Debug: Timeout rendu

**Symptome:** Execution log montre `errorCode: RENDER_ENGINE_TIMEOUT`

**Diagnostic:**
```bash
# Verifier timeout configure
docker exec remotion-renderer-prod printenv | grep TIMEOUT

# Tester rendu minimal
curl -X POST http://localhost:3100/render \
  -H "Content-Type: application/json" \
  -d '{"briefId":"debug","executionLogId":0,"videoType":"short","vertical":"test"}' \
  --max-time 180
```

**Solutions:**
1. Augmenter `VIDEO_REMOTION_TIMEOUT_MS` (default 120000)
2. Verifier charge CPU/RAM du container: `docker stats remotion-renderer-prod`
3. Premier rendu est toujours lent (bundle Webpack ~30s) — les suivants sont plus rapides

## 6. Debug: FFmpeg manquant

**Symptome:** Health retourne `ffmpegAvailable: false`

```bash
# Verifier dans le container
docker exec remotion-renderer-prod ffmpeg -version
docker exec remotion-renderer-prod which ffmpeg
```

**Solution:** Reconstruire l'image Docker (FFmpeg est installe dans le Dockerfile).

## 7. Debug: Composition introuvable

**Symptome:** `errorCode: COMPOSITION_NOT_FOUND`

```bash
# Lister compositions disponibles
docker exec remotion-renderer-prod node -e "
  const { getCompositions } = require('@remotion/renderer');
  // Requires bundled entry, check logs for available compositions
"
```

**Solution:** Verifier que `src/compositions/index.tsx` enregistre la composition demandee.

## 8. Debug: S3/MinIO upload echoue

**Symptome:** `errorCode: S3_UPLOAD_FAILED`

```bash
# Verifier connectivite MinIO
docker exec remotion-renderer-prod wget -qO- http://minio:9000/minio/health/live

# Verifier credentials
docker exec remotion-renderer-prod printenv | grep S3_

# Tester upload manuellement
docker exec remotion-renderer-prod node -e "
  const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'eu-central-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }
  });
  s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET_NAME }))
    .then(() => console.log('OK'))
    .catch(e => console.error('FAIL:', e.message));
"
```

## 9. Rollback — Procedures

### Rollback niveau 1: Desactiver rendu reel (< 1 min)

```bash
# Dans docker-compose.prod.yml, changer:
VIDEO_RENDER_ENGINE=stub
# Puis:
docker compose -f docker-compose.prod.yml up -d monorepo_prod
```

Effet: `evaluateCanary()` retourne `useCanary:false` immediatement. Pipeline continue en stub.

### Rollback niveau 2: Coupe-circuit rendu (< 1 min)

```bash
# Dans docker-compose.prod.yml, changer:
VIDEO_RENDER_ENABLED=false
# Puis:
docker compose -f docker-compose.prod.yml up -d monorepo_prod
```

Effet: `RemotionRenderEngine.render()` throw immediatement → adapter fallback stub.

### Rollback niveau 3: Arret service render

```bash
docker compose -f docker-compose.prod.yml stop remotion_renderer
```

Effet: Requetes HTTP vers render echouent → adapter fallback stub automatique.

### Rollback niveau 4: Revert code (dernier recours)

```bash
git revert HEAD  # revert dernier commit P6
git push origin main
```

## 10. Ressources recommandees

| Ressource | Min | Recommande |
|-----------|-----|-----------|
| CPU | 1 core | 2 cores |
| RAM | 2 GB | 4 GB |
| Disque /tmp | 1 GB | 5 GB (videos temporaires) |
| Reseau | interne Docker | meme network que backend + MinIO |
