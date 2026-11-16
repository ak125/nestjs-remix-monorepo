# Actes réservés à l'owner — commandes exactes (mandat AR)

Aucune de ces commandes n'a été lancée par l'agent.

**Machine et compte** : le poste de l'owner, avec `gh` authentifié sur le compte `ak125`, qui est
administrateur du dépôt. Vérification : `gh auth status`. L'identité `gh` de la machine DEV est un
jeton d'App sans droit d'administration ni `actions:write`. Elle répond `403 Resource not accessible
by integration` à la lecture de la protection de `main` (relevé du 2026-11-16). Elle ne peut donc
servir à aucun de ces actes.

`R=ak125/nestjs-remix-monorepo` dans toutes les commandes.

## Ordre

1. Correctifs `.github/` (§2), commités par l'owner **sur la branche de cette PR**, avant la fusion.
   Les deux vont ensemble : le patch 02 appelle `--contracts`, qui n'existe que dans cette PR, et le
   garde `🔌 scripts/ci test wiring` (job `🛡️ Deterministic gates`) reste rouge tant que
   `scripts/ci/merge-circuit.test.mjs` n'est lancé par aucun workflow de PR. C'est le patch 02 qui
   le lance.
2. Fusion de cette PR (§1 ; circuit élevé : `.spec/00-canon/**`, `.claude/governance/**`, `.github/**`).
3. Labels, puis App et secrets (§3 et §5). Le §4 n'appelle plus aucun geste (décision 91). Rien ne fusionne tant que l'App n'est pas posée.
4. PR de test (§7) qui vérifie le check `🚦 Circuit de fusion`.
5. Protection de `main` (§6), en ajoutant `🚦 Circuit de fusion` seulement après le §7.
6. Ruleset des tags `v*` (§8). Cet acte est indépendant des autres et peut se faire à tout moment.

## 1. Fusion de cette PR

Relire la tête, puis fusionner sur ce SHA exact :

```bash
gh pr view <N> -R $R --json headRefOid,statusCheckRollup --jq .headRefOid
gh pr merge <N> -R $R --squash --match-head-commit <sha40>
```

## 2. Correctifs `.github/` (hook `pretool-file-guard.sh` : fichiers réservés à l'owner)

**Fait le 2026-11-16** par l'owner (commit `4672ba04d`), avec la ligne `--model claude-opus-5-5` (décision 98). Le patch 04 reprend cette ligne. Les quatre fichiers de la tête sont identiques, octet pour octet, au résultat des quatre patches appliqués sur `0442799ce`.

Sur la branche de cette PR, **avant la fusion** (voir l'ordre ci-dessus) :

```bash
git fetch origin governance/mandat-ar-department-contracts-20261116
git switch governance/mandat-ar-department-contracts-20261116
git merge --ff-only origin/governance/mandat-ar-department-contracts-20261116
git apply --check docs/audit/mandat-ar-20261116/patches/*.patch
git apply docs/audit/mandat-ar-20261116/patches/*.patch
git add .github && git commit -m "ci(governance): CODEOWNERS des zones à risque élevé, contrats bloquants, circuits de fusion (décision 72)"
git push origin governance/mandat-ar-department-contracts-20261116
gh pr checks <N> -R $R   # attendu : 🛡️ Deterministic gates vert
```

| Patch | Effet |
|---|---|
| `01-codeowners.patch` | Ajoute les zones de la décision 72 : paiements, prix et stock, panier et commande, migrations, déploiement PROD, sécurité, gouvernance. L'en-tête cite la décision 72 à la place d'ADR-015. |
| `02-ci-contrats-departement.patch` | Le job requis `🛡️ ADR-010 Governance` lance `validate-agent-operating-map.js --contracts` et `--self-test`, puis les tests du classeur. Un contrat incomplet bloque toute PR. |
| `03-skills-canon-gate-fixture.patch` | Ajoute la nouvelle fixture aux filtres de chemin et retire le texte « vault ADR required ». |
| `04-merge-circuits-workflow.patch` | Nouveau workflow `🚦 Circuit de fusion`. Il calcule le circuit et pose le label. En circuit moyen, il lance la revue Claude en lecture seule (décision 91) ; en circuit élevé, il exige l'approbation de l'owner sur la tête. Il arme l'auto-fusion seulement en circuit faible, ou en moyen avec un verdict GO. |

## 3. Labels

```bash
gh label create "circuit:faible" -R $R --color 0E8A16 --description "Décision 72 : CI verte, puis fusion automatique"
gh label create "circuit:moyen"  -R $R --color FBCA04 --description "Décision 72 : CI verte et verdict GO de la revue Claude, puis fusion automatique"
gh label create "circuit:eleve"  -R $R --color B60205 --description "Décision 72 : approbation de l'owner"
```

## 4. Relecteur du circuit moyen : revue Claude (décision 91)

> **Correction AR-5 (2026-11-16) : la décision 91 reposait sur un secret absent.** Le relevé de
> l'owner (`gh secret list`, 19:38 UTC) montre que `ANTHROPIC_API_KEY` n'existe pas dans le dépôt.
> Le secret présent est `CLAUDE_CODE_OAUTH_TOKEN`. La variable `CLAUDE_REVIEW_ENABLED` n'existe pas
> non plus : la revue Dependabot n'a jamais tourné, ses runs sont `skipped`. Ce paragraphe
> présumait le secret posé ; c'était faux. En l'état, le job `🤖 Revue Claude (circuit moyen)` ne peut rendre
> aucun verdict, et toute PR du circuit moyen reste en HOLD. Le geste à faire est au §14 : appliquer
> un patch d'authentification, sans créer de secret.

La variable `CODEX_REVIEWER_LOGIN` n'est plus nécessaire : ne pas la créer.

Le patch 04 ajoute au workflow `🚦 Circuit de fusion` le job `🤖 Revue Claude (circuit moyen)`. Il
reprend l'action `anthropics/claude-code-action@v1` de `dependabot-claude-review.yml`, sans nouvelle
App. Son authentification par `ANTHROPIC_API_KEY` est remplacée au §14. Ce job :
- ne tourne que pour une PR classée moyen, du dépôt (jamais un fork), hors brouillon ;
- relit seulement : son jeton est en lecture (`contents: read`, `pull-requests: read`), les outils
  d'écriture sont interdits, et le code de la PR n'est jamais extrait (le diff vient de l'API) ;
- rend un verdict GO ou HOLD, au format JSON imposé (`--json-schema`). Une panne, un format
  invalide ou une absence de verdict donnent HOLD.

Le job du circuit lit ce verdict comme sortie de job du même run, lié à la tête de l'événement, puis
le poste sur la PR dans un commentaire unique, mis à jour à chaque passage. Il ne lit jamais un
commentaire pour décider : un verdict ne peut donc pas être forgé ni repris d'une tête précédente.

Pour vérifier que le secret est posé, sans l'afficher : `gh secret list -R $R | grep CLAUDE_CODE_OAUTH_TOKEN`.

Points à connaître :
- Modèle : `claude-opus-5-5`, dès le départ (décision 98). La revue Dependabot garde
  `claude-haiku-4-5-20251001`.
- `allowed_bots: "automecanik-agents[bot]"` : les PR des agents sont ouvertes par cette App (27 des
  30 dernières PR). Sans cette ligne, l'action refuserait de tourner sur elles.
- Chaque nouvelle tête d'une PR moyenne relance une revue, et un avis d'un humain sur la PR aussi.
  Chaque passage consomme le quota du compte qui porte `CLAUDE_CODE_OAUTH_TOKEN`, ou, avec le
  patch 06b et sans jeton, la facturation de `ANTHROPIC_API_KEY`.
- Ne jamais rendre requis le check `🤖 Revue Claude (circuit moyen)` : il est sauté hors du circuit
  moyen. Seul `🚦 Circuit de fusion` devient requis.

## 5. GitHub App de fusion

Une fusion armée avec `GITHUB_TOKEN` ne déclenche pas `ci.yml` sur `main`, ce qui coupe la chaîne
PREPROD. L'auto-fusion doit donc être armée par une App.

1. Créer l'App sur github.com, dans *Settings → Developer settings → GitHub Apps*, avec les
   permissions de dépôt *Contents : read and write* et *Pull requests : read and write*, sans webhook.
   L'installer sur ce seul dépôt.
2. Poser les secrets sans les afficher :

```bash
gh secret set MERGE_CIRCUIT_APP_ID -R $R --body "<App ID>"
gh secret set MERGE_CIRCUIT_APP_PRIVATE_KEY -R $R < <chemin de la clé .pem>
```

Si ces secrets sont absents, le workflow calcule, étiquette et vérifie, mais n'arme rien. Il le
signale par un avis dans le run.

## 6. Protection de `main`

Lire d'abord la protection actuelle. Elle n'est pas lisible depuis la machine DEV, donc son contenu
est inconnu de l'agent. Garder la copie comme point de retour :

```bash
gh api repos/$R/branches/main/protection > protection-main-avant.json
```

Construire la nouvelle protection à partir de l'actuelle. On ajoute les checks stables, et la revue
CODEOWNERS devient obligatoire avec 0 approbation générale : seules les zones CODEOWNERS exigent
l'owner. Le reste est conservé tel quel :

```bash
jq '{
  required_status_checks: {
    strict: .required_status_checks.strict,
    contexts: ((.required_status_checks.contexts + [
      "🛡️ Contract Gate",
      "Block-new (owner + domain required)",
      "🕸️ No new deep PR-stacks",
      "Block forbidden DEV/PREPROD/PROD formulations in .md",
      "Refuser SEO_CHAIN_R*_MODE=on dans la config"
    ]) | unique)
  },
  enforce_admins: .enforce_admins.enabled,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: true,
    required_approving_review_count: 0
  },
  restrictions: (if .restrictions then {
    users: [.restrictions.users[].login],
    teams: [.restrictions.teams[].slug],
    apps:  [.restrictions.apps[].slug]
  } else null end),
  required_linear_history: .required_linear_history.enabled,
  allow_force_pushes: .allow_force_pushes.enabled,
  allow_deletions: .allow_deletions.enabled,
  required_conversation_resolution: (.required_conversation_resolution.enabled // false)
}' protection-main-avant.json > protection-main-apres.json

diff <(jq -S . protection-main-avant.json) <(jq -S . protection-main-apres.json)   # relire
gh api -X PUT repos/$R/branches/main/protection --input protection-main-apres.json
```

Après le §7 seulement, ajouter le check des circuits sans toucher au reste :

```bash
gh api -X POST repos/$R/branches/main/protection/required_status_checks/contexts \
  -f 'contexts[]=🚦 Circuit de fusion'
```

Retour arrière : `gh api -X PUT repos/$R/branches/main/protection --input` suivi d'un fichier au
format d'entrée, reconstruit de `protection-main-avant.json` par la même commande `jq`, sans les ajouts.

Points à connaître :
- `🔍 CWV Performance Check` est stable, mais il dépend d'un service externe. Il n'est pas inclus.
  À ajouter par la même commande `contexts` si l'owner le veut bloquant.
- Ne jamais rendre requis un check à filtre de chemin. Sur une PR hors de son périmètre, il reste
  « Expected » et bloque la PR à tort.
- Une PR ouverte par le compte `ak125` ne peut pas être approuvée par ce même compte. Dans une zone
  CODEOWNERS, elle se fusionne alors par le droit d'administration, si `enforce_admins` est faux.

## 7. PR de test du check `🚦 Circuit de fusion` (inconnue ouverte)

Les déclencheurs `pull_request_target` et `pull_request_review` rattachent leur check au commit
de la PR selon les règles de GitHub. Cela n'a pas été vérifié sur ce dépôt. Avant de rendre le
check requis :

1. Ouvrir une PR qui ne touche qu'un fichier `docs/` (circuit faible attendu).
2. Ouvrir une PR qui touche `backend/src/modules/seo/` (circuit élevé attendu, risque `high`).
3. Vérifier que le check apparaît sur le SHA de tête de chaque PR :
   `gh api repos/$R/commits/<sha>/check-runs --jq '.check_runs[] | select(.name=="🚦 Circuit de fusion") | {conclusion, head_sha}'`.
   Vérifier aussi que le label posé est le bon.
4. Sur la PR élevée, approuver depuis `ak125`, puis vérifier que le check est relancé et passe au vert.
5. Ouvrir une PR du circuit moyen (un fichier à risque `medium` de `ownership.yaml`). Vérifier :
   - que `🤖 Revue Claude (circuit moyen)` tourne et que le commentaire de verdict apparaît, avec le SHA de tête ;
   - qu'aucune écriture n'a eu lieu dans la branche : `git log` inchangé ;
   - que `🚦 Circuit de fusion` suit le verdict (vert sur GO, rouge sur HOLD).

## 8. Ruleset des tags `v*` (déploiement PROD)

Seul un administrateur du dépôt peut créer, déplacer ou supprimer un tag `v*`. Aujourd'hui, aucun
ruleset de tags n'existe :

```bash
gh api -X POST repos/$R/rulesets --input - <<'EOF'
{
  "name": "Tags v* réservés à l'owner (déploiement PROD)",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [ { "type": "creation" }, { "type": "update" }, { "type": "deletion" } ],
  "bypass_actors": [ { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" } ]
}
EOF
```

`actor_id: 5` désigne le rôle *Admin* du dépôt.

## 9. Texte proposé pour `CLAUDE.md` §Gouvernance (fichier CODEOWNERS)

> **Remplacé par le patch 05 du complément AR-4** (§12 ; `patches/05-claude-md.patch`). Le texte ci-dessous reste comme trace.

À remplacer, en remplissant les numéros des PR une fois connus, après la fusion de cette PR et de
celle du §2 :

```markdown
## Gouvernance

- Le monorepo est la seule source (décision 72). En vigueur = fusionné sur `main` :
  `.claude/governance/journal-des-principes.md`, contrats de département
  `.spec/00-canon/ai-registry/agent-operating-map.yaml` (vérifiés par schéma en CI).
- Fusion : trois circuits (`scripts/ci/merge-circuit.mjs`, workflow `🚦 Circuit de fusion`).
  Un agent ne fusionne jamais et n'arme jamais l'auto-fusion.
- `ak125/governance-vault` = archive en lecture seule après déplacement (décision 73).
  Une ADR du vault explique une décision ; elle n'est plus normative par elle-même.
```

La phrase « Vault séparé… Changement vault = PR signée, fusion humaine » sort de la section.

## 10. Migrations

Cette PR ne contient aucune migration. Le workflow « Apply Supabase migrations (manual) » n'est pas
concerné.

---

# Complément AR-4 (2026-11-16) — actes réservés à l'owner

Aucune de ces commandes n'a été lancée par l'agent.

**Poste de l'owner : PowerShell 32 bits.** Le client SSH s'appelle par
`C:\WINDOWS\Sysnative\OpenSSH\ssh.exe`, sinon la redirection WOW64 masque `System32\OpenSSH`. Les
commandes s'exécutent une par ligne : pas de `&&`, pas de glob. `$DEV` désigne le compte de
déploiement de la machine DEV (`deploy@<hôte DEV>`). Son adresse n'est pas écrite ici, car le dépôt
est public. Les commandes `gh` se lancent sur le poste, avec `gh` authentifié sur `ak125`
(`gh auth status`).

```powershell
$SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
$DEV = "deploy@<hôte DEV>"
```

## Ordre AR-4

1. Signature, puis fusion de la PR vault ak125/governance-vault#422 (§11). ADR-138 entre ainsi sur
   `main` du vault.
2. Application du patch 05 sur la branche de la PR monorepo #2107 (§12), puis fusion de #2107.
3. Politique `pull_request_target` (§13), **avant le 2 décembre 2026**. Cet acte est indépendant
   des deux autres.
4. Authentification de la revue Claude (§14, complément AR-5) : un patch par workflow, sur la même
   branche que le patch 05, **avant** la fusion de #2107.

## 11. PR vault #422 : signature et fusion

Le commit `6bd49dda2f4153509db57b9a021ec00ed53b4bbe` n'est pas signé. Le check de signature (G3)
reste rouge jusqu'à la signature. On signe sur DEV, dans un worktree du checkout du vault, qui
hérite de la configuration de signature SSH (`gpg.format=ssh`, `user.signingkey`) :

```powershell
& $SSH $DEV "git -C /opt/automecanik/governance-vault fetch -q origin"
& $SSH $DEV "git -C /opt/automecanik/governance-vault worktree add /tmp/owner-adr138 docs/adr-138-sortie-vault-20261116"
& $SSH $DEV "git -C /tmp/owner-adr138 reset --hard origin/docs/adr-138-sortie-vault-20261116"
& $SSH $DEV "git -C /tmp/owner-adr138 commit --amend -S --no-edit"
& $SSH $DEV "git -C /tmp/owner-adr138 log --show-signature -1"
& $SSH $DEV "git -C /tmp/owner-adr138 push --force-with-lease=docs/adr-138-sortie-vault-20261116:6bd49dda2f4153509db57b9a021ec00ed53b4bbe origin HEAD:docs/adr-138-sortie-vault-20261116"
& $SSH $DEV "git -C /opt/automecanik/governance-vault worktree remove /tmp/owner-adr138"
```

- La 5ᵉ ligne doit afficher `Good "git" signature`. Sinon, ne pas pousser : voir le playbook
  « Signature absente ou non vérifiée » du skill `governance-vault-ops`.
- ADR-138 porte `status: accepted`. Sa fusion par l'owner, sur une tête signée, vaut ratification
  (ADR-121 D7). Pour le circuit en deux temps d'ADR-137, passer `status` à `proposed` avant la
  4ᵉ ligne (voir le corps de la PR).

Puis, sur le poste, attendre la CI, relire la tête et fusionner sur ce SHA exact :

```powershell
gh pr checks 422 --repo ak125/governance-vault
gh pr view 422 --repo ak125/governance-vault --json headRefOid --jq .headRefOid
gh pr merge 422 --repo ak125/governance-vault --squash --match-head-commit <sha40 de la ligne précédente>
```

Après la fusion, `canon-publish.yml` diffuse l'AEC 1.3.0 : une PR `canon-sync/auto` dans le monorepo
et une PR de copie dans WIKI et dans RAW. Les verdicts proposés pour les ADR `deferred` et les PR
ouvertes du vault, dans le corps de #422, restent à trancher. Aucune commande n'est donnée pour eux.

## 12. Patch 05 : `CLAUDE.md` (fichier réservé), puis fusion de #2107

`patches/05-claude-md.patch` réécrit la ligne 4-5 et le §Gouvernance. Il remplace le texte proposé au
§9 : ADR-138, numéros de PR réels, trois circuits, vault en archive.

- sha256 : `7b1511ddef0b4fc3f5b0b2bb79b8b6e905f52fb4ded99b98b53528da45e2bf04`.
- `git apply --check` passe sur `origin/main` `f9e288348`. `CLAUDE.md` y est identique à la base de
  la PR.
- `validate-agents-md.sh --file <CLAUDE.md patché>` : PASS, 0 avertissement. En type forcé
  `agents-md`, le fichier patché et l'original donnent le même BLOCK structurel (« section rôle
  absente ») : le patch n'ajoute rien.

On l'applique sur la branche de la PR, dans un worktree détaché de DEV, car la branche est déjà prise
par le worktree de l'agent :

```powershell
& $SSH $DEV "git -C /opt/automecanik/app fetch -q origin governance/mandat-ar4-sortie-adr-20261116"
& $SSH $DEV "git -C /opt/automecanik/app worktree add --detach /tmp/owner-ar4 origin/governance/mandat-ar4-sortie-adr-20261116"
& $SSH $DEV "sha256sum /tmp/owner-ar4/docs/audit/mandat-ar-20261116/patches/05-claude-md.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply --check docs/audit/mandat-ar-20261116/patches/05-claude-md.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply docs/audit/mandat-ar-20261116/patches/05-claude-md.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 commit -m 'docs(claude-md): gouvernance dans le monorepo, vault en archive (décisions 72 et 73, patch 05 du mandat AR-4)' -- CLAUDE.md"
& $SSH $DEV "git -C /tmp/owner-ar4 push origin HEAD:governance/mandat-ar4-sortie-adr-20261116"
& $SSH $DEV "git -C /opt/automecanik/app worktree remove /tmp/owner-ar4"
```

- La 3ᵉ ligne doit afficher l'empreinte ci-dessus. Sinon, s'arrêter.
- Le hook `.husky/pre-commit` lance `validate-agents-md.sh` sur `CLAUDE.md` : PASS attendu.

Puis, sur le poste (circuit élevé : approbation ou droit d'administration de l'owner) :

```powershell
gh pr checks 2107 --repo ak125/nestjs-remix-monorepo
gh pr view 2107 --repo ak125/nestjs-remix-monorepo --json headRefOid --jq .headRefOid
gh pr merge 2107 --repo ak125/nestjs-remix-monorepo --squash --match-head-commit <sha40 de la ligne précédente>
```

## 13. Politique d'exécution `pull_request_target` (avant le 2 décembre 2026)

À partir du 2 décembre 2026, GitHub bloque par défaut `pull_request_target` dans les dépôts publics
qui n'ont pas de politique d'événements Actions l'autorisant. La coupure d'essai du 16 novembre
(16:00-18:00 UTC) l'a montré sur ce dépôt : le run `43922321880` (`🚦 Circuit de fusion`,
`.github/workflows/merge-circuits.yml`, événement `pull_request_target`, créé à 17:49:03 UTC) est
en `startup_failure`.

Sources (doc lue le 2026-11-16) :

- <https://github.blog/changelog/2026-11-02-pull_request_target-blocked-by-default-december-2>
- <https://docs.github.com/actions/how-tos/administer/control-workflow-execution> (« Governing
  execution of GitHub Actions workflows »)
- <https://docs.github.com/en/rest/actions/policies>

**Fichiers concernés.** Trois workflows du dépôt déclarent `pull_request_target` :

| Workflow | Rôle | Dans la politique ci-dessous |
|---|---|---|
| `.github/workflows/merge-circuits.yml` | check `🚦 Circuit de fusion` | oui |
| `.github/workflows/dependabot-claude-review.yml` | revue Claude des PR Dependabot | oui |
| `.github/workflows/dependabot-auto-merge.yml` | check `auto-merge` des PR Dependabot | **non** : le pilotage n'a cité que les deux premiers |

Sans politique qui l'inclut, `dependabot-auto-merge.yml` ne démarrera plus à partir du 2 décembre.
L'ajouter ou non à `include` est une décision de l'owner. La politique reste ciblée par fichier, et
aucun autre workflow ne reçoit l'événement.

**Par l'interface.** Settings du dépôt > Actions > Policies > nouvelle politique :

- cible : chemins de workflow `.github/workflows/merge-circuits.yml` et
  `.github/workflows/dependabot-claude-review.yml` ;
- règle : événements autorisés, `pull_request_target` ;
- statut : « Active ».

**Par l'API**, sur le poste, avec un fichier pour éviter l'échappement du JSON par PowerShell :

```powershell
$P = "$env:TEMP\policy-prt.json"
Set-Content -Path $P -Encoding ascii -Value '{"name":"allow-pull_request_target-specific-workflows","enforcement":"active","conditions":{"workflow_path":{"include":[".github/workflows/merge-circuits.yml",".github/workflows/dependabot-claude-review.yml"],"exclude":[]}},"rules":[{"type":"restrict_action_events","parameters":{"allowed_events":["pull_request_target"]}}]}'
gh api --method POST repos/ak125/nestjs-remix-monorepo/actions/policies -H "X-GitHub-Api-Version: 2026-03-10" --input $P
gh api repos/ak125/nestjs-remix-monorepo/actions/policies -H "X-GitHub-Api-Version: 2026-03-10"
```

**Vérification.**

1. Le `GET` (4ᵉ ligne) liste la politique, avec `enforcement: active` et les deux chemins.
2. Settings > Actions > Policies > « Policy insights » : les deux workflows y sont autorisés.
3. À la prochaine PR, `🚦 Circuit de fusion` démarre (pas de `startup_failure`) :
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --limit 3`.

**Réserves.** Cette doc ne précise pas :

- la syntaxe des globs (d'où les chemins exacts) ;
- les droits exacts du jeton : il faut un compte administrateur du dépôt. L'identité `gh` de DEV ne
  convient pas ;
- le cas d'un dépôt de compte personnel ;
- les intitulés exacts de l'interface.

Si le `POST` répond 404 ou 422, passer par l'interface et vérifier par « Policy insights ».

## 14. Authentification de la revue Claude (complément AR-5)

### Constat

| Fait | Preuve |
|---|---|
| `ANTHROPIC_API_KEY` et `CLAUDE_REVIEW_ENABLED` n'existent pas dans le dépôt. Le secret présent est `CLAUDE_CODE_OAUTH_TOKEN`. | relevé de l'owner, `gh secret list`, 2026-11-16 19:38 UTC (noms seulement) |
| `merge-circuits.yml:136` et `dependabot-claude-review.yml:73` passent `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`, donc une chaîne vide. | `origin/main` `f9e288348` |
| Sans aucune authentification, l'action échoue. L'étape est `continue-on-error`, et le verdict lu est HOLD. Le circuit moyen ne peut donc jamais passer en GO : la panne reste fermée, mais le circuit est inutilisable. | `base-action/src/validate-env.ts` ; `merge-circuits.yml:176-192` |
| Entrées d'authentification de `anthropics/claude-code-action@v1` : `anthropic_api_key`, `claude_code_oauth_token`, fédération d'identité (`anthropic_federation_rule_id` + `anthropic_organization_id`, OIDC), `use_bedrock`, `use_vertex`, `use_foundry`. | `action.yml` au tag `v1` (commit `d1f58ad5e6f4d2b79547e63e37c2116064135896`), l.70-106 et 338-350 |
| Si deux entrées sont fournies, l'action ne choisit pas : elle passe `ANTHROPIC_API_KEY` et `CLAUDE_CODE_OAUTH_TOKEN` à la CLI. C'est la CLI qui choisit : la clé API (rang 3) passe avant le jeton OAuth (rang 5). La fédération n'est utilisée que si aucun des deux n'est fourni. | `action.yml` l.339-340 ; `base-action/src/workload-identity.ts:117-133` ; <https://code.claude.com/docs/en/authentication> § « Authentication precedence » |
| `pilote-file.yml` transmet les deux secrets à `scripts/ops/pilote-file.sh`. Celui-ci prend le jeton d'abord, la clé à défaut, et n'en donne qu'un à la CLI (l.154-160). | fichiers sur `origin/main` |
| Les 12 runs de `pilote-file` du 2026-11-16 (08:22 à 19:06 UTC, du run `43830653425` au run `43935848060`) sont `success`, et le jeton y est bien présent (masqué `***`). Mais **aucun n'a ouvert de session Claude** : chacun s'arrête sur « session suspendue : producteur du KPI … absent (ADR-128 D2) ». | journaux des runs |

**Conséquence.** Le jeton existe, mais aucun run n'a encore prouvé qu'il authentifie la CLI. La
première preuve sera le premier run de `🤖 Revue Claude (circuit moyen)` après application du patch.

L'action ne fournit pas de repli propre. Fournir les deux secrets ne crée pas un repli vers la clé :
la clé deviendrait la source principale dès qu'elle existerait. Un repli ne s'obtient que par une
expression dans le workflow. D'où deux variantes par fichier, au choix de l'owner.

### Variantes (fichiers `.github/` réservés : patches seulement)

| Patch | Fichier | Effet | sha256 |
|---|---|---|---|
| **06a** (recommandé) | `merge-circuits.yml` | `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` seul ; en-tête corrigé | `1680aee93f9235f4666b4fb9dcd7de882d1dfbffac8a547cce544b2c188786c6` |
| 06b | `merge-circuits.yml` | jeton d'abord ; clé transmise seulement si le jeton est vide (`secrets.CLAUDE_CODE_OAUTH_TOKEN == '' && secrets.ANTHROPIC_API_KEY \|\| ''`) ; source affichée par son nom dans le résumé du run | `726a75fd9ed6e4602ed16cbe9a985ad5ebdcf617414b166254cfe59cfc3f9478` |
| **07a** (recommandé) | `dependabot-claude-review.yml` | même changement que 06a | `3604cf4faf65cf2b8ed59345b8614f6c788bdd20106f9a4b455f37cf1caaa80d` |
| 07b | `dependabot-claude-review.yml` | même changement que 06b, plus une étape « Source d'authentification » dans le résumé | `9a0362edd2a8754c7a90636370455192374edf804139c152307aef5e1e2b8079` |

Les quatre passent `git apply --check` sur `origin/main` `f9e288348`. Le YAML résultant se charge
sans erreur (`yaml.safe_load`). `actionlint` n'est pas installé sur DEV : il n'a pas tourné.

**Pourquoi recommander 06a et 07a.** Ils utilisent un seul secret, celui qui existe, sans valeur
implicite. Une panne donne déjà HOLD, donc le repli n'apporte aucune sécurité, seulement de la
disponibilité. Il ne sert que si l'owner crée un jour `ANTHROPIC_API_KEY`, ce qu'aucune décision ne
prévoit. 06b et 07b restent conformes à l'invariant 3 : le repli y est observable par le nom de la
source.

Utiliser la clé API seule reviendrait au fichier actuel, plus la création du secret
`ANTHROPIC_API_KEY` par l'owner. Aucun patch n'est nécessaire pour cette option.

### Commandes (poste, PowerShell 32 bits)

À faire dans le même worktree et le même push que le §12, entre la ligne `commit` et la ligne
`push`. Exemple pour 06a et 07a :

```powershell
& $SSH $DEV "sha256sum /tmp/owner-ar4/docs/audit/mandat-ar-20261116/patches/06a-merge-circuits-oauth.patch /tmp/owner-ar4/docs/audit/mandat-ar-20261116/patches/07a-dependabot-review-oauth.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply --check docs/audit/mandat-ar-20261116/patches/06a-merge-circuits-oauth.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply docs/audit/mandat-ar-20261116/patches/06a-merge-circuits-oauth.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply --check docs/audit/mandat-ar-20261116/patches/07a-dependabot-review-oauth.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply docs/audit/mandat-ar-20261116/patches/07a-dependabot-review-oauth.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 commit -m 'fix(ci): revue Claude authentifiée par CLAUDE_CODE_OAUTH_TOKEN (mandat AR-5, patches 06a et 07a)' -- .github/workflows/merge-circuits.yml .github/workflows/dependabot-claude-review.yml"
```

Pour 06b et 07b, remplacer les noms de fichiers par `06b-merge-circuits-oauth-repli-cle.patch` et
`07b-dependabot-review-oauth-repli-cle.patch`. Ne pas mélanger 06a et 06b : ils touchent les mêmes
lignes.

Vérification après fusion, sans afficher de valeur :

```powershell
gh secret list -R ak125/nestjs-remix-monorepo
gh run list -R ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --limit 5
```

À la première PR classée moyen, le job `🤖 Revue Claude (circuit moyen)` doit finir avec un verdict
GO ou HOLD motivé, et non « Revue Claude sans verdict exploitable ». Avec 06b, le résumé du run
affiche « authentification : CLAUDE_CODE_OAUTH_TOKEN ».

### Restes et inconnues

- `CLAUDE_REVIEW_ENABLED` : même avec 07a ou 07b, la revue Dependabot ne tourne que si l'owner crée
  la variable (`gh variable set CLAUDE_REVIEW_ENABLED --body true -R ak125/nestjs-remix-monorepo`),
  de préférence avec `CLAUDE_REVIEW_DRY_RUN` à `true` d'abord. C'est une décision de l'owner : ce
  workflow peut approuver et armer l'auto-fusion d'une PR Dependabot.
- **Non vérifié** : quels secrets reçoit un run `pull_request_target` déclenché par Dependabot,
  secrets Actions ou secrets Dependabot. La doc GitHub n'a pas pu être lue dans cette session (accès
  web refusé). Si le premier run de la revue Dependabot échoue faute d'authentification, il faudra
  aussi poser le secret côté Dependabot (`gh secret set CLAUDE_CODE_OAUTH_TOKEN --app dependabot`).
  La valeur se saisit au clavier, jamais en argument.
- `MERGE_CIRCUIT_APP_ID` est absent du même relevé : c'est attendu, la GitHub App du §5 n'est pas
  encore posée. Sans elle, le circuit ne peut pas armer l'auto-fusion.
- Le jeton OAuth est lié à un abonnement. La consommation des revues va sur le quota de ce compte,
  sans plafond par run comme le `--max-budget-usd` de `pilote-file`.
