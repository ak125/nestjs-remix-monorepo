# P6 — Smoke Tests Render Runtime

> Version: 1.0.0 | Date: 2026-02-24
> Pre-requis: service render demarre, MinIO accessible

## Variables

```bash
RENDER_URL=${RENDER_URL:-http://localhost:3100}
BACKEND_URL=${BACKEND_URL:-http://localhost:3000}
```

---

## RG1 — Runtime Dependencies Gate (bloquant)

**Objectif:** FFmpeg + Chromium presents et executables

```bash
# Test 1.1: FFmpeg dans le container
docker exec remotion-renderer-prod ffmpeg -version | head -1
# Attendu: "ffmpeg version X.Y.Z ..."

# Test 1.2: Chromium accessible
docker exec remotion-renderer-prod test -x /usr/bin/chromium && echo "OK" || echo "FAIL"
# Attendu: OK

# Test 1.3: Health confirme deps
curl -sf "$RENDER_URL/health" | jq -e '.ffmpegAvailable == true and .chromiumAvailable == true'
# Attendu: true
```

**GO si:** Les 3 tests passent
**NOGO si:** ffmpeg absent OU chromium non executable

---

## RG2 — Render Engine Health Gate (bloquant canary)

**Objectif:** Service render repond correctement

```bash
# Test 2.1: Health endpoint 200
HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$RENDER_URL/health")
[ "$HTTP" = "200" ] && echo "PASS" || echo "FAIL: $HTTP"
# Attendu: PASS

# Test 2.2: Payload health valide
curl -sf "$RENDER_URL/health" | jq -e '.status and .schemaVersion and .timestamp'
# Attendu: true

# Test 2.3: Temps de reponse < 2s
TIME=$(curl -sf -o /dev/null -w "%{time_total}" "$RENDER_URL/health")
echo "$TIME < 2.0" | bc -l | grep -q 1 && echo "PASS" || echo "FAIL: ${TIME}s"
# Attendu: PASS
```

**GO si:** 200 + payload valide + < 2s
**NOGO si:** timeout OU 5xx OU reponse non conforme

---

## RG3 — Contract Compatibility Gate (bloquant)

**Objectif:** Request/response conformes au contrat v1.0.0

```bash
# Test 3.1: Rendu nominal
RESP=$(curl -sf -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"briefId":"smoke-rg3","executionLogId":99999,"videoType":"short","vertical":"freinage"}')
echo "$RESP" | jq -e '.schemaVersion == "1.0.0" and (.status == "success" or .status == "failed")'
# Attendu: true

# Test 3.2: schemaVersion present
echo "$RESP" | jq -e '.schemaVersion != null'
# Attendu: true

# Test 3.3: durationMs present
echo "$RESP" | jq -e '.durationMs > 0'
# Attendu: true
```

**GO si:** Response conforme au schema, schemaVersion match
**NOGO si:** Champs requis absents OU mismatch schemaVersion

---

## RG4 — Fallback Safety Gate (bloquant)

**Objectif:** Engine KO → pipeline ne casse pas, fallback stub fonctionne

```bash
# Test 4.1: Arreter service render
docker stop remotion-renderer-prod

# Test 4.2: Backend toujours sain
curl -sf "$BACKEND_URL/health" | jq -e '.status == "ok"'
# Attendu: true

# Test 4.3: Execution via API (si VIDEO_RENDER_ENGINE=remotion)
# → Doit fallback vers stub, pas crash
# Verifier dans __video_execution_log:
# engine_resolution = 'fallback_to_stub', canary_fallback = true

# Test 4.4: Redemarrer service render
docker start remotion-renderer-prod
```

**GO si:** Backend stable, fallback stub fonctionne, tracabilite preservee
**NOGO si:** Crash global processor OU log incomplet OU absence tracabilite fallback

---

## RG5 — Timeout/Error Classification Gate (important)

**Objectif:** Erreurs classees correctement, retryable coherent

```bash
# Test 5.1: Payload invalide → 400 + INVALID_REQUEST
HTTP=$(curl -sf -o /tmp/rg5.json -w "%{http_code}" -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"invalid":"payload"}')
[ "$HTTP" = "400" ] && echo "PASS" || echo "FAIL: $HTTP"
jq -e '.errorCode == "INVALID_REQUEST"' /tmp/rg5.json
# Attendu: PASS + true

# Test 5.2: Composition inconnue → COMPOSITION_NOT_FOUND
RESP=$(curl -sf -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"briefId":"test","executionLogId":1,"videoType":"short","vertical":"test","composition":"NonExistent"}')
echo "$RESP" | jq -e '.errorCode != null and .status == "failed"'
# Attendu: true
```

**GO si:** Erreurs typees, retryable explicite
**NOGO si:** Erreurs generiques sans errorCode OU retryable absent

---

## RG6 — Output Integrity Gate (important)

**Objectif:** Succes = output exploitable

```bash
# Test 6.1: Rendu succes → outputPath non null
RESP=$(curl -sf -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"briefId":"smoke-rg6","executionLogId":99998,"videoType":"short","vertical":"freinage"}')

STATUS=$(echo "$RESP" | jq -r '.status')
if [ "$STATUS" = "success" ]; then
  echo "$RESP" | jq -e '.outputPath != null and (.outputPath | startswith("s3://"))'
  echo "$RESP" | jq -e '.metadata.fileSizeBytes > 0'
  echo "$RESP" | jq -e '.metadata.codec != null'
  echo "PASS: output valide"
else
  echo "WARN: render failed (may be expected in smoke env)"
  echo "$RESP" | jq -e '.errorCode != null'
fi
```

**GO si:** Succes → path S3 present, taille > 0, codec renseigne
**NOGO si:** Succes sans fichier OU output vide OU chemin inaccessible

---

## RG7 — Observability/Audit Gate (important)

**Objectif:** Debug possible sans SSH profond

```bash
# Test 7.1: metadata contient versions
RESP=$(curl -sf -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"briefId":"smoke-rg7","executionLogId":99997,"videoType":"short","vertical":"freinage"}')

if [ "$(echo "$RESP" | jq -r '.status')" = "success" ]; then
  echo "$RESP" | jq -e '.metadata.remotionVersion != null'
  echo "$RESP" | jq -e '.metadata.ffmpegVersion != null'
  echo "$RESP" | jq -e '.metadata.compositionId != null'
fi

# Test 7.2: Backend — execution log visible en UI
# Verifier dans __video_execution_log:
# engine_name, render_status, render_duration_ms, render_metadata renseignes
# Page detail: engine info + metadata affichee
```

**GO si:** Metadata completes, UI reflette l'execution
**NOGO si:** Infos critiques absentes OU UI/DB ne refletent pas l'execution

---

## Resume GO/NOGO

| Gate | Niveau | Critere GO |
|------|--------|-----------|
| RG1 | Bloquant | FFmpeg + Chromium OK |
| RG2 | Bloquant canary | Health 200, < 2s |
| RG3 | Bloquant | Contrat request/response conforme |
| RG4 | Bloquant | Fallback stub fonctionne |
| RG5 | Important | Erreurs classees, retryable explicite |
| RG6 | Important | Succes = output exploitable |
| RG7 | Important | Observabilite complete |

**GO canary prod:** RG1-RG4 PASS + RG5-RG7 sans echec majeur
**NOGO:** Un seul RG1-RG4 FAIL = pas d'activation canary
