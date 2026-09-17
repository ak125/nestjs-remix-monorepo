#!/usr/bin/env bash
# =============================================================================
# Ratchet — empêcher la réouverture silencieuse de l'exécution `anon` sur les
# fonctions SECURITY DEFINER du schéma public.
#
# PATRON REPRIS de scripts/lint/check-tecdoc-api-surface.sh (même structure :
# balayage du texte des migrations, `report()`, allowlist fichier, sortie 1 sur
# violation). UNE DIFFÉRENCE ASSUMÉE : le garde TecDoc allowliste des NOMS DE
# FICHIERS et ne vérifie aucun motif ; ici l'allowlist porte des NOMS DE FONCTIONS
# et EXIGE une ligne « # motif : … ». C'est un durcissement, pas une reprise.
#
# CE QU'IL TRAITE : LA CAUSE, PAS LE SYMPTÔME
# -------------------------------------------
# Les privilèges par défaut Supabase accordent EXECUTE à `anon` et
# `authenticated` sur TOUTE fonction nouvellement créée. C'est ce défaut — et non
# une décision — qui a produit la quasi-totalité des 47 fonctions DEFINER
# anon-exécutables fermées par 20260917_definer_rpc_anon_lockdown.sql. UNE
# EXCEPTION DOCUMENTÉE : track_soft_404_event a reçu anon par un GRANT explicite
# (20260518180000_soft_404_rpcs.sql:281-283, ADR-076) — pour elle le lockdown
# renverse une décision, il ne corrige pas une dérive. Preuve : 20260529_seo_cwv_dashboard
# _rpcs.sql:89 et :168 n'accordent EXECUTE qu'à service_role, et pourtant anon,
# authenticated et PUBLIC figuraient dans la proacl de ces deux fonctions.
# Écrire la bonne chose dans la migration NE SUFFIT DONC PAS : il faut écrire le
# REVOKE. C'est ce que ce garde exige.
#
# CE QU'IL N'EST PAS — pas de second détecteur pour une responsabilité déjà portée
# --------------------------------------------------------------------------------
# .squawk.toml désigne les security advisors Supabase (anon_/authenticated_
# security_definer_function_executable) comme porteurs de la détection d'ÉTAT.
# VÉRIFIÉ le 2026-09-17 : AUCUNE automatisation ne les invoque
# (`grep -rn 'get_advisors' .github/ scripts/` → 0). La surveillance de l'état
# live est donc une DETTE OUVERTE, à instrumenter séparément — ce garde ne la
# remplace pas. Lui observe le TEXTE d'une migration, AVANT merge, et bloque. Les
# deux moments sont disjoints ; aucune vérité n'est dupliquée. Ce garde ne lit
# jamais la base et n'a aucun avis sur une fonction qu'aucune migration ne touche.
#
# CE QU'IL REFUSE, dans une migration datée du 2026-09-17 ou après :
#   1. créer une fonction SECURITY DEFINER dans `public` sans révoquer, DANS LE
#      MÊME FICHIER, son EXECUTE à PUBLIC / anon / authenticated
#   2. accorder EXECUTE à PUBLIC ou à authenticated sur une fonction de `public`
#   3. ré-accorder EXECUTE à anon sur une fonction fermée par le lockdown
#   4. tout octroi EN BLOC qui rouvre la surface sans nommer personne :
#      `GRANT … ON ALL FUNCTIONS IN SCHEMA public TO …` et
#      `ALTER DEFAULT PRIVILEGES … GRANT EXECUTE ON FUNCTIONS TO …`
#      (cette seconde forme EST la cause racine décrite plus haut)
#
# L'allowlist n'exempte QUE la composante `anon` (règles 1 et 3). Elle n'exempte
# jamais un GRANT à PUBLIC ou authenticated (règle 2), ni un octroi en bloc
# (règle 4) : son critère d'admission écrit ne motive qu'un besoin d'`anon`.
# Elle ne peut pas non plus nommer une fonction FERMÉE par le lockdown — sans
# quoi deux lignes suffiraient à défaire la fermeture.
#
# Exception gouvernée : ajouter le NOM DE LA FONCTION dans
# scripts/lint/definer-anon-allowlist.txt, avec une ligne de motif au-dessus.
# Une exception sans motif est refusée — c'est une dette, pas une exception.
#
# Usage : bash scripts/lint/check-definer-anon-surface.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGDIR="$ROOT/backend/supabase/migrations"
ALLOW="$ROOT/scripts/lint/definer-anon-allowlist.txt"
LOCKDOWN="20260917_definer_rpc_anon_lockdown.sql"

# Base du ratchet. Les migrations ANTÉRIEURES sont l'historique que le lockdown a
# précisément fini d'arbitrer : les rejuger ferait échouer main sur des décisions
# déjà prises (dont les carve-outs légitimes de 20260616_vague5_* et
# 20260907_tecdoc_api_surface_lockdown). Le ratchet porte sur ce qui vient APRÈS.
BASELINE_DATE="20260917"

API_ROLES_STRICT='PUBLIC|authenticated'   # jamais légitimes : le produit n'emprunte ni l'un ni l'autre
API_ROLES_ALL='PUBLIC|anon|authenticated'

violations=0
report() { echo "  VIOLATION  $1"; echo "             $2"; violations=$((violations+1)); }

# --- allowlist : un nom de fonction par ligne, précédé d'une ligne "# motif : …"
declare -A ALLOWED=()
load_allowlist() {
  [[ -f "$ALLOW" ]] || return 0
  # Le motif doit OUVRIR par "# motif :" en propre — un commentaire quelconque
  # contenant le mot ne vaut pas justification. Mais il peut se poursuivre sur
  # plusieurs lignes : justifier une exception en prose et la wrapper à 80
  # colonnes est le réflexe normal, et la refuser en annonçant « motif absent »
  # serait un faux positif au message trompeur. On exige donc qu'au moins une
  # ligne du bloc de commentaire ATTENANT à l'entrée ouvre par "# motif :".
  # Le drapeau retombe sur toute ligne vide et après chaque entrée : un motif
  # séparé par une ligne blanche ne justifie plus l'entrée qui suit, et un motif
  # ne couvre jamais deux entrées.
  local motif=0 line trimmed
  while IFS= read -r line || [[ -n "$line" ]]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"   # blancs de tête
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"  # blancs de queue
    if [[ -z "$trimmed" ]]; then motif=0; continue; fi
    if [[ "$trimmed" == \#* ]]; then
      [[ "$trimmed" =~ ^#[[:space:]]*motif[[:space:]]*: ]] && motif=1
      continue
    fi
    if [[ "$motif" -eq 0 ]]; then
      report "$(basename "$ALLOW")" "entrée '$trimmed' sans bloc '# motif : …' attenant — une exception non motivée est une dette, pas une exception."
    elif [[ -n "${CLOSED[$trimmed]:-}" ]]; then
      report "$(basename "$ALLOW")" "entrée '$trimmed' : cette fonction a été FERMÉE par $LOCKDOWN. L'allowlist ne peut pas défaire le lockdown — rouvrir cette surface exige une migration explicite ET l'accord nominatif de l'owner."
    else
      ALLOWED["$trimmed"]=1
    fi
    motif=0
  done < "$ALLOW"
}

is_allowed() { [[ -n "${ALLOWED[$1]:-}" ]]; }

# --- texte utile d'une migration : commentaires de LIGNE PLEINE, de FIN DE LIGNE
#     et blocs /* … */ sont retirés. Sinon un REVOKE écrit en commentaire de fin de
#     ligne satisferait la règle 1 — c'est l'accident réaliste (documenter le revoke
#     au lieu de l'écrire) autant que le contournement délibéré.
#     CAVEAT ASSUMÉ : un `--` à l'intérieur d'un littéral texte tronque la fin de la
#     ligne. Aucune migration du dépôt n'est dans ce cas ; l'effet serait de PERDRE
#     du texte, donc de réclamer un REVOKE qui existe — bruyant, jamais silencieux.
strip_comments() { sed -E 's@/\*([^*]|\*[^/])*\*/@ @g; s/--.*$//' "$1"; }

# --- ensemble fermé par le lockdown : PARSÉ depuis la migration elle-même.
#     Pas de liste recopiée ici : une seule source de vérité, qui ne peut pas
#     diverger du SQL réellement appliqué.
declare -A CLOSED=()
load_closed_set() {
  local f="$MIGDIR/$LOCKDOWN"
  [[ -f "$f" ]] || {
    echo "ÉCHEC — $LOCKDOWN introuvable dans $MIGDIR."
    echo "        L'ensemble fermé n'est pas dérivable : la règle 3 ne peut pas être"
    echo "        évaluée, et un vert ne prouverait rien. Si la migration a été"
    echo "        renommée ou archivée, mettre \$LOCKDOWN à jour dans ce script."
    exit 1
  }
  local fn
  while read -r fn; do
    [[ -n "$fn" ]] && CLOSED["$fn"]=1
  done < <(strip_comments "$f" \
      | grep -oEi 'REVOKE[[:space:]]+[A-Z]+[[:space:]]+ON[[:space:]]+FUNCTION[[:space:]]+public\.[A-Za-z0-9_]+' \
      | grep -oE 'public\.[A-Za-z0-9_]+$' | cut -d. -f2 | sort -u)
}

# --- fonctions SECURITY DEFINER de `public` déclarées par un fichier.
#     PostgreSQL accepte `SECURITY DEFINER` N'IMPORTE OÙ dans la liste d'options,
#     y compris APRÈS le corps (`AS $$…$$ LANGUAGE sql SECURITY DEFINER;`), et un
#     corps peut ne pas être dollar-quoté du tout (`BEGIN ATOMIC`, `AS 'SELECT …'`).
#     Clore l'en-tête au marqueur `AS $` rendait ces formes INVISIBLES au garde.
#     On retient donc la FENÊTRE qui va d'un `CREATE … FUNCTION <nom>` au `CREATE …
#     FUNCTION` suivant (ou à la fin du fichier), et on marque DEFINER si
#     `SECURITY DEFINER` y apparaît. C'est une SUR-approximation volontaire : au pire
#     elle réclame un REVOKE inutile mais inoffensif — jamais elle ne se tait.
definer_functions() {
  strip_comments "$1" | awk '
    BEGIN { IGNORECASE = 1; open = 0 }
    {
      if (match($0, /CREATE[ \t]+(OR[ \t]+REPLACE[ \t]+)?FUNCTION[ \t]+(public\.)?[A-Za-z0-9_]+/)) {
        if (open && secdef) print name
        hdr = substr($0, RSTART, RLENGTH)
        n = split(hdr, parts, /[ \t.]+/)
        name = parts[n]
        open = 1; secdef = 0
        rest = substr($0, RSTART + RLENGTH)
        if (rest ~ /SECURITY[ \t]+DEFINER/) secdef = 1
        next
      }
      if (open && $0 ~ /SECURITY[ \t]+DEFINER/) secdef = 1
    }
    END { if (open && secdef) print name }'
}

# --- instructions normalisées (une par ligne) pour les tests GRANT / REVOKE
statements() { strip_comments "$1" | tr '\n' ' ' | tr ';' '\n'; }

# --- contexte : fail-closed. Un garde qui ne trouve pas ce qu'il doit juger ne
#     doit JAMAIS sortir 0 (invariant 3 : aucun repli implicite non observable).
[[ -d "$MIGDIR" ]] || { echo "ÉCHEC — répertoire de migrations introuvable : $MIGDIR"; exit 1; }
[[ -f "$ALLOW"  ]] || { echo "ÉCHEC — allowlist introuvable : $ALLOW"; exit 1; }

# ORDRE IMPOSÉ : l'ensemble fermé d'abord, pour que load_allowlist puisse REFUSER
# une entrée qui prétendrait rouvrir une fonction fermée par le lockdown.
load_closed_set
load_allowlist

shopt -s nullglob
scanned=0
for f in "$MIGDIR"/*.sql; do
  base="$(basename "$f")"
  [[ "$base" == *.down.sql ]] && continue
  # la migration de fermeture est l'état de référence, pas une violation
  [[ "$base" == "$LOCKDOWN" ]] && continue
  # ratchet : seules les migrations postérieures à la base sont jugées
  if [[ ! "${base:0:8}" =~ ^[0-9]{8}$ ]]; then
    # Un fichier non daté ne peut pas être situé par rapport à la base du ratchet :
    # l'ignorer en silence serait un repli non observable. On le signale.
    report "$base" "nom de fichier sans préfixe de date AAAAMMJJ : impossible de le situer par rapport à la base du ratchet ($BASELINE_DATE). Renommer selon la convention du dépôt."
    continue
  fi
  [[ "${base:0:8}" < "$BASELINE_DATE" ]] && continue
  scanned=$((scanned + 1))

  stmts="$(statements "$f")"

  # règle 1 — toute fonction DEFINER créée doit voir son EXECUTE révoqué ici même
  while read -r fn; do
    [[ -n "$fn" ]] || continue
    is_allowed "$fn" && continue
    # UN SEUL des trois rôles ne suffit PAS : `REVOKE ... FROM authenticated` seul
    # laisse anon ouvert, c'est-à-dire exactement le défaut que ce garde existe pour
    # attraper. On teste donc chaque rôle séparément (conjonction, pas disjonction).
    rv="$(grep -Ei "REVOKE.*FUNCTION[[:space:]]+(public\.)?${fn}\b.*FROM" <<< "$stmts")"
    missing=()
    for role in PUBLIC anon authenticated; do
      grep -qEi "FROM.*\b${role}\b" <<< "$rv" || missing+=("$role")
    done
    if (( ${#missing[@]} )); then
      report "$base" "règle 1 : public.${fn} est créée SECURITY DEFINER sans REVOKE ... FROM ${missing[*]} dans le même fichier. Les privilèges par défaut Supabase lui accorderont EXECUTE à anon — la clé anon est publishable et PostgREST l'exposera sur /rest/v1/rpc/${fn}. Remède : REVOKE ALL ON FUNCTION public.${fn}(<args>) FROM PUBLIC, anon, authenticated;"
    fi
  done < <(definer_functions "$f")

  # règle 2 — EXECUTE rendu à PUBLIC ou authenticated : jamais légitime ici.
  # Le backend ne s'authentifie qu'en service_role (PROD) ou anon (PREPROD
  # READ_ONLY) ; le frontend n'instancie aucun client supabase-js navigateur.
  while read -r stmt; do
    [[ "$stmt" =~ [Gg][Rr][Aa][Nn][Tt] ]] || continue
    [[ "$stmt" =~ [Ff][Uu][Nn][Cc][Tt][Ii][Oo][Nn] ]] || continue
    grep -qEi "TO.*\b($API_ROLES_STRICT)\b" <<< "$stmt" || continue
    fn="$(grep -oEi 'FUNCTION[[:space:]]+(public\.)?[A-Za-z0-9_]+' <<< "$stmt" | head -1 | grep -oE '[A-Za-z0-9_]+$')"
    # PAS de `is_allowed ... && continue` ici, délibérément : l'allowlist motive un
    # besoin d'`anon` (rendu d'une page publique servie en PREPROD READ_ONLY), JAMAIS
    # PUBLIC ni authenticated — que l'en-tête de ce garde ET l'allowlist déclarent
    # tous deux jamais légitimes. L'en exempter permettrait de rendre PUBLIC aux 12
    # fonctions qui restent précisément joignables depuis l'Internet public.
    report "$base" "règle 2 : EXECUTE sur public.${fn:-<?>} rendu à PUBLIC ou authenticated. Rôles légitimes : service_role (PROD) et, pour un chemin de rendu public uniquement, anon (PREPROD READ_ONLY)."
  done <<< "$stmts"

  # règle 3 — réouverture à anon d'une fonction fermée par le lockdown
  while read -r stmt; do
    [[ "$stmt" =~ [Gg][Rr][Aa][Nn][Tt] ]] || continue
    [[ "$stmt" =~ [Ff][Uu][Nn][Cc][Tt][Ii][Oo][Nn] ]] || continue
    grep -qEi 'TO.*\banon\b' <<< "$stmt" || continue
    fn="$(grep -oEi 'FUNCTION[[:space:]]+(public\.)?[A-Za-z0-9_]+' <<< "$stmt" | head -1 | grep -oE '[A-Za-z0-9_]+$')"
    [[ -n "${CLOSED[${fn:-?}]:-}" ]] || continue
    is_allowed "${fn}" && continue
    report "$base" "règle 3 : EXECUTE ré-accordé à anon sur public.${fn}, fermée par ${LOCKDOWN}. Rouvrir cette surface exige une entrée motivée dans $(basename "$ALLOW") ET l'accord de l'owner (incident 2026-09-17)."
  done <<< "$stmts"

  # règle 4 — octroi EN BLOC : rouvre la surface entière sans nommer personne, donc
  # sans qu'aucune des règles 1 à 3 (qui extraient un NOM de fonction) ne se déclenche.
  # La seconde forme est LITTÉRALEMENT la cause racine décrite en tête de ce fichier.
  # Aucune dérogation par l'allowlist : elle ne nomme aucune fonction, il n'y a rien
  # à exempter.
  if grep -qEi 'GRANT[^;]*\bON[[:space:]]+ALL[[:space:]]+FUNCTIONS[[:space:]]+IN[[:space:]]+SCHEMA[[:space:]]+public\b[^;]*\bTO\b[^;]*\b(PUBLIC|anon|authenticated)\b' <<< "$stmts"; then
    report "$base" "règle 4 : GRANT ... ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC/anon/authenticated — rouvre d'un coup toute la surface fermée par ${LOCKDOWN}, sans nommer aucune fonction. Accorder fonction par fonction, au rôle réel de l'appelant."
  fi
  if grep -qEi 'ALTER[[:space:]]+DEFAULT[[:space:]]+PRIVILEGES[^;]*\bGRANT\b[^;]*\bFUNCTIONS\b[^;]*\bTO\b[^;]*\b(PUBLIC|anon|authenticated)\b' <<< "$stmts"; then
    report "$base" "règle 4 : ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO PUBLIC/anon/authenticated — c'est EXACTEMENT la cause racine de l'incident 2026-09-17 : toute fonction future naîtrait anon-exécutable."
  fi
done

echo
if [[ "$violations" -eq 0 ]]; then
  echo "OK — surface DEFINER/anon inchangée ($scanned migration(s) jugée(s) depuis $BASELINE_DATE, $(( ${#CLOSED[@]} )) fonction(s) dans l'ensemble fermé, ${#ALLOWED[@]} exception(s) motivée(s))."
  exit 0
fi
echo "ÉCHEC — $violations violation(s)."
echo
echo "Une fonction SECURITY DEFINER de public exécutable par anon est joignable par"
echo "n'importe qui : la clé anon est une clé publishable que PostgREST accepte de"
echo "TOUT porteur, et il expose la fonction sur /rest/v1/rpc/<nom>, en CONTOURNANT"
echo "le backend NestJS —"
echo "un @UseGuards(IsAdminGuard) ne protège rien sur ce chemin."
echo
echo "Remède par défaut, à écrire dans la migration elle-même :"
echo "  REVOKE ALL ON FUNCTION public.<fn>(<args>) FROM PUBLIC, anon, authenticated;"
echo "  GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO service_role;"
echo
echo "Exception gouvernée (chemin de rendu d'une page publique servie en PREPROD"
echo "READ_ONLY) : ajouter le nom de la fonction dans $ALLOW,"
echo "précédé d'une ligne '# motif : …' nommant la page ou la sonde qui casserait sans elle."
exit 1
