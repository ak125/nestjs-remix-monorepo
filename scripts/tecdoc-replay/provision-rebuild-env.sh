#!/usr/bin/env bash
# Provisionne l'environnement de rebuild TecDoc isole. Idempotent, fail-closed.
#
# Ce script ne cree PAS le volume : attacher un disque est une action chez
# l'hebergeur, pas une action d'agent. Il refuse tant que le volume dedie n'est pas
# monte et suffisant (`check-rebuild-capacity.sh`), puis il rend l'environnement
# reproductible et documente.
#
# GARANTIES
#   * PostgreSQL 17, PGDATA sur le volume dedie — jamais sur /
#   * ecoute 127.0.0.1 uniquement — jamais expose au reseau
#   * mot de passe genere localement, jamais affiche, fichier 0600 sur le volume
#   * AUCUN identifiant PROD n'entre dans le container ; le script echoue s'il en voit
#   * refus de reinitialiser un PGDATA existant — un rebuild en cours ne se perd pas
#     par relance distraite
set -uo pipefail
cd "$(dirname "$0")"

MOUNT="${TECDOC_REBUILD_MOUNT:-/mnt/tecdoc-rebuild}"
CONTENEUR="${TECDOC_REBUILD_CONTAINER:-tecdoc-rebuild-pg17}"
PORT="${TECDOC_REBUILD_PORT:-55440}"
IMAGE="postgres:17-alpine"
RAPIDE=0
for a in "$@"; do case "$a" in
  --rapide) RAPIDE=1;;
  --mountpoint=*) MOUNT="${a#*=}";;
  --port=*) PORT="${a#*=}";;
  *) echo "option inconnue : $a"; exit 64;;
esac; done

echo "=== 1/6 — porte de capacite ==="
bash check-rebuild-capacity.sh "$MOUNT" || {
  echo; echo "PROVISIONNEMENT REFUSE — capacite insuffisante."; exit 1; }

echo
echo "=== 2/6 — aucun identifiant PROD dans l'environnement du container ==="
fuite=0
for v in SUPABASE_DB_PASSWORD DATABASE_URL SUPABASE_SERVICE_ROLE_KEY PGPASSWORD; do
  if [ -n "${!v:-}" ]; then echo "  ✗ $v est defini dans le shell appelant"; fuite=1; fi
done
if [ "$fuite" -ne 0 ]; then
  echo "  Le container de rebuild ne doit porter AUCUN acces PROD. Relancer depuis un"
  echo "  shell propre (env -i) — un rebuild qui peut ecrire en PROD n'est pas isole."
  echo; echo "PROVISIONNEMENT REFUSE."; exit 1
fi
echo "  ✓ aucune variable d'acces PROD exportee"

echo
echo "=== 3/6 — arborescence sur le volume dedie ==="
for d in pgdata scratch archive rapports; do
  mkdir -p "$MOUNT/$d"; printf '  %s\n' "$MOUNT/$d"
done
chmod 700 "$MOUNT/pgdata" 2>/dev/null || true
# L'image officielle tourne en postgres(70). Un PGDATA appartenant a l'operateur fait
# boucler le container sur « Permission denied » — panne muette, container `restarting`.
if [ "$(stat -c %u "$MOUNT/pgdata")" != "70" ]; then
  if ! sudo -n chown 70:70 "$MOUNT/pgdata" 2>/dev/null; then
    echo "  ✗ $MOUNT/pgdata doit appartenir a l'uid 70 (postgres de l'image)."
    echo "    Executer : sudo chown 70:70 $MOUNT/pgdata"
    echo; echo "PROVISIONNEMENT REFUSE."; exit 1
  fi
fi

SECRET="$MOUNT/.pgpass-rebuild"
if [ ! -f "$SECRET" ]; then
  umask 077; head -c 32 /dev/urandom | base64 | tr -d '\n=+/' > "$SECRET"; chmod 600 "$SECRET"
  echo "  ✓ mot de passe local genere (32 octets d'entropie, 0600, jamais affiche)"
else
  echo "  · mot de passe local deja present, conserve"
fi

echo
echo "=== 4/6 — container PostgreSQL 17 isole ==="
if [ -s "$MOUNT/pgdata/PG_VERSION" ] && ! docker ps -a --format '{{.Names}}' | grep -qx "$CONTENEUR"; then
  echo "  · PGDATA existant detecte, container absent : re-attachement (aucune reinitialisation)"
fi
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTENEUR"; then
  echo "  · container $CONTENEUR deja present — demarrage sans reinitialisation"
  docker start "$CONTENEUR" >/dev/null
else
  TUNING=(-c shared_buffers=2GB -c work_mem=64MB -c maintenance_work_mem=2GB
          -c max_wal_size=8GB -c min_wal_size=1GB -c checkpoint_timeout=30min
          -c synchronous_commit=off -c autovacuum_work_mem=1GB)
  # `fsync=off` accelere nettement, mais un crash hote corrompt tout le cluster et fait
  # perdre des heures de rejeu. Avec fsync actif, l'idempotence par `_batch_id` permet de
  # reprendre au DLNR pres. Le defaut privilegie donc la reprise, pas la vitesse.
  [ "$RAPIDE" = 1 ] && { TUNING+=(-c fsync=off -c full_page_writes=off)
                         echo "  ⚠ --rapide : fsync desactive, un crash hote impose de tout rejouer"; }
  docker run -d --name "$CONTENEUR" \
    -e POSTGRES_PASSWORD_FILE=/run/secrets/pw -e POSTGRES_DB=rebuild \
    -e PGDATA=/var/lib/postgresql/data/pgdata \
    -v "$MOUNT/pgdata":/var/lib/postgresql/data \
    -v "$MOUNT/scratch":/scratch \
    -v "$SECRET":/run/secrets/pw:ro \
    -p 127.0.0.1:"$PORT":5432 \
    --shm-size=2g \
    --restart unless-stopped \
    "$IMAGE" "${TUNING[@]}" >/dev/null || { echo "  ✗ demarrage impossible"; exit 1; }
  echo "  ✓ $CONTENEUR demarre ($IMAGE), PGDATA sur $MOUNT/pgdata"
fi
pret=0
for _ in $(seq 1 90); do
  if docker exec "$CONTENEUR" pg_isready -U postgres -d rebuild >/dev/null 2>&1; then pret=1; break; fi
  sleep 1
done
if [ "$pret" -ne 1 ]; then
  echo "  ✗ PostgreSQL n'a pas repondu en 90 s. Dernieres lignes du journal :"
  docker logs --tail 12 "$CONTENEUR" 2>&1 | sed 's/^/      /'
  echo; echo "PROVISIONNEMENT ECHOUE — environnement inutilisable."; exit 1
fi
echo "  ✓ PostgreSQL repond"

echo
echo "=== 5/6 — schema ==="
if ! docker exec -i "$CONTENEUR" psql -U postgres -d rebuild -q -v ON_ERROR_STOP=1 \
       < schema-jetable.sql; then
  echo "  ✗ application du schema en echec."
  echo; echo "PROVISIONNEMENT ECHOUE."; exit 1
fi
tables=$(docker exec "$CONTENEUR" psql -U postgres -d rebuild -tAc \
  "select count(*) from information_schema.tables where table_schema in ('tecdoc_raw','tecdoc_map')")
if [ "${tables:-0}" -lt 8 ]; then
  echo "  ✗ $tables table(s) creees, 8 attendues — schema incomplet."
  echo; echo "PROVISIONNEMENT ECHOUE."; exit 1
fi
echo "  ✓ schema applique — $tables tables (tecdoc_raw, tecdoc_map)"

echo
echo "=== 6/6 — environnement documente ==="
docker exec "$CONTENEUR" psql -U postgres -d rebuild -tAc 'select version()' | head -1 | sed 's/^/  /'
printf '  container ........... %s\n' "$CONTENEUR"
printf '  ecoute .............. 127.0.0.1:%s (jamais expose)\n' "$PORT"
printf '  PGDATA .............. %s/pgdata\n' "$MOUNT"
printf '  scratch parsing ..... %s/scratch\n' "$MOUNT"
printf '  archive source ...... %s/archive\n' "$MOUNT"
printf '  rapports de lot ..... %s/rapports\n' "$MOUNT"
printf '  secret local ........ %s (0600, hors Git, jamais affiche)\n' "$SECRET"
printf '  acces PROD .......... AUCUN\n'
df -hPT "$MOUNT" | tail -1 | awk '{printf "  device %s (%s) — %s libres sur %s\n", $1,$2,$5,$3}'
if ! docker exec "$CONTENEUR" psql -U postgres -d rebuild -tAc 'select 1' >/dev/null 2>&1; then
  echo; echo "PROVISIONNEMENT ECHOUE — la base ne repond pas au controle final."; exit 1
fi
echo
echo "PROVISIONNE. Le rejeu complet n'est PAS lance par ce script."
