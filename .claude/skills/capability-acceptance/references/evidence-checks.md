# evidence-checks — commandes de preuve

Commandes en lecture seule, exécutées le 2026-10-22 depuis un worktree du dépôt.
Recopier la sortie brute dans la preuve, avec la date UTC de l'exécution.

## Servi

**PROD** — dernier déploiement réussi, puis appartenance du correctif :

```bash
gh run list --workflow deploy-prod.yml --status success -L 1 --json headSha,createdAt
git merge-base --is-ancestor <sha-du-correctif> <headSha> && echo "dans la PROD"
git rev-list --count <headSha>..origin/main   # commits de main absents de la PROD
```

Un run réussi prouve la chaîne de déploiement, pas la santé : compléter par le
dernier résultat de `prod-smoke-tests.yml`. Jamais de SSH PROD.

**PREPROD** — la même garde que `deploy-prod.yml`, en lecture seule :

```bash
GITHUB_SHA=<sha-40> GITHUB_API_URL=https://api.github.com \
GITHUB_REPOSITORY="$(gh repo view --json nameWithOwner -q .nameWithOwner)" \
GITHUB_TOKEN="$(gh auth token)" node scripts/ci/prod-preprod-evidence.mjs
```

Sortie 0 = Deploy PREPROD, E2E Smoke et Lighthouse verts pour ce commit. Ce que
ces jobs vérifient reste à lire : un smoke vert peut ne rien prouver (§Vacuité).

**DEV** — le working tree du checkout principal est servi (Vite en middleware),
modifications non commitées comprises :

```bash
main="$(git rev-parse --path-format=absolute --git-common-dir)/.."
git -C "$main" log -1 --format='%H %cI'
git -C "$main" status --short --untracked-files=no   # vide = HEAD servi tel quel
ps -eo lstart,args | grep "[n]ode dist/main.js"     # démarrage du backend
```

Un correctif présent seulement dans un worktree n'est pas servi par DEV. Le prouver
avant fusion se limite au test isolé (L2) et, au mieux, à une simulation déclarée
comme telle (interception Playwright du HTML servi) ; le niveau L3 attend le code servi.

## Vacuité

Rejouer le test sans le correctif ; le rouge attendu doit apparaître. Jamais de
`git stash` nu : la pile est partagée entre worktrees et sessions, un `pop` peut
reprendre le travail d'un autre.

```bash
bak="$(mktemp -d)" && cp <fichier-corrigé> "$bak/"
git show HEAD:<fichier-corrigé> > <fichier-corrigé>   # code sans le correctif
npx vitest run <test>        # ou : npx playwright test <spec> --retries=0
cp "$bak/$(basename <fichier-corrigé>)" <fichier-corrigé> && git diff --stat -- <fichier-corrigé>
```

Signes d'un test qui ne peut pas échouer :

- un compte journalisé (`console.log(count)`) sans assertion ;
- une branche `if (found) … else …` qui accepte les deux issues ;
- `.catch(() => {})` ou `isVisible().catch(() => false)` suivi d'aucune assertion ;
- un `test.skip` conditionnel qui saute sans rien dire ;
- une assertion d'absence sur un sélecteur qui ne trouve jamais rien.

Exemple constaté le 2026-10-22 : les étapes recherche et panier de
`frontend/tests/e2e/critical-path.spec.ts` passaient sur PREPROD avec zéro
résultat. Une soumission avant hydratation partait sur `/?search=` (rendu serveur
sans `action` ni `name="q"`), sans que le test le voie.

## Rendu serveur et hydratation

Un formulaire doit fonctionner avant l'hydratation : le vérifier sans JavaScript.

```ts
test.use({ javaScriptEnabled: false });
```

En test unitaire, `renderToString` puis `hydrateRoot` sur le même arbre montre
ce que le navigateur soumet avant React, et si un champ contrôlé efface la saisie
(`frontend/tests/unit/navbar-search-native-submit.test.tsx`).
