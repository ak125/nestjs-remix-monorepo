#!/usr/bin/env bash
# Banc hermetique pour tourner-secret-db.py.
#
# L'API Supabase est remplacee par un double qui applique VRAIMENT le changement
# sur un PostgreSQL jetable. On verifie donc la mecanique complete — ordre des
# etapes, codes de sortie, ecriture du .env, non-divulgation du secret — sans
# jamais toucher a une base reelle.
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTENEUR="banc-rotation-secret"
PORT=55451
TRAVAIL="$(mktemp -d)"
OK=0
KO=0

verifier() { # libelle, attendu, obtenu
  if [ "$2" = "$3" ]; then
    printf '  \033[32mOK\033[0m   %s\n' "$1"; OK=$((OK + 1))
  else
    printf '  \033[31mKO\033[0m   %s — attendu «%s», obtenu «%s»\n' "$1" "$2" "$3"; KO=$((KO + 1))
  fi
}

nettoyer() { docker rm -f "$CONTENEUR" >/dev/null 2>&1; rm -rf "$TRAVAIL"; }
trap nettoyer EXIT

echo "=== PostgreSQL jetable ==="
docker rm -f "$CONTENEUR" >/dev/null 2>&1
docker run -d --name "$CONTENEUR" -e POSTGRES_PASSWORD=depart \
  -p "127.0.0.1:$PORT:5432" --tmpfs /var/lib/postgresql/data:rw,size=256m \
  postgres:17-alpine >/dev/null
for _ in $(seq 1 40); do
  docker exec "$CONTENEUR" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1
done
docker exec "$CONTENEUR" pg_isready -U postgres >/dev/null 2>&1 \
  || { echo "  le conteneur n'a pas demarre"; exit 1; }
echo "  pret sur 127.0.0.1:$PORT"
echo

# Double de l'API : applique le changement comme le ferait Supabase.
cat > "$TRAVAIL/faux_api.py" <<'PY'
import importlib.util, sys
spec = importlib.util.spec_from_file_location("outil", sys.argv[1])
outil = importlib.util.module_from_spec(spec); spec.loader.exec_module(outil)

CODE = int(sys.argv[2])          # code HTTP simule pour le PATCH
PORT = int(sys.argv[3])
CODE_JETON = int(sys.argv[4])    # code HTTP simule pour le preflight GET

def faux_jeton(projet, jeton):
    return CODE_JETON, '{"id":"simule"}' if CODE_JETON == 200 else '{"message":"simule"}'

def faux(projet, secret, jeton):
    if CODE != 200:
        return CODE, '{"message":"simule"}'
    import psycopg2
    from psycopg2 import sql
    c = psycopg2.connect(host="127.0.0.1", port=PORT, user="postgres",
                         password="depart", dbname="postgres")
    c.autocommit = True
    with c.cursor() as cur:
        cur.execute(sql.SQL("ALTER USER postgres WITH PASSWORD {}").format(sql.Literal(secret)))
    c.close()
    return 200, "{}"

outil.appeler_api = faux
outil.verifier_jeton = faux_jeton
sys.exit(outil.main(sys.argv[5:]))
PY

lancer() { # code-http-PATCH, arguments...
  local code="$1"; shift
  python3 "$TRAVAIL/faux_api.py" "$ICI/tourner-secret-db.py" "$code" "$PORT" 200 \
    --projet banc --hote 127.0.0.1 --port "$PORT" --utilisateur postgres "$@"
}

lancer_jeton() { # code-http-preflight, arguments...
  local code="$1"; shift
  python3 "$TRAVAIL/faux_api.py" "$ICI/tourner-secret-db.py" 200 "$PORT" "$code" \
    --projet banc --hote 127.0.0.1 --port "$PORT" --utilisateur postgres "$@"
}

# --- 1. cas nominal ------------------------------------------------------
echo "=== 1. rotation complete ==="
printf 'AUTRE=garde\nSUPABASE_DB_PASSWORD=depart\nENCORE=garde\n' > "$TRAVAIL/reference.env"
cp "$TRAVAIL/reference.env" "$TRAVAIL/cible.env"
SORTIE="$(SUPABASE_ACCESS_TOKEN=factice lancer 200 \
  --reference "$TRAVAIL/reference.env" --env "$TRAVAIL/cible.env" \
  --coffre "$TRAVAIL/coffre.txt" 2>&1)"; CODE=$?
echo "$SORTIE" | sed 's/^/    /'
verifier "code de sortie 0" 0 "$CODE"
verifier "verdict ROTATED" 1 "$(echo "$SORTIE" | grep -c '^ROTATED$')"
verifier "nouveau secret accepte" 1 "$(echo "$SORTIE" | grep -c 'nouveau secret  : ACCEPTE')"
verifier "ancien secret refuse en 28P01" 1 "$(echo "$SORTIE" | grep -c 'ancien secret   : REFUSE (28P01)')"

NEUF="$(cat "$TRAVAIL/coffre.txt")"
verifier "le coffre est en 0600" 600 "$(stat -c '%a' "$TRAVAIL/coffre.txt")"
verifier "le .env porte la valeur du coffre" "SUPABASE_DB_PASSWORD=$NEUF" \
  "$(grep '^SUPABASE_DB_PASSWORD=' "$TRAVAIL/cible.env")"
verifier "les autres lignes sont intactes" 2 "$(grep -c '=garde$' "$TRAVAIL/cible.env")"
verifier "une sauvegarde a ete deposee" 1 \
  "$(find "$TRAVAIL" -name 'cible.env.avant-rotation-*' | wc -l)"
verifier "la sauvegarde porte l'ancienne valeur" 1 \
  "$(grep -hc '^SUPABASE_DB_PASSWORD=depart$' "$TRAVAIL"/cible.env.avant-rotation-* )"
# Le point central : le secret ne doit apparaitre nulle part dans la sortie.
verifier "le secret n'est jamais affiche" 0 "$(echo "$SORTIE" | grep -cF "$NEUF")"
# Trois empreintes doivent sortir : celle de l'ancien, celle du neuf au moment de
# la mise a l'abri, celle relue dans le .env. Elles sont la seule forme sous laquelle
# une valeur de secret a le droit d'apparaitre.
verifier "trois empreintes de 12 signes hexadecimaux" 3 \
  "$(echo "$SORTIE" | grep -oE '\b[0-9a-f]{12}\b' | wc -l)"
verifier "l'empreinte relue est celle du secret engendre" 2 \
  "$(echo "$SORTIE" | grep -oE '\b[0-9a-f]{12}\b' | sort | uniq -c | awk '$1==2{print $1}')"

# --- 2. l'identifiant de reference n'ouvre pas la base --------------------
echo
echo "=== 2. etat de depart inexploitable (attendu : 2, aucun changement) ==="
printf 'SUPABASE_DB_PASSWORD=faux\n' > "$TRAVAIL/mauvais.env"
cp "$TRAVAIL/cible.env" "$TRAVAIL/cible2.env"
SORTIE="$(SUPABASE_ACCESS_TOKEN=factice lancer 200 \
  --reference "$TRAVAIL/mauvais.env" --env "$TRAVAIL/cible2.env" \
  --coffre "$TRAVAIL/coffre2.txt" 2>&1)"; CODE=$?
verifier "code de sortie 2" 2 "$CODE"
verifier "aucun coffre ecrit" 0 "$([ -f "$TRAVAIL/coffre2.txt" ] && echo 1 || echo 0)"
verifier "le .env n'a pas bouge" 0 "$(diff -q "$TRAVAIL/cible.env" "$TRAVAIL/cible2.env" >/dev/null && echo 0 || echo 1)"
verifier "un refus d'auth n'est pas confondu avec une panne" 1 \
  "$(echo "$SORTIE" | grep -c '28P01')"

# --- 3. l'API refuse -----------------------------------------------------
echo
echo "=== 3. l'API refuse l'appel (attendu : 6, .env intact) ==="
printf 'SUPABASE_DB_PASSWORD=%s\n' "$NEUF" > "$TRAVAIL/reference3.env"
cp "$TRAVAIL/cible.env" "$TRAVAIL/cible3.env"
SORTIE="$(SUPABASE_ACCESS_TOKEN=factice lancer 403 \
  --reference "$TRAVAIL/reference3.env" --env "$TRAVAIL/cible3.env" \
  --coffre "$TRAVAIL/coffre3.txt" 2>&1)"; CODE=$?
verifier "code de sortie 6" 6 "$CODE"
verifier "le .env n'a pas bouge" 0 "$(diff -q "$TRAVAIL/cible.env" "$TRAVAIL/cible3.env" >/dev/null && echo 0 || echo 1)"
verifier "le secret engendre est conserve, pas perdu" 1 \
  "$([ -s "$TRAVAIL/coffre3.txt" ] && echo 1 || echo 0)"
verifier "l'appel a bien ete tente avant d'abandonner" 1 \
  "$(echo "$SORTIE" | grep -c 'HTTP 403')"

# --- 4. le .env cible n'a pas la cle -------------------------------------
echo
echo "=== 4. cle absente du .env cible (refus d'ecrire a l'aveugle) ==="
printf 'RIEN=ici\n' > "$TRAVAIL/vide.env"
SORTIE="$(SUPABASE_ACCESS_TOKEN=factice lancer 200 \
  --reference "$TRAVAIL/reference3.env" --env "$TRAVAIL/vide.env" \
  --coffre "$TRAVAIL/coffre4.txt" 2>&1)"; CODE=$?
verifier "sortie non nulle" 1 "$([ "$CODE" -ne 0 ] && echo 1 || echo 0)"
verifier "aucune ligne ajoutee a l'aveugle" 0 \
  "$(grep -c '^SUPABASE_DB_PASSWORD=' "$TRAVAIL/vide.env")"

# --- 4b. le jeton n'ouvre pas le projet ----------------------------------
echo
echo "=== 4b. preflight du jeton (attendu : 6, RIEN engendre) ==="
cp "$TRAVAIL/cible.env" "$TRAVAIL/cible4b.env"
for HTTP in 401 403 404; do
  SORTIE="$(SUPABASE_ACCESS_TOKEN=factice lancer_jeton "$HTTP" \
    --reference "$TRAVAIL/reference3.env" --env "$TRAVAIL/cible4b.env" \
    --coffre "$TRAVAIL/coffre4b.txt" 2>&1)"; CODE=$?
  verifier "HTTP $HTTP -> code de sortie 6" 6 "$CODE"
  verifier "HTTP $HTTP -> aucun secret engendre" 0 \
    "$([ -f "$TRAVAIL/coffre4b.txt" ] && echo 1 || echo 0)"
  verifier "HTTP $HTTP -> arret avant l'etat de depart" 0 \
    "$(echo "$SORTIE" | grep -c '1/5')"
done
verifier "le .env n'a pas bouge" 0 \
  "$(diff -q "$TRAVAIL/cible.env" "$TRAVAIL/cible4b.env" >/dev/null && echo 0 || echo 1)"

# --- 4c. jeton vide : diagnostic explicite du piege du collage -----------
echo
echo "=== 4c. jeton vide (le piege de read sans /dev/tty) ==="
SORTIE="$(SUPABASE_ACCESS_TOKEN="" lancer 200 \
  --reference "$TRAVAIL/reference3.env" --env "$TRAVAIL/cible4b.env" \
  --coffre "$TRAVAIL/coffre4c.txt" 2>&1)"; CODE=$?
verifier "code de sortie 3" 3 "$CODE"
# Deux choses distinctes doivent sortir : la commande corrigee, et la RAISON.
# Donner la commande sans la raison ferait recopier un incantatoire.
verifier "la commande corrigee est donnee" 1 \
  "$(echo "$SORTIE" | grep -c 'read -rsp .* < /dev/tty')"
verifier "la raison du /dev/tty est expliquee" 1 \
  "$(echo "$SORTIE" | grep -c "n'est pas decoratif")"
verifier "aucun secret engendre" 0 "$([ -f "$TRAVAIL/coffre4c.txt" ] && echo 1 || echo 0)"

# --- 5. non-regression : aucun pointeur en dur ---------------------------
echo
echo "=== 5. le script ne contient aucun pointeur ==="
verifier "aucune reference de projet, de depot ni de secret" 0 \
  "$(grep -cE 'cxpojprg|sbp_|automecanik|\.env\.bak' "$ICI/tourner-secret-db.py")"

echo
printf '=== %s assertions · %s OK · %s KO ===\n' "$((OK + KO))" "$OK" "$KO"
[ "$KO" -eq 0 ] || exit 1
