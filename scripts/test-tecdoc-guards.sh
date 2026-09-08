#!/usr/bin/env bash
# Tests des gardes du pipeline TecDoc : chargement, identite, conservation, quarantaine.
#
# Meme forme que scripts/test-tecdoc-scope.sh : assertions explicites, comptage
# PASS/FAIL, AUCUN acces base, aucune dependance PROD.
#
# Les cas negatifs sont le coeur de cette suite. Une garde qui n'a jamais ete vue
# REFUSER n'a pas ete testee : elle a seulement ete vue ne rien dire.
#
#   bash scripts/test-tecdoc-guards.sh
set -uo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$RACINE/audit/massdoc-tecdoc-preservation-manifest-2026-03.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$RACINE/scripts" || exit 3

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; }
ko()   { FAIL=$((FAIL+1)); printf '  FAIL  %s\n     attendu : %s\n     obtenu  : %s\n' "$1" "$2" "$3"; }
egal() { if [ "$2" = "$3" ]; then ok "$1"; else ko "$1" "$2" "$3"; fi; }

# Rend "OK" si l'expression python s'evalue sans lever, sinon le nom de l'exception.
verdict() { python3 -c "
import sys
try:
    exec(sys.argv[1])
    print('OK')
except Exception as e:
    print(type(e).__name__)" "$1" 2>/dev/null; }

echo "=== garde de completude du chargement ==="
egal "emis == charges : accepte" "OK" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(dlnr=21, emis=790974, charges=790974)")"
egal "perte massive (BOSCH mars 2026) : REFUSE" "ComptabiliteIncoherente" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(dlnr=30, emis=9357752, charges=69000)")"
egal "perte d'UNE seule ligne : REFUSE" "ComptabiliteIncoherente" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(emis=1000, charges=999)")"
egal "dedoublonnage explicitement compte : accepte" "OK" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(emis=1000, charges=900, dedoublonnes=100)")"
egal "rejets motives et comptes : accepte" "OK" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(emis=100, charges=90, rejets={'ktypnr_absent_du_registre': 10})")"
egal "rejet non explique (categorie fourre-tout) : REFUSE" "ComptabiliteIncoherente" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(emis=100, charges=90, rejets={'autre': 10})")"
egal "rejet a raison vide : REFUSE" "ComptabiliteIncoherente" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(emis=100, charges=90, rejets={'   ': 10})")"
egal "plus de lignes chargees qu'emises : REFUSE" "ComptabiliteIncoherente" \
     "$(verdict "from tecdoc_load_guard import verifier_lot
verifier_lot(emis=100, charges=101)")"
egal "rapport a zero lot n'est pas un succes" "ComptabiliteIncoherente" \
     "$(verdict "from tecdoc_load_guard import verifier_rapport
verifier_rapport({'lots': []})")"

echo
echo "=== garde d'identite ==="
egal "mapping conserve + cle nouvelle : accepte" "OK" \
     "$(verdict "from tecdoc_identity_guard import verifier_mapping
verifier_mapping({'K:1': 60050, 'K:2': 60051}, {'K:1': 60050, 'K:2': 60051, 'K:3': 83457})")"
egal "un identifiant existant qui change : REFUSE" "IdentiteViolee" \
     "$(verdict "from tecdoc_identity_guard import verifier_mapping
verifier_mapping({'K:1': 60050}, {'K:1': 70000})")"
egal "un identifiant existant donne a une AUTRE cle : REFUSE" "IdentiteViolee" \
     "$(verdict "from tecdoc_identity_guard import verifier_mapping
verifier_mapping({'K:1': 60050}, {'K:1': 60050, 'K:9': 60050})")"
egal "rejeu partiel : identite intacte, absences signalees" "1" \
     "$(python3 -c "
from tecdoc_identity_guard import verifier_mapping
print(len(verifier_mapping({'K:1': 60050, 'K:2': 60051}, {'K:1': 60050}).absentes))" 2>/dev/null)"

echo
echo "=== conservation applicative (sur le manifeste reel, sans base) ==="
# Mesures « APRES » construites depuis le manifeste lui-meme : AVANT == APRES.
python3 - "$MANIFEST" "$TMP/mesures-identiques.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1], encoding='utf-8'))
out = {}
for e in m['ensembles_figes']:
    nom = e.get('nom')
    out[nom] = {k: e.get(k) for k in ('cardinal', 'borne_min', 'borne_max', 'empreinte_md5')}
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
PY
python3 tecdoc_preservation.py --manifest "$MANIFEST" --mesures "$TMP/mesures-identiques.json" >/dev/null 2>&1
egal "avant == apres : conservation intacte (exit 0)" "0" "$?"

# Trois suppressions simulees, une par nature d'objet du patrimoine.
simuler_suppression() {   # $1 = fragment du nom d'ensemble, $2 = fichier de sortie
  python3 - "$TMP/mesures-identiques.json" "$1" "$2" <<'PY'
import json, sys
mes = json.load(open(sys.argv[1], encoding='utf-8'))
cible = next(k for k in mes if sys.argv[2] in k)
mes[cible]['cardinal'] -= 1                      # une ligne de moins
mes[cible]['empreinte_md5'] = '0' * 32           # donc un contenu different
json.dump(mes, open(sys.argv[3], 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
PY
}
for cible in "pieces_gamme:d.une gamme" "auto_type:d.un vehicule" "pieces — cohorte:d.une piece"; do
  frag="${cible%%:*}"; label="${cible##*:}"
  simuler_suppression "$frag" "$TMP/moins-un.json"
  python3 tecdoc_preservation.py --manifest "$MANIFEST" --mesures "$TMP/moins-un.json" >/dev/null 2>&1
  egal "suppression simulee $label : REFUSE (exit 7)" "7" "$?"
done

# Fail-closed : ne pas mesurer un ensemble n'est pas la meme chose que le conserver.
python3 - "$TMP/mesures-identiques.json" "$TMP/incomplet.json" <<'PY'
import json, sys
mes = json.load(open(sys.argv[1], encoding='utf-8'))
mes.pop(next(iter(mes)))
json.dump(mes, open(sys.argv[2], 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
PY
python3 tecdoc_preservation.py --manifest "$MANIFEST" --mesures "$TMP/incomplet.json" >/dev/null 2>&1
egal "un ensemble non mesure est un ECHEC, pas un saut (exit 7)" "7" "$?"

# Le manifeste lui-meme est scelle : l'alterer le rend inutilisable.
python3 - "$MANIFEST" "$TMP/manifest-altere.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1], encoding='utf-8'))
m['ensembles_figes'][0]['cardinal'] = 1          # sceau NON recalcule
json.dump(m, open(sys.argv[2], 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
PY
python3 tecdoc_preservation.py --manifest "$TMP/manifest-altere.json" --mesures "$TMP/mesures-identiques.json" >/dev/null 2>&1
egal "manifeste altere : REFUSE (exit 2)" "2" "$?"

echo
echo "=== reconciliation et quarantaine ==="
egal "source-truth qui AJOUTE (cas BOSCH) : inclusion respectee" "True" \
     "$(python3 -c "
from tecdoc_reconcile import reconcilier
print(reconcilier({'A': 1}, {'A': 1, 'B': 2, 'C': 3}).inclusion_respectee)" 2>/dev/null)"
egal "les ajouts partent en quarantaine, pas en activation" "2" \
     "$(python3 -c "
from tecdoc_reconcile import reconcilier
print(reconcilier({'A': 1}, {'A': 1, 'B': 2, 'C': 3}).total('NEW_FROM_SOURCE'))" 2>/dev/null)"
egal "a_activer ne rend que EXISTING_PROD" "['A']" \
     "$(python3 -c "
from tecdoc_reconcile import reconcilier, a_activer
print(a_activer(reconcilier({'A': 1}, {'A': 1, 'B': 2})))" 2>/dev/null)"
egal "activer la quarantaine : REFUSE" "ActivationInterdite" \
     "$(verdict "from tecdoc_reconcile import reconcilier, a_activer
a_activer(reconcilier({'A': 1}, {'A': 1, 'B': 2}), inclure_quarantaine=True)")"
egal "une cle servie en PROD que le rejeu perd : inclusion ROMPUE" "False" \
     "$(python3 -c "
from tecdoc_reconcile import reconcilier
print(reconcilier({'A': 1, 'B': 2}, {'A': 1}).inclusion_respectee)" 2>/dev/null)"
egal "une valeur qui diverge : CONFLICT, inclusion ROMPUE" "False" \
     "$(python3 -c "
from tecdoc_reconcile import reconcilier
print(reconcilier({'A': 1}, {'A': 9}).inclusion_respectee)" 2>/dev/null)"
egal "valeur manquante d'un cote : UNKNOWN, jamais activee" "1" \
     "$(python3 -c "
from tecdoc_reconcile import reconcilier
print(reconcilier({'A': None}, {'A': 1}).total('UNKNOWN'))" 2>/dev/null)"

echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
