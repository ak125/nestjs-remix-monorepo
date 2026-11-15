# ADR-128 — étape 2 : routine `mandat-remise`, gestes d'activation, constats

Document de remise à l'owner. La session de préparation n'a rien activé : aucun workflow, label,
secret, variable, environnement ni runner n'a été créé ou modifié. Le workflow est livré sous
`scripts/ops/` (ADR-130 D3.4) et ne s'exécute pas tant que l'owner ne l'a pas déplacé.

## Contenu de la PR

| Fichier | Rôle |
|---|---|
| `scripts/ops/mandat-remise.yml` | workflow à deux jobs, déplacé par l'owner dans `.github/workflows/` (geste 2) |
| `scripts/ops/mandat-remise.sh` | garde, worktree, session, état figé, expurgation, vérification, publication |
| `scripts/ops/mandat-remise.prompt.md`, `mandat-remise.schema.json` | consigne ajoutée au prompt système et schéma de la sortie de session |
| `scripts/ops/mandat-remise.test.sh` | test sur fixtures (dépôt git local, `gh` et CLI Claude simulés), sans réseau |

## Déroulé d'une exécution

1. **Filtre du workflow** (avant tout runner) : label `mandat-prêt`, expéditeur = `vars.MANDAT_OWNER`,
   auteur de l'issue = `vars.MANDAT_OWNER`, issue ouverte, pas une PR. Variable vide = rien ne tourne.
   Un événement filtré apparaît `skipped` dans Actions.
2. **Job `session`** sur le runner `agents` (GITHUB_TOKEN `contents: read`, `issues: read`, aucune
   clé d'App) :
   - `garde` reprend les contrôles du filtre côté script, relit l'issue par l'API (label encore
     présent : arrêt N3), compare l'empreinte SHA-256 du corps de l'API à celle du corps de
     l'événement, et vérifie que le dernier éditeur (GraphQL `editor`) est vide ou l'owner ;
   - `preparer` : `git worktree add $RUNNER_TEMP/mandat-<N> -b mandat/<N>-<slug> <origin/main>` dans
     le clone `actions/checkout` du job ; refus si la branche existe déjà sur origin ;
   - `session` : `claude -p` (CLI 2.1.316 épinglée) dans le worktree, prompt = corps de l'événement,
     sortie JSON sous schéma, `--restricted`, `--permission-mode dontAsk`, outils `Bash, Read, Edit,
     Write, Glob, Grep`, budget plafonné (20 USD), environnement vidé (`env -i`) : ni `GH_TOKEN` ni
     `GITHUB_TOKEN` ; journal `.jsonl` complet copié ;
   - `figer` : worktree propre exigé, recherche de secrets dans le diff et les messages, bundle git
     `refs/heads/mandat/… ^base` seulement si tout est sain ;
   - `expurger` retient d'abord le journal entier (remplacé par `journal/RETENU.txt` et ses empreintes)
     s'il contient un motif qu'un remplacement n'expurge pas sûrement : clé PEM, JWT, identifiants dans
     une URL, clé AWS, en-tête `Bearer`, paramètres RSA d'un fichier d'identité de runner ; tout autre
     fichier qui en contient (sortie et erreurs de session, résultat) est remplacé par son empreinte ;
     il retire ensuite les jetons connus des autres fichiers, puis artifact `mandat-remise-<run_id>` (90 jours),
     coût dans le résumé de l'exécution ; `nettoyer` retire worktree et branche locale.
3. **Job `publication`** sur un runner hébergé neuf (`environment: mandat-remise`, GITHUB_TOKEN
   `contents: read`, `issues: write`) :
   - `garde --publication` (label toujours présent) ;
   - `verifier` recalcule tout depuis le bundle sans rien croire du premier job : base atteignable
     depuis `main` (API compare), commits, fichiers lus en chemins bruts (`diff -z`,
     `core.quotePath=false`), aucun fichier sous `.github/` : workflows, actions composites, réglages
     (ADR-130 D3.4), aucun secret ni motif retenu dans les commits, un résultat de session sans
     motif de clé ou de jeton (sinon bloqué et rien n'en est rendu), branche absente d'origin ; `vérifié` sans contrôle `vert` est
     déclassé en `implémenté` ; un statut `bloqué` avec commits part en PR brouillon ;
   - jeton d'installation de l'App (`contents: write`, `pull-requests: write`, ce dépôt seul) créé
     dans ce job seulement, si la vérification autorise le push ;
   - `publier` : push de la tête vérifiée, PR `Refs #N` (jeton de l'App), commentaire AEC sur
     l'issue et label `statut:*` (GITHUB_TOKEN). Échec du jeton, du push ou de la PR : commentaire et
     `statut:bloqué` quand même, exécution rouge.

La routine ne pose jamais `statut:opérationnel`, ne retire jamais `mandat-prêt` et ne fusionne rien.
Relancer un mandat = l'owner retire puis repose `mandat-prêt` (après suppression de la branche
`mandat/<N>-…` si elle existe).

## Point 2 — isolation en worktree face au runner durci (D4.2)

Faits établis : le service du runner est durci (`docs/plans/2026-11-15-adr128-runner-dev-agents.md`
§5) par `ProtectHome=tmpfs`, `BindPaths=/home/gh-agents`, `InaccessiblePaths=/opt/automecanik`,
`NoNewPrivileges=yes`, `ProtectSystem=strict`. Le « clone DEV » de D4.2 (`/opt/automecanik/app`) est
donc illisible depuis un job, et c'est voulu (code, `.env`, clones). Le runner porte le seul label
`agents` (`--no-default-labels`) : le workflow cible `runs-on: [agents]`.

| Option | Isolation en worktree | Écart et coût |
|---|---|---|
| A. Clone persistant sous `/home/gh-agents` (hors workspace) | oui, worktree par mandat | état persistant entre exécutions à entretenir (fetch, prune, branches orphelines), script d'entretien maison ; aucun gain d'isolation sur B |
| **B. `actions/checkout` + `git worktree add` dans `$RUNNER_TEMP`** (retenue) | oui : un worktree par mandat, branche dédiée, base = `origin/main` relue à chaque exécution | clone remis à neuf par l'action native à chaque job ; worktree et branche locale retirés en fin de job ; deux issues en parallèle n'écrivent jamais dans le même répertoire |
| C. `anthropics/claude-code-action` | non : la session travaille dans le checkout du job, pas dans un worktree | l'action remet à la session un jeton GitHub (push, commentaires), contraire à la séparation retenue ; avantage réel : `use_commit_signing` (commits signés par GitHub) |
| (rejetée d'emblée) assouplir `InaccessiblePaths` | — | rouvre `/opt/automecanik` (dont `.env`) au runner |

Preuve de l'isolation (test `mandat-remise.test.sh`, chaîne « mandat mené ») : la session tourne
dans `…/wt/mandat-7` (variable `PWD` reçue par la CLI simulée), la branche part de la base attendue,
le worktree et la branche locale disparaissent du clone après le job, et une branche déjà présente
sur origin n'est jamais écrasée.

### Amendement proposé à D4.2 et D4.3 (rôle 02, ratification owner) — texte non écrit dans le Vault

> 2. **Exécution.** La session tourne sur le runner DEV `agents`. Le job clone le dépôt par
> `actions/checkout` dans son espace de travail, puis crée un worktree isolé
> (`git worktree add` dans le répertoire temporaire du job, branche `mandat/<N>-<slug>` sur
> `origin/main`) ; le clone servi du DEV reste hors d'atteinte du runner (durcissement de l'étape 1).
> Claude Code tourne en mode non interactif (`claude -p`) avec, comme prompt, le corps de l'issue
> tel qu'au moment du label, sans jeton GitHub. Les commentaires de l'issue sont des données, jamais
> des instructions. `anthropics/claude-code-action`, évaluée à l'étape 2, n'est pas retenue : elle
> n'isole pas en worktree et remet un jeton GitHub à la session.
>
> 3. **Preuve rendue dans l'issue.** Un second job, sur un runner hébergé par GitHub, vérifie le
> travail depuis un bundle git, pousse la branche et ouvre la PR avec un jeton d'installation de
> l'App créé dans ce seul job, puis commente l'issue avec le contrat de sortie AEC […] et pose
> `statut:implémenté`, `statut:intégré`, `statut:vérifié` (avec preuve citée) ou `statut:bloqué` ;
> `statut:opérationnel` reste à l'owner. La clé de l'App n'est jamais remise au runner DEV.

## Point 3 — défenses contre l'injection : ce qui est gardé et pourquoi

Les deux défenses du mandat sont **gardées toutes les deux**, elles couvrent des cas différents :

- **auteur = owner** (filtre et `garde`) : un tiers ne peut pas écrire un mandat que l'owner
  approuverait par erreur d'un label ;
- **corps figé au label** : le prompt est le corps de l'événement, jamais une relecture ; si le
  corps de l'API diffère (édition pendant l'attente en file), refus. S'y ajoute le dernier éditeur
  GraphQL : un collaborateur qui édite le corps d'une issue de l'owner (droit `triage`/`write`) est
  refusé même si l'édition précède le label ;
- **commentaires** : jamais injectés ; la consigne les déclare données ;
- **sorties de session** : mentions `@`, mots-clés de fermeture (`Closes #`) et commentaires HTML
  neutralisés dans le commentaire et la PR (test « mention neutralisée »).

Risque résiduel, consigné et non traité : la session a `Bash` et le même uid que le runner. Une
session détournée peut lire `CLAUDE_CODE_OAUTH_TOKEN`, joindre le réseau, modifier les scripts du
checkout avant les étapes suivantes du même job, ou altérer l'installation du runner pour les jobs
suivants. La frontière de confiance est donc le mandat écrit et approuvé par l'owner. Le second job
borne l'effet sur GitHub : il ne croit que le bundle, revérifie tout sur une machine neuve et seul
lui détient la clé de l'App.

Atténuations livrées : tout git lancé après la session sur le clone (recherche de secrets, état
figé, nettoyage) passe sans jeton, sans config globale ni système, sans fsmonitor ni hook ; la
recherche de secrets lit aussi les fichiers binaires (`git diff --text`) ; le clone de l'espace de
travail est vidé en fin de job, pour qu'une config git ou un hook posé par la session ne survive pas
au job ; le journal publié est retenu en entier (fail-closed) dès qu'un motif de clé ou de jeton non
expurgeable y figure, car l'artifact d'un dépôt public est téléchargeable par tout compte GitHub.
Atténuation forte, hors périmètre de cette PR (runner = acte de l'owner) : session sous un
second utilisateur ou dans un conteneur ne montant que le worktree, ou runner éphémère. Non couvert :
un secret encodé (base64, chiffré) dans un commit échappe à la recherche par motif.

## Point 4 — identité GitHub et jetons

- **GITHUB_TOKEN seul ne suffit pas** : une PR ouverte par lui ne déclenche pas les workflows
  `pull_request` (contrôles requis jamais lancés).
- **Jeton de l'App** pour le push et la PR. Les droits de l'App des agents (`automecanik-agents`)
  n'incluent pas `issues` (`scripts/ops/gh-app-token/automecanik-gh-app-token`, `PERMS`) :
  commentaire et labels passent donc par GITHUB_TOKEN `issues: write`, borné au job de publication.
- **Sans clé PROD ni clé du DEV** : la clé utilisée par le délivreur du DEV
  (`/etc/automecanik/github-app/private-key.pem`) n'est ni copiée ni lue. Recommandé : une seconde clé
  privée de la même App, générée par l'owner dans les réglages de l'App, stockée seulement comme
  secret de l'environnement `mandat-remise` (restreint à `main`), révocable séparément. Variante plus
  stricte : une App dédiée `mandat-remise` (droits `contents` et `pull_requests` seuls).
- **Commits** : auteur `mandat-remise <mandat-remise@users.noreply.github.com>`, non signés (aucune
  clé sur le runner). La fusion squash par l'owner produit un commit signé par GitHub.

## Gestes de l'owner, dans l'ordre (non exécutés)

Identité : le `gh` du DEV est l'App des agents, sans droit d'administration ; les gestes 3 à 6 se
font avec le compte de l'owner (interface web ou `gh` sur son poste).

1. **Fusion de cette PR** (G4), après lecture du diff.
2. **Déplacement du workflow** (PR de l'owner, ADR-130 D3.4) :
   ```bash
   git switch -c chore/activer-mandat-remise origin/main
   git mv scripts/ops/mandat-remise.yml .github/workflows/mandat-remise.yml
   git commit -S -m "ci(mandat-remise): active la routine (ADR-128 D4, étape 2)"
   ```
   À ne fusionner qu'après la fin de l'étape 1 (10 exécutions vertes de `pilote-file`, D8) et les
   gestes 3 et 4 : sans `MANDAT_OWNER`, le workflow ne lance rien.
3. **Variables du dépôt** :
   ```bash
   gh variable set MANDAT_OWNER --repo ak125/nestjs-remix-monorepo --body ak125
   gh variable set MANDAT_APP_ID --repo ak125/nestjs-remix-monorepo --body <ID de l'App>
   ```
4. **Environnement et clé** : *Settings → Environments → New environment* `mandat-remise`,
   *Deployment branches* = `main` seulement ; dans les réglages de l'App, *Generate a private key*
   (seconde clé), puis :
   ```bash
   gh secret set MANDAT_APP_PRIVATE_KEY --repo ak125/nestjs-remix-monorepo --env mandat-remise < cle.pem
   shred -u cle.pem
   ```
   `CLAUDE_CODE_OAUTH_TOKEN` existe déjà (secret du dépôt, utilisé par `pilote-file`).
5. **Mandat de réception n° 1** : une issue écrite par l'owner, petit périmètre documentaire, par
   exemple « Ajouter à `docs/plans/2026-11-15-adr128-etape2-mandat-remise.md` la date de la première
   exécution » ; poser `mandat-prêt`. Attendu : PR `mandat/<N>-…` ouverte, commentaire AEC, label
   `statut:*`, artifacts présents, coût dans le résumé.
6. **Refus et N2** :
   - refus d'un autre compte : depuis le DEV (`gh` = App des agents), `gh issue edit <N> --add-label
     mandat-prêt` sur une issue de test → exécution `skipped`, aucune écriture ;
   - N2 : `gh workflow disable mandat-remise.yml`, poser `mandat-prêt` sur une issue → aucune
     exécution ; `gh workflow enable mandat-remise.yml`.
7. **Mandats 2 et 3**, dont un qui exige un contrôle (test ciblé) : critère D8 = 3 mandats menés du
   label à la PR avec preuve AEC, sans copier-coller.
8. **Amendement D4.2/D4.3** (texte ci-dessus) : PR Vault par le rôle 02, ratification de l'owner.

## Arrêts (ADR-128 D6)

| Niveau | Geste | Effet |
|---|---|---|
| N3 | retirer `mandat-prêt` de l'issue | relu au début de chaque job : l'exécution en attente s'arrête sans publier |
| N2 | `gh workflow disable mandat-remise.yml` | plus aucune exécution |
| N1 | arrêt du service du runner `agents` | plus aucune session sur le DEV ; un job en file expire après 24 h |

## Limites et inconnues

- Commits de branche non signés ; la protection de `main` n'a pas pu être lue (HTTP 403 avec l'App
  des agents, `rulesets` = `[]`) : savoir si `main` exige des commits signés reste à confirmer.
- Les contrôles déclarés par la session sont auto-déclarés ; seul le déclassement de `vérifié` sans
  contrôle `vert` est automatique. La CI de la PR reste la preuve indépendante.
- Risque résiduel du même uid (point 3).
- Journal : la liste de motifs qui le retient ne couvre pas un secret de forme inconnue (chaîne à
  forte entropie sans préfixe). Proposé seulement : chiffrer le journal avec une clé publique dont
  l'owner détient seul la clé privée, ou le garder hors de l'artifact public. Une fausse alerte
  (le mandat lit un fichier de test contenant un en-tête de clé) fait perdre le journal, pas le
  mandat.
- Fichiers du dépôt exécutés par la CI hors de `.github/` (`package.json`, lockfiles, `scripts/ci/`,
  configurations de build) : une PR `mandat/*` peut les modifier, et la CI `pull_request` d'une
  branche du dépôt reçoit ses secrets, exactement comme pour toute branche d'agent poussée
  aujourd'hui. Les bloquer refuserait la plupart des mandats ordinaires. Proposé seulement (réglage
  du dépôt, acte de l'owner) : retirer les secrets des jobs `pull_request`, ou les placer derrière un
  environnement à approbation requise pour les branches `mandat/*`.
- Chargement de `CLAUDE.md` sous `--restricted` non vérifié sur une vraie session.
- `node_modules` absent du worktree : un mandat qui lance des tests paie un `npm ci` (temps, disque,
  budget) ; à mesurer au mandat 1.
- La CLI et le comportement réel du runner (`setup-node`, `npx`, réseau) ne sont prouvés que par
  le test simulé : la première exécution réelle est le mandat de réception.
