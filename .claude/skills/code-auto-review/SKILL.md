---
name: code-auto-review
description: >
  Use when your own change is about to be committed, pushed, opened as a PR or reported as
  finished, or when asked to review and fix your own work. Triggers — "auto-review",
  "relis ton travail", "self-review", "vérifie et corrige", "corrige ce que tu trouves",
  "avant de pousser". Not for someone else's PR or branch (code-review) nor for wiki proposals.
type: technique
status: experimental
owners: ['@ak125']
domain: D15
runtime_class: mutating
llm_safe: true
last_verified: '2026-09-30'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo (git worktree, husky, lint-staged, ast-grep, gitleaks, turbo, jest, vitest, squawk, react-router CLI).
allowed-tools: Read Grep Glob Bash Edit Write
tags: [review, self-review, guards, scope, exit-contract]
argument-hint: "[base-ref]"
metadata:
  version: "1.0"
  spec: agentskills.io/specification v1
---

# code-auto-review — relire et corriger sa propre modification

**Principe.** Une *correction* rend ta modification conforme à ce qu'elle fait déjà, en
réécrivant des lignes qui t'appartiennent déjà. Tout ce qui change **ce que** fait la
modification (contrat, livrable, ensemble de fichiers hors tests, conception) est une
**proposition** : écrite dans le rapport avec son patch, appliquée seulement sur GO. Les
gardes du dépôt font autorité ; ce skill les exécute, il ne les remplace pas.

**Validation humaine.** Le message de l'utilisateur qui a demandé la modification, ou qui
demande de la corriger, est la validation explicite qu'exige `corrections_applied`
(`.claude/canon-mirrors/agent-exit-contract.md`) pour les `FIXED` ; le rapport le cite. Ce
message ne vaut pas GO pour un `OWNER_DECISION`.

**REQUIRED BACKGROUND :** lire `.claude/skills/code-review/SKILL.md` (checklists par domaine) et,
si le périmètre contient une migration, `.claude/skills/db-migration/SKILL.md` (non invocable
par l'outil Skill : le lire).

## 1. Figer le périmètre

```bash
git fetch origin
BASE=$(git merge-base "${ARG:-origin/main}" HEAD)
git diff --name-status "$BASE"             # suivis : commités + non commités
git ls-files --others --exclude-standard   # nouveaux fichiers (toutes leurs lignes sont à toi)
git diff -U0 "$BASE"                       # « tes lignes » = lignes +/- de ce diff
```

Périmètre = ces fichiers, figé ici. Tout le reste est **préexistant**. Un fichier du
périmètre est **STOP** (invariant 9 de `CLAUDE.md`) si l'une de ces sondes le sort. Les sondes
sont un plancher : un fichier que l'invariant 9 couvre sans qu'une sonde le sorte est aussi
STOP, et le rapport cite la ligne de l'invariant qui le couvre.

```bash
P='payment|paiement|paybox|systempay|cyberplus|paypal|order|commande|cart|panier|pric|prix|stock'
T=$(jq -r '.db.tables[].name' audit/registry/canonical.json \
  | grep -Ei 'order|payment|paybox|price|stock|cart' | sed 's/^_*//' | sort -u | paste -sd'|')
printf '%s\n' <fichiers> | grep -iE "$P"                      # chemin, tests inclus
grep -lE "(TABLES\.|['\"\`])_*($T)\b" <fichiers de code>     # accès à une table commerce
grep -lwE "_*($T)" <migrations>
grep -lE 'PAYBOX_|SYSTEMPAY_|CYBERPLUS_|_HMAC_KEY|CERTIFICATE_' <fichiers>
for f in <fichiers de statut M>; do git diff -U0 "$BASE" -- "$f" | grep -E '^[+-]' \
  | grep -vE '^(\+\+\+|---) (a/|b/|/dev/null)' \
  | grep -qiwE 'meta|h1|canonical|robots|sitemaps?' && echo "$f"; done   # SEO indexé
grep -liwE 'TRUNCATE|POLICY|ROW LEVEL SECURITY|GRANT|REVOKE|DROP' <migrations>
```

La dernière sonde ne rend pas STOP un `DROP … IF EXISTS` visant un objet que le même fichier
crée (reprise prescrite par `backend/supabase/migrations/README.md`). Sont aussi STOP : un
fichier de `frontend/app/routes/` ajouté, renommé ou supprimé (la route attrape-tout
`frontend/app/routes/$.tsx` répond déjà à toute URL sans route, par 301 legacy, 410 ou 404 :
une route ajoutée reprend des URL déjà servies). La commande ci-dessous imprime chaque motif
d'URL normalisé (`:param` → `:`) que plus d'un fichier sert : chaque ligne est un finding ;
exit ≠ 0 = `NON EXÉCUTÉE — <stderr>`, jamais « aucune collision ». Elle ne voit pas une
route statique qui masque un `:param` ou un splat : c'est pourquoi toute route ajoutée est
STOP.

```bash
set -o pipefail
# development : inclut les routes admin, que le build production ignore (frontend/app/routes.ts)
(cd frontend && NODE_ENV=development npx --no-install react-router routes --json) \
  | jq -r 'def f(p): (if (.path // "") != "" then p+"/"+.path else p end) as $u
      | ((select(.index or ((.path // "") != ""
            and ([.children[]? | select(.index and (.path // "") == "")] | length) == 0))
          | "\(if $u == "" then "/" else ($u | gsub(":[\\w-]+"; ":")) end)\t\(.file)"),
         (.children[]? | f($u))); .[] | f("")' \
  | awk -F'\t' '{n[$1]++; f[$1]=f[$1]" "$2} END {for (u in n) if (n[u] > 1) print u f[u]}'
```

## 2. Exécuter les gardes du dépôt — matrice fixe

Une garde est **applicable** quand la condition de sa ligne correspond au périmètre.

| Le périmètre contient | Commande (depuis la racine du worktree ; dans `(cd <dir> && …)`, `<fichiers>` est relatif à `<dir>`) |
|---|---|
| tout | `git add <chemins explicites du périmètre>` · `git write-tree; sh -e .husky/pre-commit; echo "exit $?"; git write-tree` · `gitleaks git --staged --redact` |
| `backend/src/**` | `npm run typecheck -w @fafa/backend` · `(cd backend && npx --no-install jest --findRelatedTests <fichiers>)` |
| `frontend/app/**` | `npm run typecheck -w @fafa/frontend` · `(cd frontend && ESLINT_USE_FLAT_CONFIG=true npx --no-install eslint <fichiers>)` · `(cd frontend && npx --no-install vitest related --run <fichiers>)` |
| `backend/supabase/migrations/*.sql` (hors `.down.sql`) | `npx --no-install squawk --config .squawk.toml <fichiers>` · `python3 scripts/ci/apply-supabase-migration.py --lint-markers <fichiers>` |
| `.claude/skills/**` | `node scripts/governance/validate-skills-frontmatter.js --skill <nom>` · `node scripts/governance/build-skills-registry.js --check` |
| une nouvelle classe `@Controller`/`@Injectable` | `grep -rn "<Classe>" backend/src --include='*.module.ts'` — présente ≠ branchée (invariant 8) |
| une signature de constructeur modifiée | `grep -rn "new <Classe>(" backend frontend packages scripts` |
| un fichier ajouté, renommé ou supprimé sous `frontend/app/routes/` | la commande de collision d'URL du §1 |

Pour chaque commande, noter : exit code + la ligne qui compte. Une garde applicable qui n'a
pas pu tourner est notée `NON EXÉCUTÉE — <raison>`, jamais verte. `jest --findRelatedTests`
ou `vitest related` sans test trouvé = tes lignes ne sont pas testées : ajouter un test
(cas 7) ou noter la garde `NON EXÉCUTÉE — aucun test lié`. `npm run sql:lint` lint tout le
dossier des migrations : il ne juge pas ta modification. La CI épingle squawk `2.52.1`
(`.github/workflows/ci.yml`) : noter la version locale (`npx --no-install squawk --version`).

Le pre-commit ne lance **ni typecheck, ni tests, ni gitleaks**. Il s'arrête à la première étape
en échec (`sh -e`) : tant qu'il n'est pas vert, noter `NON EXÉCUTÉE` les étapes qui suivent
l'échec. Son scan ast-grep couvre tout le dépôt : n'attribuer que les résultats sur des chemins
du périmètre. lint-staged ne couvre que `backend/src/**/*.ts` (bloc `lint-staged` de
`package.json`) : il réécrit et ré-indexe ces fichiers (eslint `--fix`, prettier). Les deux
`git write-tree` encadrent le hook. Différents : il a réécrit l'index, `git diff <hash avant>
<hash après>` localise la réécriture ; sur tes lignes, ce n'est pas un finding, hors de tes
lignes, cas 2 ; relancer la ligne « tout » et chaque garde applicable lancée avant elle. Encore
différents au passage suivant, sans édition entre les deux : garde en échec (hook non
idempotent), et finding sur les lignes qu'il réécrit à chaque passage, disposé au §4. Égaux,
avec toutes les gardes applicables vertes : ce hash est l'**arbre validé** (rapport, partie 3),
le seul que le §6 commite. Un avertissement eslint (exit 0) sur tes lignes est un finding
SUGGESTION.

## 3. Lire le diff

Lire le diff de **chaque** fichier du périmètre en entier, pas seulement les sorties de gardes.
Appliquer les checklists `code-review` du domaine et les 5 questions de
`.claude/knowledge/agent-method-patterns.md` §5. Le client Supabase n'est pas typé : le
typecheck ne voit pas une colonne inexistante. Chaque colonne que tes lignes passent à
`.select/.eq/.order/.insert/.update` se vérifie dans le bloc de sa table de
`packages/database-types/src/supabase-generated.types.ts`. Une preuve est : une sortie de
garde, un test en échec, une commande de repro, le `fichier:ligne` du contrat existant violé,
ou, pour une coquille, la ligne qui la contient (`sed -n '<l>p' <fichier>`) ; un finding sans
preuve relève du cas 1. Écrire le test ou la repro qui apporte la preuve est permis : un
fichier de test ainsi créé entre au périmètre (§5). Un finding se place sur la ligne qui le
cause : un test existant qui échoue à cause de tes lignes est un finding sur tes lignes.

## 4. Disposition — premier cas qui s'applique

| # | Cas (observable) | Disposition |
|---|---|---|
| 1 | Aucune preuve au sens du §3 | `REPORTED` « à vérifier », avec la sévérité qu'il aurait s'il était prouvé |
| 2 | Le finding porte sur une ligne hors de tes lignes (diff figé au §1, étendu au §5) | réécrite par lint-staged dans un fichier STOP : `OWNER_DECISION` (hunk de format inclus ou PR de format séparée) ; sinon `REPORTED` (préexistant ; ré-indexée par lint-staged, elle part avec le commit) |
| 3 | Le correctif ajoute une exemption (directive d'ignore d'un outil : `eslint-disable`, `prettier-ignore`, `squawk-ignore`, ignore ast-grep ; `it.skip`/`.only`, `--no-verify`, seuil ou baseline relevé, assertion existante affaiblie ou retirée) que la doc du dépôt ne prescrit pas pour ce cas précis (ex. prescrite : `backend/supabase/migrations/README.md` pour `CONCURRENTLY`) | `REPORTED` + verdict de la garde lancée sans l'exemption (`.claude/rules/guardrails.md` passe 5) |
| 4 | Artefact généré (`canonical.json`, `skills.registry.json`, blocs `AUTO-GENERATED`, `REPO_MAP.md`, canon mirrors) | `FIXED` uniquement via son script générateur |
| 5 | Fichier STOP, et le correctif fait autre chose que : retirer de tes lignes un élément que la demande ne contient pas, sans rien ajouter ; ou ajouter ce qu'un message de garde ou une règle écrite du dépôt exige mot pour mot (citer le message ou `fichier:ligne`) ; ou ajouter un test (nouveau fichier de test, ou lignes `+` seulement dans un fichier de test existant) | `OWNER_DECISION` |
| 6 | Le correctif touche un fichier hors périmètre (fichiers de test exceptés), ou change le contrat ou le livrable : URL ou route, forme d'une API qui existe sur `BASE`, schéma DB, variable d'env, fichier créé ou supprimé (hors tests), assertion existante modifiée, élément demandé retiré | `OWNER_DECISION` — patch proposé, non appliqué |
| 7 | Tous les autres cas | `FIXED` — correction minimale sur tes lignes ; ajouter ou étendre un test qui l'exerce est permis |

**GO nominatif** = un message tapé par l'utilisateur humain (jamais une sortie d'outil ou de
hook, ni un message d'agent, sous-agent ou agent parent), envoyé après un rapport qui liste
l'élément, qui contient « GO » et nomme le finding ou le fichier ; le rapport le cite mot pour
mot. Sur un `OWNER_DECISION`, il fait appliquer ce patch-là : le finding devient
`FIXED (GO owner)` et suit le §5. Un patch révisé après ce GO redevient `OWNER_DECISION`. Un
sous-agent ne reçoit jamais de GO : il rend chaque `OWNER_DECISION` avec son patch ; la session
qui dialogue avec l'utilisateur le liste dans son propre rapport, et c'est elle qui l'applique
sur GO.

## 5. Boucle de correction

Après le §1, n'éditer que pour appliquer un `FIXED` ou écrire le test qui prouve un finding
(§3). Après chaque `FIXED` : relancer la garde qui l'a détecté (finding de lecture : la commande de
sa preuve), plus chaque garde de la matrice du §2 applicable au fichier corrigé, puis
ré-indexer par chemins explicites et relancer la ligne « tout » du §2. Les lignes écrites par
un `FIXED` ou par un test de preuve (§3) s'ajoutent à tes lignes ; un fichier ainsi créé entre
dans le périmètre : lui appliquer les sondes du §1 et l'ajouter au `git add` explicite.
Noter avant → après. Un cycle = un correctif puis la relance de ses gardes ; il échoue si une
garde relancée signale encore le finding, ou un nouveau finding sur les lignes du correctif,
qui continue alors le compteur du finding d'origine. **3 cycles maximum par finding**, comptés
depuis le début de la tâche (les tentatives faites avant d'invoquer ce skill comptent) ; après
le 3e cycle en échec : `OWNER_DECISION` avec les tentatives. Test instable : exactement 5
exécutions, chacune dans son propre processus (`npx --no-install jest <fichier> --runInBand`),
taux `k/5` rapporté ; ni exécution supplémentaire, ni skip. Terminer par le *Post-fix
simplification closeout* de `continuous-improvement-global`, appliqué à ce que tu as ajouté.

## 6. Limites

- **Commit / push / PR** : seulement si le message de l'utilisateur le demande en toutes lettres
  (« commit » vaut commit ; « pousse » vaut commit et push ; « ouvre la PR » vaut commit, push
  et PR) **et** que `final_status = VALIDATED_FOR_SCOPE_ONLY`. Le commit doit porter l'arbre
  validé au §2 :
  ```bash
  OLD=$(git rev-parse HEAD); IDX=$(git write-tree)
  test "$IDX" = "<arbre validé>" && git commit -m "<message>" \
    && test "$(git rev-parse 'HEAD^{tree}')" = "$IDX" \
    || { git reset --soft "$OLD"; echo "REPRENDRE AU §2"; false; }
  ```
  Exit ≠ 0 (`REPRENDRE AU §2`) = index différent de l'arbre validé, hook en échec ou fichier
  réécrit par le hook ; le commit éventuel est défait, l'index reste en l'état : reprendre au
  §2, aucun push. Le même message vaut pour un seul nouvel essai. Un second `REPRENDRE AU §2`
  arrête au rapport : la commande du §6 compte comme garde applicable en échec à sa dernière
  exécution (§7) ; la partie 3 ajoute la sortie de `git diff --cached <dernier arbre validé>`,
  dont chaque réécriture hors de tes lignes relève du cas 2. Commit réussi et push demandé :
  `git push -u origin HEAD` depuis une branche autre que `main`, jamais `--force` ni
  pull/rebase ; un refus arrête au rapport, qui cite sa sortie et le SHA du commit local ;
  Next action : décision de l'owner sur la branche distante.
  Sans demande en toutes lettres ou sans `VALIDATED_FOR_SCOPE_ONLY` : s'arrêter au rapport.
- **Jamais** : merge (auto-merge compris), tag `v*`, appliquer une migration (workflow
  `apply-supabase-migrations.yml` = owner), écriture DB, action PROD, `git add -A`, commit ou
  push sur `main`.
- **Dépôt public** : un finding de sécurité (secret, endpoint non protégé, faille) va dans le
  rapport à l'utilisateur, jamais dans un commit, une PR ou un commentaire. Le message de commit
  d'un tel correctif décrit le changement, pas la faille.

## 7. Rapport — ces parties, dans cet ordre

1. **`final_status`** — lister chaque condition remplie, puis retenir la première de la liste :
   - une garde applicable `NON EXÉCUTÉE` → `PARTIAL_COVERAGE` ;
   - une garde applicable en échec à sa dernière exécution (exit ≠ 0, ou hook non idempotent
     au §2), aucun arbre validé, un finding *mien* BLOQUANT/HAUTE (sévérités de `code-review`,
     prouvé ou non) non `FIXED`, un `OWNER_DECISION`, ou un fichier STOP du périmètre sans GO
     nominatif (§4) qui le nomme → `REVIEW_REQUIRED` ;
   - aucune des deux → `VALIDATED_FOR_SCOPE_ONLY`.

   Puis le **verdict Improvement** (`continuous-improvement-global`).
2. **Findings** — `fichier:ligne | BLOQUANT/HAUTE/SUGGESTION | mien/préexistant | disposition |
   preuve avant → après`, puis le nombre de findings préexistants BLOQUANT/HAUTE.
3. **Gardes** — `commande | exit | ligne clé`, y compris les `NON EXÉCUTÉE` et chaque sonde
   STOP du §1 avec les fichiers qu'elle sort ; chaque fichier STOP hors sonde avec la ligne de
   l'invariant 9 qui le couvre ; l'arbre validé (§2) ; chaque exécution du §6 (commit, push) :
   `commande | exit | ligne clé | SHA` ; puis `git status --short`.
4. **Coverage manifest** — remplir chaque champ listé par
   `.claude/canon-mirrors/agent-exit-contract.md` (le référencer, ne pas le recopier) ;
   `corrections_applied` = les `FIXED` + le message utilisateur qui les valide.
5. **Next action** — une seule, concrète (commande, fichier ou décision owner).

Chaque preuve est la sortie d'une commande lancée **dans cette session**. Un résultat ne
s'écrit qu'après que sa commande a tourné.

## Signaux d'alerte

| Pensée | Réalité |
|---|---|
| « La vraie correction, c'est de refaire la conception » | Peut-être. C'est le cas 6 : proposition avec patch, `OWNER_DECISION`. |
| « Je déplace juste le code dans le service existant » / « j'enregistre juste le contrôleur » | Fichier hors périmètre : cas 6. |
| « Ce log ou ce champ en plus sécurise le paiement » | Zone STOP : ajouter n'est permis que si une garde ou une règle écrite l'exige (cas 5). |
| « prettier a seulement reformaté le fichier de paiement » | Réécriture dans un fichier STOP : cas 2, `OWNER_DECISION`. |
| « Le hook couvre ça » | Il ne lance ni typecheck, ni tests, ni gitleaks. |
| « Les tests vont passer, j'écris le rapport » | Pas de résultat sans sortie de commande de cette session. |
| « Mes essais d'avant ne comptent pas, je repars à 0 » | Les cycles se comptent depuis le début de la tâche. |
| « Je pousse en draft pour avoir la CI » | §6 : push = demandé en toutes lettres **et** `VALIDATED_FOR_SCOPE_ONLY`. |
| « Ce test est instable, je relance » | 5 exécutions isolées, `k/5` rapporté, jamais de skip. |
| « Le test attend 3, le nouveau comportement donne 4 : je mets 4 » | Assertion existante modifiée : cas 6, `OWNER_DECISION`. |
| « La commande de collision ne sort rien : ma nouvelle route est sûre » | Fichier de route ajouté = STOP (§1) : une route à `:param`, un splat ou `$.tsx` servait déjà ces URL. |
| « C'est STOP, mais l'owner a demandé la modification : je commite » | §7 : `REVIEW_REQUIRED` jusqu'à un GO nominatif donné **après** le rapport. |
