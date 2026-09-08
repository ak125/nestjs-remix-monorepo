#!/usr/bin/env bash
# Test de non-regression du lecteur de perimetre TecDoc fige.
#
# Meme forme que scripts/test-tecdoc-mysql-to-csv.sh : assertions explicites,
# comptage PASS/FAIL, aucun acces base, aucune dependance PROD.
#
#   bash scripts/test-tecdoc-scope.sh
set -uo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="$RACINE/audit/massdoc-tecdoc-import-scope-2026-03.json"
LECTEUR="$RACINE/scripts/tecdoc_scope.py"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; }
ko()   { FAIL=$((FAIL+1)); printf '  FAIL  %s\n     attendu : %s\n     obtenu  : %s\n' "$1" "$2" "$3"; }
egal() { if [ "$2" = "$3" ]; then ok "$1"; else ko "$1" "$2" "$3"; fi; }

echo "=== artefact present et scelle ==="
[ -f "$SCOPE" ] && ok "l'artefact existe" || ko "l'artefact existe" "$SCOPE" "absent"

python3 "$LECTEUR" --scope-file "$SCOPE" --verifier >/dev/null 2>&1
egal "le sceau se verifie (exit 0)" "0" "$?"

echo
echo "=== cardinaux du perimetre ==="
egal "149 DLNR charges dans t400" "149" \
     "$(python3 "$LECTEUR" --scope-file "$SCOPE" --lister charges | wc -l | tr -d ' ')"
egal "110 DLNR projetes en mars 2026" "110" \
     "$(python3 "$LECTEUR" --scope-file "$SCOPE" --lister projetes | wc -l | tr -d ' ')"
egal "les projetes sont un sous-ensemble des charges" "0" \
     "$(comm -23 <(python3 "$LECTEUR" --scope-file "$SCOPE" --lister projetes | sort) \
                 <(python3 "$LECTEUR" --scope-file "$SCOPE" --lister charges | sort) | wc -l | tr -d ' ')"

echo
echo "=== les deux fournisseurs que le scope vivant perdrait ==="
for d in 253 6358; do
  egal "DLNR $d est dans le perimetre fige" "1" \
       "$(python3 "$LECTEUR" --scope-file "$SCOPE" --lister projetes | grep -cx "$d")"
done
egal "DLNR 4836 (VDO, jamais charge) est absent du perimetre" "0" \
     "$(python3 "$LECTEUR" --scope-file "$SCOPE" --lister charges | grep -cx 4836)"

echo
echo "=== API bibliotheque ==="
egal "shard 400 du DLNR 21 nomme correctement" "400.0021.sql" \
     "$(cd "$RACINE/scripts" && python3 -c "
from tecdoc_scope import charger_perimetre
print(charger_perimetre('$SCOPE').shard(21,'400')['name'])" 2>/dev/null)"
egal "les 5 divergences parseur/base sont exposees" "5" \
     "$(cd "$RACINE/scripts" && python3 -c "
from tecdoc_scope import charger_perimetre
print(len(charger_perimetre('$SCOPE').divergences_connues()))" 2>/dev/null)"
egal "un DLNR hors perimetre leve KeyError" "KeyError" \
     "$(cd "$RACINE/scripts" && python3 -c "
from tecdoc_scope import charger_perimetre
try: charger_perimetre('$SCOPE').fournisseur(999999)
except KeyError: print('KeyError')" 2>/dev/null)"

echo
echo "=== fail-closed : un artefact altere doit etre REFUSE ==="
python3 - "$SCOPE" "$TMP/altere.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
# on retire un seul fournisseur, sans toucher au sceau
d['suppliers']=[s for s in d['suppliers'] if s['dlnr']!=253]
json.dump(d,open(sys.argv[2],'w',encoding='utf-8'),sort_keys=True,ensure_ascii=False,indent=2)
PY
python3 "$LECTEUR" --scope-file "$TMP/altere.json" --lister projetes >/dev/null 2>&1
egal "retirer un fournisseur invalide le sceau (exit 2)" "2" "$?"

python3 - "$SCOPE" "$TMP/sanssceau.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8')); d.pop('seal',None)
json.dump(d,open(sys.argv[2],'w',encoding='utf-8'),sort_keys=True,ensure_ascii=False,indent=2)
PY
python3 "$LECTEUR" --scope-file "$TMP/sanssceau.json" --verifier >/dev/null 2>&1
egal "un artefact sans sceau est refuse (exit 2)" "2" "$?"

printf '{"scope_version":"bidon","suppliers":[],"seal":{"sha256":"x"}}' > "$TMP/version.json"
python3 "$LECTEUR" --scope-file "$TMP/version.json" --verifier >/dev/null 2>&1
egal "une version de perimetre inconnue est refusee (exit 2)" "2" "$?"

echo "illisible" > "$TMP/casse.json"
python3 "$LECTEUR" --scope-file "$TMP/casse.json" --verifier >/dev/null 2>&1
egal "un fichier illisible sort en 3" "3" "$?"

echo
echo "=== manifest de preservation ==="
MANIFEST="$RACINE/audit/massdoc-tecdoc-preservation-manifest-2026-03.json"
[ -f "$MANIFEST" ] && ok "le manifest de preservation existe" || ko "le manifest existe" "$MANIFEST" "absent"
egal "son sceau se verifie" "True" \
     "$(python3 -c "
import json,hashlib
d=json.load(open('$MANIFEST',encoding='utf-8')); s=d.pop('seal')
print(hashlib.sha256(json.dumps(d,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==s['sha256'])")"
egal "9 ensembles applicatifs figes" "9" \
     "$(python3 -c "import json;print(len(json.load(open('$MANIFEST',encoding='utf-8'))['ensembles_figes']))")"

echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
