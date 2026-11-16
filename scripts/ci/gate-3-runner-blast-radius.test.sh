#!/usr/bin/env bash
# Tests de GATE-3, check 1 (pull_request_target + actions/checkout).
# Chaque cas : un dépôt Git temporaire avec un seul workflow, la garde lancée dedans
# (elle lit `git ls-files`), puis le code de sortie comparé à l'attendu.
# Usage : bash scripts/ci/gate-3-runner-blast-radius.test.sh
# Placé dans scripts/ci/ (glob ownership D13) ; la garde testée reste dans tools/validator-gates/.
set -euo pipefail

GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/tools/validator-gates/gate-3-runner-blast-radius.sh"
[[ -f "$GATE" ]] || { echo "garde introuvable : $GATE"; exit 1; }
pass=0
fail=0

# expect <green|red> <nom> <contenu du workflow>
expect() {
  local want="$1" name="$2" body="$3" dir rc got
  dir=$(mktemp -d)
  mkdir -p "$dir/.github/workflows"
  printf '%s\n' "$body" > "$dir/.github/workflows/wf.yml"
  git -C "$dir" init -q
  git -C "$dir" add .github/workflows/wf.yml
  rc=0
  (cd "$dir" && bash "$GATE" >"$dir/out.txt" 2>&1) || rc=$?
  # 126/127 = garde non exécutable ou introuvable : jamais un rouge valide.
  if [[ "$rc" -eq 0 ]]; then got=green; elif [[ "$rc" -ge 126 ]]; then got="erreur($rc)"; else got=red; fi
  if [[ "$got" == "$want" ]]; then
    pass=$((pass+1)); echo "ok   $want  $name"
  else
    fail=$((fail+1)); echo "FAIL $name : attendu $want, obtenu $got"; sed 's/^/     /' "$dir/out.txt"
  fi
  rm -rf "$dir"
}

BASE='${{ github.event.pull_request.base.sha }}'
HEAD='${{ github.event.pull_request.head.sha }}'

# ---------- Positifs : vert ----------
expect green "checkout base.sha + persist-credentials false (forme name puis uses)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout de la base
        uses: actions/checkout@v7
        with:
          ref: $BASE
          persist-credentials: false
      - run: echo ok"

expect green "forme '- uses:' en premier, deux checkouts sûrs" "on: [pull_request_target, pull_request_review]
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
          ref: $BASE
  b:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $BASE
          persist-credentials: false"

expect green "valeurs entre guillemets" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: \"actions/checkout@v7\"
        with:
          ref: \"$BASE\"
          persist-credentials: 'false'"

expect green "pull_request_target sans checkout" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      # Pas de \`actions/checkout\` ici
      - run: echo ok"

expect green "pull_request (pas _target) avec checkout simple : hors check 1" "on:
  pull_request:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7"

# ---------- Négatifs : rouge ----------
expect red "checkout sans ref" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7"

expect red "checkout sans with, persist-credentials absent" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $BASE"

expect red "ref de tête (head.sha)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $HEAD
          persist-credentials: false"

expect red "ref de merge (refs/pull/N/merge)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: refs/pull/\${{ github.event.number }}/merge
          persist-credentials: false"

expect red "ref base.ref (branche, pas le SHA exact)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: \${{ github.event.pull_request.base.ref }}
          persist-credentials: false"

expect red "ref base.sha suivie d'un suffixe" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $BASE\${{ github.head_ref }}
          persist-credentials: false"

expect red "persist-credentials: true" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $BASE
          persist-credentials: true"

expect red "repository: fourni (dépôt de la PR)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          repository: \${{ github.event.pull_request.head.repo.full_name }}
          ref: $BASE
          persist-credentials: false"

expect red "un checkout sûr et un checkout de tête dans le même fichier" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $BASE
          persist-credentials: false
  b:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: $HEAD
          persist-credentials: false"

expect red "ref et persist-credentials dans l'étape suivante, pas dans le checkout" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: some/other-action@v1
        with:
          ref: $BASE
          persist-credentials: false"

expect red "flow mapping non reconnu (échec fermé)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with: { ref: '$BASE', persist-credentials: false }"

expect red "ref en bloc multiligne (échec fermé)" "on:
  pull_request_target:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: >-
            $BASE
          persist-credentials: false"

echo
echo "GATE-3 tests : $pass réussis, $fail en échec"
[[ "$fail" -eq 0 ]]
