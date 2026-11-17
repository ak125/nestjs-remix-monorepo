#!/usr/bin/env bash
# Test de pilote-file.sh sur FIXTURES (jamais le dépôt réel) : constats, filtrage des propositions,
# bornage et dédoublonnage des commentaires, reprise de la section, cumul du coût, mode à blanc.
# `gh` est remplacé par un faux qui ne sait que lire (corps d'issue, listes, contenu d'un fichier) ;
# toute autre commande gh fait échouer le test (preuve que --a-blanc n'écrit rien).
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/pilote-file-test.XXXXXX")"
trap 'rm -rf "$FIX"' EXIT
FAIL=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }

mkdir -p "$FIX/bin"
cat > "$FIX/bin/gh" <<'SH'
#!/usr/bin/env bash
if [[ "$1 $2" == "issue view" ]]; then cat "$FAKE_BODY"; exit 0; fi
if [[ "$1 $2" == "issue list" ]]; then cat "$FAKE_ISSUES"; exit 0; fi
if [[ "$1 $2" == "pr list" ]]; then cat "$FAKE_PRS"; exit 0; fi
if [[ "$1" == "api" && "$2" == repos/*/contents/* ]]; then cat "$FAKE_SOURCE_KPI"; exit $?; fi
echo "faux gh : commande interdite dans le test : $*" >&2; echo "$*" >> "$FAKE_LOG"; exit 99
SH
chmod +x "$FIX/bin/gh"
export PATH="$FIX/bin:$PATH" REPO="exemple/depot" FAKE_LOG="$FIX/gh.log" FAKE_BODY="$FIX/corps.md"
: > "$FAKE_LOG"

TITRE="Pilotage de la file (pilote-file, ADR-128 D6)"
cat > "$FIX/issues.json" <<JSON
[
 {"number":1,"title":"$TITRE","labels":[],"createdAt":"2026-11-01T00:00:00Z","updatedAt":"2026-11-15T06:00:00Z","author":{"login":"app/github-actions","is_bot":true},"comments":[]},
 {"number":10,"title":"Fix: SEO sitemap","labels":[],"createdAt":"2026-11-14T00:00:00Z","updatedAt":"2026-11-14T00:00:00Z","author":{"login":"a","is_bot":false},"comments":[]},
 {"number":11,"title":"fix   seo sitemap","labels":[{"name":"dept:07-seo"}],"createdAt":"2026-11-14T00:00:00Z","updatedAt":"2026-11-14T00:00:00Z","author":{"login":"a","is_bot":false},"comments":[]},
 {"number":12,"title":"Deux départements","labels":[{"name":"dept:07-seo"},{"name":"dept:21-runtime"}],"createdAt":"2026-11-14T00:00:00Z","updatedAt":"2026-11-14T00:00:00Z","author":{"login":"a","is_bot":false},"comments":[]},
 {"number":13,"title":"Bloquée","labels":[{"name":"dept:21-runtime"},{"name":"statut:bloqué"}],"createdAt":"2026-11-14T00:00:00Z","updatedAt":"2026-11-14T00:00:00Z","author":{"login":"a","is_bot":false},"comments":[]},
 {"number":14,"title":"Ancienne, relancée par le pilote seul","labels":[{"name":"dept:22-data"}],"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-11-15T05:00:30Z","author":{"login":"a","is_bot":false},"comments":[{"author":{"login":"github-actions"},"body":"<!-- pilote-file:sans_mouvement -->\nx","createdAt":"2026-11-15T05:00:00Z"}]},
 {"number":15,"title":"Ancienne mais commentée par un humain hier","labels":[{"name":"dept:22-data"}],"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-11-14T12:00:00Z","author":{"login":"a","is_bot":false},"comments":[{"author":{"login":"h"},"body":"avance","createdAt":"2026-11-14T12:00:00Z"}]},
 {"number":16,"title":"Sans département déjà commentée","labels":[],"createdAt":"2026-11-14T00:00:00Z","updatedAt":"2026-11-14T00:00:00Z","author":{"login":"a","is_bot":false},"comments":[{"author":{"login":"github-actions"},"body":"<!-- pilote-file:sans_departement -->\nx","createdAt":"2026-11-14T00:00:00Z"}]}
]
JSON
cat > "$FIX/prs.json" <<'JSON'
[
 {"number":100,"title":"a","body":"Refs #10","author":{"login":"a"},"isDraft":false},
 {"number":101,"title":"b","body":"Closes https://github.com/exemple/depot/issues/11","author":{"login":"a"},"isDraft":false},
 {"number":102,"title":"c","body":"Aucun rattachement, voir PR 100","author":{"login":"app/dependabot"},"isDraft":true},
 {"number":103,"title":"d","body":null,"author":{"login":"a"},"isDraft":false}
]
JSON

echo "== constats =="
D="$FIX/run1"; mkdir -p "$D/brut"; cp "$FIX/issues.json" "$D/brut/issues.json"
jq -n --slurpfile i "$FIX/issues.json" --slurpfile p "$FIX/prs.json" --arg t "$TITRE" \
  '{issues:$i[0], prs:$p[0], maintenant:"2026-11-15T06:00:00Z", jours_sans_mouvement:7, titre_pilote:$t}' \
  | jq -f "$ICI/pilote-file.constats.jq" > "$D/etat.json"
E="$D/etat.json"
check "issue de pilotage reconnue" "1" "$(jq -c .pilote_issue "$E")"
check "issue de pilotage exclue de la file" "7" "$(jq -c .compteurs.issues_ouvertes "$E")"
check "sans département" "[10,16]" "$(jq -c .constats.sans_departement "$E")"
check "plusieurs départements" "[12]" "$(jq -c '[.constats.departement_multiple[].issue]' "$E")"
check "bloquées" "[13]" "$(jq -c .constats.bloquees "$E")"
check "sans mouvement (le commentaire du pilote ne compte pas)" "[14]" "$(jq -c '[.constats.sans_mouvement[].issue]' "$E")"
check "titres identiques après normalisation" "[[10,11]]" "$(jq -c .constats.doublons_titre "$E")"
check "PR sans issue" "[102,103]" "$(jq -c '[.constats.prs_sans_issue[].pr]' "$E")"
check "mandats expirés non couverts" "false" "$(jq -c .constats.mandats_expires.couvert "$E")"

DEPTS='[{"label":"dept:07-seo","intitule":"SEO"},{"label":"dept:21-runtime","intitule":"Runtime"},{"label":"dept:22-data","intitule":"Data"}]'
jq --argjson d "$DEPTS" '. + {pilote_issue: null, empreinte: ("a" * 64), nouveau: true, departements: $d}' "$E" > "$E.tmp" && mv "$E.tmp" "$E"

echo "== publier --a-blanc, première exécution =="
cat > "$D/propositions.json" <<'JSON'
{"recapitulatif":"File chargée ; demander à @owner l'arbitrage.","propositions":[
 {"issue":10,"type":"sans_departement","proposition":"Le titre parle du sitemap, ping @quelquun.","departement_suggere":"dept:07-seo"},
 {"issue":16,"type":"sans_departement","proposition":"déjà commentée","departement_suggere":"dept:07-seo"},
 {"issue":11,"type":"doublon","proposition":"Même objet que 10.","doublon_de":10},
 {"issue":12,"type":"departement_multiple","proposition":"Garder runtime.","departement_suggere":"dept:21-runtime"},
 {"issue":13,"type":"blocage","proposition":"Demander la cause."},
 {"issue":14,"type":"sans_mouvement","proposition":"Relancer."},
 {"issue":999,"type":"sans_departement","proposition":"issue inventée"},
 {"issue":11,"type":"sans_departement","proposition":"11 a déjà un département"},
 {"issue":10,"type":"doublon","proposition":"doublon de soi","doublon_de":10},
 {"issue":13,"type":"blocage","proposition":"label inconnu","departement_suggere":"dept:99-inexistant"}
]}
JSON
jq -n '{jour:"2026-11-15",run_id:"1",sessions_ouvertes:1,modele:"m",cli_version:"v",total_cost_usd:0.25,
        usage:{input_tokens:1000,output_tokens:200,cache_creation_input_tokens:10,cache_read_input_tokens:5},erreur:null}' > "$D/cout.json"
: > "$FAKE_BODY"
PILOTE_MAX_COMMENTAIRES=3 bash "$ICI/pilote-file.sh" publier --sortie "$D" --a-blanc > "$D/sortie.txt"
check "retenues" "6" "$(jq '.retenues | length' "$D/propositions-retenues.json")"
check "écartées (inventée, hors constat, doublon de soi, label inconnu)" "4" "$(jq '.rejetees | length' "$D/propositions-retenues.json")"
check "commentaires bornés à 3, la 16 déjà commentée sautée" "10,11,12" "$(jq -r .issue "$D/commentaires.jsonl" | paste -sd,)"
check "mention @ neutralisée dans les commentaires" "0" "$(jq -r .corps "$D/commentaires.jsonl" | grep -cP '@(?!\x{200B})' || true)"
check "mention @ neutralisée dans le corps" "0" "$(grep -cP '@(?!\x{200B})' "$D/corps.md" || true)"
check "aucun lien #N actif dans le corps" "0" "$(grep -cP '(?<!`)#[0-9]+' "$D/corps.md" || true)"
check "empreinte inscrite" "1" "$(grep -c 'pilote-file:empreinte:aaaa' "$D/corps.md")"
check "ligne de coût du jour" '{"jour":"2026-11-15","executions":1,"sessions":1,"usd":0.25}' \
  "$(jq -c '.[0] | {jour,executions,sessions,usd}' "$D/cout-jours.json")"
check "aucune écriture GitHub en à blanc" "0" "$(wc -l < "$FAKE_LOG")"

echo "== deuxième exécution sans session : section reprise, coût cumulé =="
D2="$FIX/run2"; mkdir -p "$D2/brut"; cp "$FIX/issues.json" "$D2/brut/issues.json"
jq '.pilote_issue = 1 | .nouveau = false' "$E" > "$D2/etat.json"
jq -n '{jour:"2026-11-15",run_id:"2",sessions_ouvertes:0,modele:"m",cli_version:"v",total_cost_usd:0,
        usage:{input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0},erreur:null}' > "$D2/cout.json"
cp "$D/corps.md" "$FAKE_BODY"
bash "$ICI/pilote-file.sh" publier --sortie "$D2" --a-blanc > "$D2/sortie.txt"
check "section de propositions reprise" "$(sed -n '/propositions:debut/,/propositions:fin/p' "$D/corps.md" | md5sum)" \
  "$(sed -n '/propositions:debut/,/propositions:fin/p' "$D2/corps.md" | md5sum)"
check "coût cumulé sur le jour" '{"executions":2,"sessions":1,"usd":0.25,"input_tokens":1000}' \
  "$(jq -c '.[-1] | {executions,sessions,usd,input_tokens}' "$D2/cout-jours.json")"
check "aucun commentaire sans session" "0" "$(wc -l < "$D2/commentaires.jsonl")"
check "aucune écriture GitHub en à blanc" "0" "$(wc -l < "$FAKE_LOG")"

echo "== session : rien de nouveau ⇒ aucune session, coût nul =="
D3="$FIX/run3"; mkdir -p "$D3/brut"; cp "$D2/etat.json" "$D3/etat.json"; cp "$FIX/issues.json" "$D3/brut/issues.json"
env -u ANTHROPIC_API_KEY -u CLAUDE_CODE_OAUTH_TOKEN bash "$ICI/pilote-file.sh" session --sortie "$D3" > /dev/null
check "sessions ouvertes" "0" "$(jq .sessions_ouvertes "$D3/cout.json")"
echo "== session : nouveau sans secret ⇒ échec visible =="
jq '.nouveau = true | .kpi = {id: "k", producteur: "présent", source: "x"}' "$D2/etat.json" > "$D3/etat.json"
rc=0; env -u ANTHROPIC_API_KEY -u CLAUDE_CODE_OAUTH_TOKEN bash "$ICI/pilote-file.sh" session --sortie "$D3" > /dev/null 2>&1 || rc=$?
check "code de sortie non nul" "1" "$rc"
check "erreur tracée dans cout.json" "secret CLAUDE_CODE_OAUTH_TOKEN (ou ANTHROPIC_API_KEY) absent" "$(jq -r .erreur "$D3/cout.json")"
jq '.empreinte_precedente = ("b" * 64)' "$D3/etat.json" > "$D3/etat.tmp" && mv "$D3/etat.tmp" "$D3/etat.json"
bash "$ICI/pilote-file.sh" publier --sortie "$D3" --a-blanc > /dev/null
check "échec ⇒ empreinte précédente gardée (retente au tour suivant)" "1" "$(grep -c 'pilote-file:empreinte:bbbb' "$D3/corps.md")"
check "échec affiché dans le corps" "1" "$(grep -c 'session Claude : échec' "$D3/corps.md")"

echo "== session : un seul secret transmis à la CLI, environnement vidé =="
mkdir -p "$FIX/npx"
cat > "$FIX/npx/npx" <<'SH'
#!/usr/bin/env bash
env | cut -d= -f1 | grep -E 'TOKEN|KEY' | sort | tr '\n' ' ' >&2   # capturé dans session.stderr
cat > /dev/null
echo '{"type":"result","subtype":"success","is_error":false,"structured_output":{"propositions":[]},"total_cost_usd":0.1,"usage":{"input_tokens":10,"output_tokens":5}}'
SH
chmod +x "$FIX/npx/npx"
D4="$FIX/run4"; mkdir -p "$D4"; cp "$D3/etat.json" "$D4/etat.json"
PATH="$FIX/npx:$PATH" CLAUDE_CODE_OAUTH_TOKEN=jeton-factice ANTHROPIC_API_KEY=cle-factice GH_TOKEN=gh-factice \
  bash "$ICI/pilote-file.sh" session --sortie "$D4" > /dev/null
check "jeton d'abonnement préféré, seul transmis" "CLAUDE_CODE_OAUTH_TOKEN " "$(cat "$D4/session.stderr")"
check "mode tracé dans cout.json" "abonnement" "$(jq -r .authentification "$D4/cout.json")"
PATH="$FIX/npx:$PATH" ANTHROPIC_API_KEY=cle-factice GH_TOKEN=gh-factice \
  env -u CLAUDE_CODE_OAUTH_TOKEN bash "$ICI/pilote-file.sh" session --sortie "$D4" > /dev/null
check "clé API seule transmise à défaut" "ANTHROPIC_API_KEY " "$(cat "$D4/session.stderr")"
check "mode tracé dans cout.json" "cle-api" "$(jq -r .authentification "$D4/cout.json")"
check "aucune valeur de secret dans la sortie" "0" "$(grep -rlE 'jeton-factice|cle-factice' "$D4" | wc -l)"

echo "== controle : producteur du KPI du rôle 23 (ADR-128 D2) =="
export FAKE_ISSUES="$FIX/issues.json" FAKE_PRS="$FIX/prs.json" FAKE_SOURCE_KPI="$FIX/source-kpi.ts"
D5="$FIX/run5"; mkdir -p "$D5"; : > "$FAKE_BODY"; : > "$FAKE_LOG"
echo 'const k = { pages_generating_atc: 1, metric_reliability: 2 };' > "$FAKE_SOURCE_KPI"
bash "$ICI/pilote-file.sh" controle --sortie "$D5" > /dev/null
check "KPI lu dans la carte" "useful_capabilities_not_complexity" "$(jq -r .kpi.id "$D5/etat.json")"
check "producteur absent" "absent" "$(jq -r .kpi.producteur "$D5/etat.json")"
rc=0; PATH="$FIX/npx:$PATH" CLAUDE_CODE_OAUTH_TOKEN=jeton-factice \
  bash "$ICI/pilote-file.sh" session --sortie "$D5" > /dev/null 2>&1 || rc=$?
check "session suspendue : exécution verte" "0" "$rc"
check "aucune session ouverte" "0" "$(jq .sessions_ouvertes "$D5/cout.json")"
check "CLI non appelée" "absent" "$([[ -e "$D5/session.json" ]] && echo présent || echo absent)"
check "suspension tracée" "producteur du KPI useful_capabilities_not_complexity absent (ADR-128 D2)" "$(jq -r .suspension "$D5/cout.json")"
check "pas d'erreur" "null" "$(jq -r .erreur "$D5/cout.json")"
bash "$ICI/pilote-file.sh" publier --sortie "$D5" --a-blanc > /dev/null
check "suspension affichée dans le corps" "1" "$(grep -c 'session Claude : suspendue' "$D5/corps.md")"
check "suspendue ⇒ nouvelle empreinte non inscrite" "0" "$(grep -c "pilote-file:empreinte:$(jq -r .empreinte "$D5/etat.json")" "$D5/corps.md")"
echo "const k = { id: 'useful_capabilities_not_complexity', value: 3 };" > "$FAKE_SOURCE_KPI"
bash "$ICI/pilote-file.sh" controle --sortie "$D5" > /dev/null
check "producteur présent" "présent" "$(jq -r .kpi.producteur "$D5/etat.json")"
check "contrôle en lecture seule" "0" "$(wc -l < "$FAKE_LOG")"

echo "== controle : une définition réelle, pas une simple mention (mandat BP) =="
# evaluer <fichier source> [département] → présent | absent | arrêt (code, message)
evaluer() {
  local d; d="$(mktemp -d "$FIX/eval.XXXXXX")"; local rc=0
  FAKE_SOURCE_KPI="$1" PILOTE_DEPARTEMENT="${2:-23}" \
    bash "$ICI/pilote-file.sh" controle --sortie "$d" > /dev/null 2> "$d/stderr" || rc=$?
  if [[ "$rc" -ne 0 ]]; then echo "arrêt $rc : $(tail -n1 "$d/stderr")"
  elif [[ -f "$d/etat.json" ]]; then jq -r .kpi.producteur "$d/etat.json"
  else echo "sans état"; fi
}
K=useful_capabilities_not_complexity
S="$FIX/sources"; mkdir -p "$S"
cat > "$S/commentaire.ts" <<TS
// $K : KPI du rôle 23, cité en commentaire.
/* Bloc : id: '$K' */
/**
 *   - \`$K\` : id: "$K"
 */
export const autre = { id: 'payments_kept' };
TS
cat > "$S/liste.ts" <<TS
export const KPI_IDS = ['payments_kept', '$K'];
export function lire(id: string) { return [id, "$K"]; }
TS
cat > "$S/chaine.ts" <<TS
const s = "id: '$K'";
const t = 'id: "$K"';
const g = \`{ id: '$K' }\`;
const h = \`\${s} id: '$K'\`;
TS
cat > "$S/autres-formes.ts" <<TS
const a = { $K: 3 };
const b = { kpi: '$K', kpiId: '$K', label: '$K' };
const c = (x: boolean, id: string) => (x ? id : '$K');
const d = { id: '${K}_v2' };
const e = { id: 'x', note: '$K' };
TS
cat > "$S/definition.ts" <<TS
export const PROPRE = /^[\p{L}'’ -]{1,60}\$/u;   // apostrophe dans une expression régulière
const titre = \`fenêtre \${PROPRE.source} \${\`imbriqué\`} j\`;
// id: '$K' en commentaire avant la vraie définition
export function toKpi(): unknown {
  const base = {
    id: '$K',
    label: titre,
  };
  return base;
}
TS
printf "const k = { label: 'x', id: \"%s\" };\n" "$K" > "$S/guillemets-doubles.ts"
: > "$S/vide.ts"
printf 'const k = { id: \x27%s\x27 }; // \xff\xfe\n' "$K" > "$S/non-utf8.ts"
printf "const k = { id: '%s' }; /* commentaire non fermé\n" "$K" > "$S/non-ferme.ts"
check "seulement en commentaire ⇒ absent" "absent" "$(evaluer "$S/commentaire.ts")"
check "seulement dans une liste ⇒ absent" "absent" "$(evaluer "$S/liste.ts")"
check "seulement dans une chaîne ou un gabarit ⇒ absent" "absent" "$(evaluer "$S/chaine.ts")"
check "clé, autre clé, ternaire, préfixe ⇒ absent" "absent" "$(evaluer "$S/autres-formes.ts")"
check "définition id: '<kpi>' ⇒ présent" "présent" "$(evaluer "$S/definition.ts")"
check "définition id: \"<kpi>\" ⇒ présent" "présent" "$(evaluer "$S/guillemets-doubles.ts")"
check "source vide ⇒ arrêt" "arrêt 1 : pilote-file : backend/src/modules/admin/services/command-center-kpi.service.ts vide" \
  "$(evaluer "$S/vide.ts")"
check "source illisible (lecture refusée) ⇒ arrêt" \
  "arrêt 1 : pilote-file : lecture de backend/src/modules/admin/services/command-center-kpi.service.ts impossible" \
  "$(evaluer "$S/inexistant.ts")"
check "source non UTF-8 ⇒ arrêt" "arrêt 1" "$(evaluer "$S/non-utf8.ts" | cut -d' ' -f1-2)"
check "commentaire non fermé ⇒ arrêt, pas « absent »" "arrêt 1" "$(evaluer "$S/non-ferme.ts" | cut -d' ' -f1-2)"
check "contrôle en lecture seule" "0" "$(wc -l < "$FAKE_LOG")"

echo "== controle : cas réel, service de la version testée =="
REEL="$ICI/../../backend/src/modules/admin/services/command-center-kpi.service.ts"
check "rôle 13 : payments_kept présent (nouvelle règle)" "présent" "$(evaluer "$REEL" 13)"
check "rôle 13 : ancienne règle (grep -F) donnait présent" "0" "$(grep -qF payments_kept "$REEL"; echo $?)"
check "rôle 23 : $K absent (nouvelle règle)" "absent" "$(evaluer "$REEL" 23)"
check "rôle 23 : ancienne règle (grep -F) donnait absent" "1" "$(grep -qF "$K" "$REEL"; echo $?)"

[[ "$FAIL" -eq 0 ]] && echo "RÉSULTAT : tous les contrôles passent" || echo "RÉSULTAT : ÉCHEC"
exit "$FAIL"
