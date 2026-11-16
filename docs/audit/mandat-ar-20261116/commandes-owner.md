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
3. Labels (§3), puis App, environnement, variable et secret (§15, qui remplace le §5). Le §4 n'appelle plus aucun geste (décision 91). Rien ne fusionne tant que l'App n'est pas posée.
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
  Chaque passage consomme le quota de l'abonnement qui porte `CLAUDE_CODE_OAUTH_TOKEN`
  (décision 105).
- Ne jamais rendre requis le check `🤖 Revue Claude (circuit moyen)` : il est sauté hors du circuit
  moyen. Seul `🚦 Circuit de fusion` devient requis.

## 5. GitHub App de fusion

> **Remplacé par le §15 (mandat AR-6, 2026-11-16).** La conception retenue est une seule App,
> `automecanik-actions`, pour trois workflows. Sa clé est stockée une seule fois, dans
> l'environnement `app-actions`. Ne pas créer `MERGE_CIRCUIT_APP_ID` ni
> `MERGE_CIRCUIT_APP_PRIVATE_KEY`. Le texte ci-dessous reste comme trace.

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
4. Authentification de la revue Claude (§14, complément AR-5 ; décision 105) : patches 06a et 07a,
   sur la même branche que le patch 05, **avant** la fusion de #2107.
5. App `automecanik-actions` (§15, complément AR-6) : environnement, App, variable et secret depuis
   le poste, **avant** les patches 08 et 09 ; puis ces patches, sur la même branche, après 06a.

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

> **Correction AR-7 (2026-11-16).** Le texte précédent annonçait une PR de copie automatique dans
> WIKI et dans RAW. C'était inexact. `canon-publish.yml` du vault émet seulement l'événement
> `canon-updated` (AEC, §« Distribution canonique », point 3). Dans le monorepo, `canon-sync.yml`
> ouvre la PR `canon-sync/auto` (#2108). Dans WIKI et dans RAW, `agent-exit-contract-hash.yml`
> vérifie seulement (point 5) et passe au rouge. Aucun automate n'y ouvre de PR. La procédure est
> celle du point 4 : une PR ordinaire de copie, ouverte par un agent et fusionnée par l'owner, comme
> pour la 1.2.0 (WIKI #133, RAW #77). Pour la 1.3.0, ce sont WIKI #138 et RAW #80, fusionnées par
> l'owner le 2026-11-16 à 21:05 UTC.

Après la fusion, `canon-publish.yml` émet `canon-updated`. Le monorepo reçoit la PR
`canon-sync/auto` ; WIKI et RAW attendent chacun une PR de copie ouverte par un agent. Les verdicts proposés pour les ADR `deferred` et les PR
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

> **Correction AR-7 (2026-11-16).** Le jeton GitHub du DEV ne peut pas pousser un commit qui
> modifie un fichier de `.github/workflows/`. Or les §14 et §15 demandaient d'ajouter 06a, 07a, 08
> et 09 au même push : la suite de commandes ci-dessous échouait donc à la ligne `push`. Marwane a
> appliqué et poussé 05, 06a, 07a, 08 et 09 depuis son PC ; #2107 a été fusionnée le 2026-11-16 à
> 20:52:06 UTC (`32d1930f1`). Ces commandes sont gardées pour mémoire et ne sont plus à lancer.
> Pour un futur patch qui touche `.github/workflows/`, appliquer, committer et pousser depuis le
> poste, dans un clone local à jour ; le DEV ne sert qu'à préparer le patch.

On l'applique sur la branche de la PR, dans un worktree détaché de DEV, car la branche est déjà prise
par le worktree de l'agent (texte d'origine, **non exécutable tel quel** : voir la correction
ci-dessus) :

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

> **Correction AR-8 (2026-11-16).** La version précédente de cette section ciblait
> `merge-circuits.yml` avec la seule liste `allowed_events = [pull_request_target]`. Or une règle
> d'événements est une **liste blanche** pour les workflows qu'elle cible. Elle aurait donc bloqué
> les runs `pull_request_review` de `merge-circuits.yml`, et l'approbation de l'owner n'aurait plus
> relancé le circuit. Elle laissait aussi de côté `dependabot-auto-merge.yml`. Rien n'avait été
> appliqué. La section est réécrite ci-dessous. **Le pilotage ne fait pas faire ce réglage le
> 16 novembre.**

À partir du 2 décembre 2026, GitHub bloque par défaut `pull_request_target` dans les dépôts publics
qui n'ont pas de politique d'événements Actions l'autorisant. La coupure d'essai du 16 novembre
(16:00-18:00 UTC) l'a montré sur ce dépôt : le run `43922321880` (`🚦 Circuit de fusion`,
`.github/workflows/merge-circuits.yml`, événement `pull_request_target`, créé à 17:49:03 UTC) est
en `startup_failure`.

### Ce que dit la doc (relue le 2026-11-16)

Sources :

- [A] <https://docs.github.com/actions/how-tos/administer/control-workflow-execution>
  (« Governing execution of GitHub Actions workflows ») ;
- [B] <https://docs.github.com/en/actions/concepts/about-actions-policies> (« About Actions
  policies ») ;
- [C] <https://docs.github.com/en/rest/actions/policies> (API REST) ;
- [D] <https://github.blog/changelog/2026-11-02-pull_request_target-blocked-by-default-december-2> ;
- [E] <https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target>.

1. **Sémantique de la liste.** [B] : la politique définit « an allowlist that controls who can
   trigger GitHub Actions workflows and which events are permitted to run them ». [B] : « When
   enforced, disallowed workflow runs will fail with an error », avec l'exemple « Event
   'workflow_dispatch' is not allowed to trigger Actions workflows. Workflow file: '…' ». Pour un
   workflow ciblé, un événement absent de `allowed_events` est donc refusé, même s'il n'était
   bloqué par rien auparavant. La doc ne traite pas nommément le cas d'un workflow à deux
   événements. La liste blanche n'admet pas d'autre lecture, mais ce point reste une déduction, non
   une phrase de la doc.
2. **Schéma de l'API** [C], en-tête `X-GitHub-Api-Version: 2026-03-10` :
   - `GET` et `POST` sur `/repos/{owner}/{repo}/actions/policies` ;
   - `GET`, `PUT` et `DELETE` sur `/repos/{owner}/{repo}/actions/policies/{policy_id}` ;
   - corps : `name` (requis), `enforcement` (requis : `disabled`, `active` ou `evaluate`),
     `conditions` (au niveau d'un dépôt, seul `workflow_path` existe ; il a deux tableaux requis,
     `include` et `exclude`), puis `rules` ;
   - la règle d'événements s'écrit `{"type": "restrict_action_events", "parameters":
     {"allowed_events": [...]}}`. `pull_request_target` et `pull_request_review` font partie des
     valeurs admises.
3. **Mode d'évaluation.** [C] : « evaluate is only available with GitHub Enterprise ». [A] :
   « Evaluate (GitHub Enterprise Cloud only) ». Ce dépôt est public et appartient à un compte
   personnel (`owner.type = User`) : **aucun mode d'essai sans blocage n'est disponible ici**. Les
   « Policy insights » montrent les runs bloqués par une politique active. Le mode d'évaluation de
   [D] est celui de la politique par défaut de GitHub, pas une option du dépôt.
4. **Politique par défaut** [E] : « GitHub adds a default policy that blocks workflows triggered by
   `pull_request_target` », et elle « does not replace an applicable event policy that you have
   already configured ». [D] : aucun autre événement n'est bloqué par défaut.
5. **Non documenté** : la syntaxe exacte des globs (d'où les chemins exacts ci-dessous), le rôle ou
   les droits exigés du jeton, le cas d'un dépôt de compte personnel, l'intitulé du bouton de
   création. Il faut un compte administrateur du dépôt. L'identité `gh` du DEV ne convient pas.

### Les trois workflows ciblés et tous leurs événements

Relevé sur `main` `32d1930f1`, bloc `on:` de chaque fichier. Aucun autre workflow du dépôt ne
déclare `pull_request_target`.

| Workflow | Événements déclarés | Rôle |
|---|---|---|
| `.github/workflows/merge-circuits.yml` | `pull_request_target` (`opened`, `synchronize`, `reopened`, `ready_for_review`) ; `pull_request_review` (`submitted`, `dismissed`) | check `🚦 Circuit de fusion` ; `pull_request_review` sert au circuit élevé et au désarmement |
| `.github/workflows/dependabot-claude-review.yml` | `pull_request_target` (`opened`, `synchronize`, `reopened`) | revue Claude des PR Dependabot |
| `.github/workflows/dependabot-auto-merge.yml` | `pull_request_target` (types par défaut) | arme `gh pr merge --auto --squash` sur les PR Dependabot de la liste blanche du fichier (patch, minor de développement, GitHub Actions, trois groupes) |

**Proposition : une seule politique, trois chemins, deux événements**, `pull_request_target` et
`pull_request_review`.

- `pull_request_review` est indispensable à `merge-circuits.yml`. Les deux workflows Dependabot ne
  le déclarent pas : l'autoriser pour eux ne déclenche rien.
- Une politique unique évite une question que la doc laisse ouverte : comment deux politiques se
  combinent sur un même dépôt. [A] dit seulement qu'elles « layer with other protections ».
- **`dependabot-auto-merge.yml` est inclus pour conserver le comportement actuel.** Sans lui, ses
  runs seraient bloqués à partir du 2 décembre et les PR Dependabot de sa liste blanche ne
  s'armeraient plus en fusion automatique. L'inclure n'élargit rien : c'est le comportement de
  `main` aujourd'hui. Pour l'arrêter, il suffit de retirer ce chemin de `include` : c'est une
  décision de l'owner.

### Par l'interface

Settings du dépôt > barre latérale, **Actions** > **Policies** (section distincte de *General*),
puis créer une politique :

1. nom : `allow-pull_request_target-specific-workflows` ;
2. statut d'application : **Active** (*Evaluate* n'est pas proposé hors GitHub Enterprise) ;
3. cible : chemins de workflow, les trois chemins exacts du tableau ;
4. protections : **Restrict events** seulement, en cochant `pull_request_target` et
   `pull_request_review`. Ni *Restrict actors*, ni *Require lockfile*.

### Par l'API (poste, PowerShell 32 bits)

Un fichier évite l'échappement du JSON par PowerShell :

```powershell
$P = "$env:TEMP\policy-prt.json"
Set-Content -Path $P -Encoding ascii -Value '{"name":"allow-pull_request_target-specific-workflows","enforcement":"active","conditions":{"workflow_path":{"include":[".github/workflows/merge-circuits.yml",".github/workflows/dependabot-claude-review.yml",".github/workflows/dependabot-auto-merge.yml"],"exclude":[]}},"rules":[{"type":"restrict_action_events","parameters":{"allowed_events":["pull_request_target","pull_request_review"]}}]}'
gh api --method POST repos/ak125/nestjs-remix-monorepo/actions/policies -H "X-GitHub-Api-Version: 2026-03-10" --input $P
gh api repos/ak125/nestjs-remix-monorepo/actions/policies -H "X-GitHub-Api-Version: 2026-03-10"
```

Si le `POST` répond 404 ou 422, passer par l'interface.

### Vérification

1. Le `GET` (4ᵉ ligne) liste la politique avec `enforcement: active`, les trois chemins et les deux
   événements.
2. Settings > Actions > Policies > **Policy insights** : aucun run bloqué pour ces trois fichiers.
3. À la prochaine PR, `🚦 Circuit de fusion` démarre sur `pull_request_target`, sans
   `startup_failure` :
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --event pull_request_target --limit 3`.
4. À la prochaine revue de l'owner sur une PR, le même workflow démarre sur `pull_request_review` :
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --event pull_request_review --limit 3`.
5. À la prochaine PR Dependabot :
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow dependabot-auto-merge.yml --limit 3` et
   `gh run list --repo ak125/nestjs-remix-monorepo --workflow dependabot-claude-review.yml --limit 3`.

### Retour arrière

Mettre la politique en `disabled` (`PUT …/actions/policies/<id>` avec `{"enforcement":"disabled"}`)
ou la supprimer (`DELETE`). Avant le 2 décembre, cela revient à l'état actuel. Après le 2 décembre,
la politique par défaut de GitHub bloque de nouveau `pull_request_target`.

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
la clé deviendrait la source principale dès qu'elle existerait.

**Décision 105 de l'owner (2026-11-16, 20:42 Paris).** La revue du circuit moyen tourne sur Opus,
avec l'abonnement de l'owner, donc par `CLAUDE_CODE_OAUTH_TOKEN`. Il n'y a ni clé d'API ni repli sur
`ANTHROPIC_API_KEY`. Les variantes à repli (06b et 07b, préparées pour AR-5) sont **retirées** du
dossier. Le pilotage appelait « patch 05 » le patch de `merge-circuits.yml`. Il porte ici le
numéro 06a, parce que le numéro 05 est déjà pris par `CLAUDE.md`.

### Patches (fichiers `.github/` réservés : patches seulement)

| Patch | Fichier | Effet | sha256 |
|---|---|---|---|
| **06a** | `merge-circuits.yml` | `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` seul ; en-tête corrigé | `1680aee93f9235f4666b4fb9dcd7de882d1dfbffac8a547cce544b2c188786c6` |
| **07a** | `dependabot-claude-review.yml` | même changement, pour la revue Dependabot (même règle que la décision 105 : un seul secret, aucun repli) | `3604cf4faf65cf2b8ed59345b8614f6c788bdd20106f9a4b455f37cf1caaa80d` |

Les deux passent `git apply --check` sur `origin/main` `f9e288348`. Le YAML résultant se charge sans
erreur (`yaml.safe_load`). `actionlint` n'est pas installé sur DEV : il n'a pas tourné.

### Commandes (poste, PowerShell 32 bits)

> **Correction AR-7 (2026-11-16).** Ces commandes supposaient un push depuis le DEV (§12), qui
> échoue pour un fichier de `.github/workflows/`. 06a et 07a ont été appliqués et poussés par
> Marwane depuis son PC, et sont sur `main` (`32d1930f1`). Texte gardé pour mémoire.

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

Vérification après fusion, sans afficher de valeur :

```powershell
gh secret list -R ak125/nestjs-remix-monorepo
gh run list -R ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --limit 5
```

À la première PR classée moyen, le job `🤖 Revue Claude (circuit moyen)` doit finir avec un verdict
GO ou HOLD motivé, et non « Revue Claude sans verdict exploitable ».

### Restes et inconnues

- `CLAUDE_REVIEW_ENABLED` : même avec 07a, la revue Dependabot ne tourne que si l'owner crée
  la variable (`gh variable set CLAUDE_REVIEW_ENABLED --body true -R ak125/nestjs-remix-monorepo`),
  de préférence avec `CLAUDE_REVIEW_DRY_RUN` à `true` d'abord. C'est une décision de l'owner : ce
  workflow peut approuver et armer l'auto-fusion d'une PR Dependabot.
- **Non vérifié** : quels secrets reçoit un run `pull_request_target` déclenché par Dependabot,
  secrets Actions ou secrets Dependabot. La doc GitHub n'a pas pu être lue dans cette session (accès
  web refusé). Si le premier run de la revue Dependabot échoue faute d'authentification, il faudra
  aussi poser le secret côté Dependabot (`gh secret set CLAUDE_CODE_OAUTH_TOKEN --app dependabot`).
  La valeur se saisit au clavier, jamais en argument.
- `MERGE_CIRCUIT_APP_ID` est absent du même relevé : la GitHub App n'est pas encore créée. Sans
  elle, le circuit ne peut pas armer l'auto-fusion. Conception et gestes : §15.
- Le jeton OAuth est lié à un abonnement. La consommation des revues va sur le quota de ce compte,
  sans plafond par run comme le `--max-budget-usd` de `pilote-file`.

## 15. Une seule GitHub App pour Actions (complément AR-6)

### Constat

Relevé du pilotage (2026-11-16, 19:46 UTC) et lecture publique `gh api /apps/<slug>` par l'agent :

| Workflow | Attend | Événements | État |
|---|---|---|---|
| `.github/workflows/merge-circuits.yml` | secrets `MERGE_CIRCUIT_APP_ID`, `MERGE_CIRCUIT_APP_PRIVATE_KEY` | `pull_request_target`, `pull_request_review` | absents : rien n'est armé (avis dans le run) |
| `.github/workflows/registry-deps-self-heal.yml` | secrets `SELF_HEAL_APP_ID`, `SELF_HEAL_APP_PRIVATE_KEY` (repli PAT `SELF_HEAL_TOKEN`, absent aussi) | push `main`, `schedule`, `workflow_dispatch` | absents : runs verts, aucune PR ouverte |
| `scripts/ops/mandat-remise.yml` (inactif, hors `.github/workflows/`) | variable `MANDAT_APP_ID`, secret `MANDAT_APP_PRIVATE_KEY` de l'environnement `mandat-remise` | `issues` (label `mandat-prêt`) | absents ; environnement `mandat-remise` inexistant (seul `github-pages` existe) |

Les trois usages ont besoin des mêmes droits : pousser une branche, ouvrir une PR, armer
l'auto-fusion. Il faut donc `contents: write` et `pull_requests: write`.

| App existante | Droits | Clé | Convient ? |
|---|---|---|---|
| `automecanik-agents` | `contents: write`, `pull_requests: write`, `actions/checks/statuses: read` | sur le DEV (`/etc/automecanik/github-app/`) ; auteur de 27 des 30 dernières PR | **Non.** Toute clé de la même App crée les mêmes jetons. Une seconde clé ne sépare donc rien : un agent du DEV pourrait armer une fusion, contre P21 et ADR-102. L'identité qui écrit les PR des agents serait aussi celle qui arme leur fusion. |
| `automecanik-canon-dispatch` | `contents: write` seul, sans `pull_requests` | côté vault | **Non.** Il lui manque `pull_requests`. Elle sert la chaîne du vault, qui part en archive (décision 73). Copier sa clé dans le monorepo créerait une copie divergente. |

### Conception retenue : une App, une clé, un seul endroit

- **App `automecanik-actions`**, réservée à GitHub Actions et installée sur
  `ak125/nestjs-remix-monorepo` seulement. Droits de dépôt : *Contents* en lecture et écriture,
  *Pull requests* en lecture et écriture, *Metadata* en lecture (obligatoire). Rien d'autre :
  pas de *Workflows*, donc aucun fichier `.github/workflows/` modifiable, pas de droit de compte,
  pas de webhook.
- **Clé privée** : secret `ACTIONS_APP_PRIVATE_KEY` de l'environnement **`app-actions`**, dont la
  branche de déploiement est `main` seulement. Elle n'est stockée nulle part ailleurs : ni secret de
  dépôt, ni DEV, ni fichier conservé sur le poste.
- **Identifiant** : variable de dépôt `ACTIONS_APP_ID`. Ce n'est pas un secret, et un `if:` peut le
  lire.
- **Jeton** : chaque job crée un jeton d'installation de courte durée, borné au seul dépôt et aux
  deux droits (`owner`, `repositories`, `permission-contents`, `permission-pull-requests`).

Pourquoi une seule App plutôt que trois :

1. **Moindre privilège** : trois Apps auraient exactement les mêmes droits, puisque les trois
   usages écrivent une branche et une PR. Le privilège n'est pas réduit, il est copié trois fois.
   La seule séparation qui compte est entre le DEV, où vivent les agents, et Actions. La nouvelle
   App la réalise.
2. **Rotation** : une clé à un seul endroit, donc une rotation en un geste. Avec trois clés, il
   faudrait trois rotations, et une copie oubliée diverge.
3. **Restriction par environnement** : la restriction à `main` voulue pour `mandat-remise`
   s'applique ici aux trois workflows. Un job lancé depuis une autre branche ne reçoit pas la clé.
4. **« Un agent ne fusionne jamais »** : la clé n'existe que dans GitHub. Un agent du DEV ne peut ni
   la lire ni créer de jeton. L'armement reste un acte du workflow, conditionné au circuit.
5. **Ce qu'on perd** : l'identité par usage. Les trois workflows signent `automecanik-actions[bot]`.
   La provenance reste lisible par le run et le nom de la branche (`self-heal/…`, `mandat/…`).

### Patches et fichier modifié

| Livrable | Fichier | Changement | sha256 |
|---|---|---|---|
| `patches/08-merge-circuits-app-actions.patch` (**à appliquer après 06a**) | `.github/workflows/merge-circuits.yml` | job `circuit` : désarme, ou sort `armer=true` (plus de clé dans ce job). Nouveau job `🔐 Armement` : `environment: app-actions`, `permissions: {}`, seulement sur `pull_request_target`, avec un jeton borné, puis `gh pr merge --auto --squash --match-head-commit`. `allowed_bots` ajoute `automecanik-actions[bot]`. | `2cd6f21527264c75a8a8ca5169c9f170afb3047ec30aa40571e97708e5ec07ea` |
| `patches/09-self-heal-app-actions.patch` | `.github/workflows/registry-deps-self-heal.yml` | `environment: app-actions` sur le job ; `vars.ACTIONS_APP_ID` et `secrets.ACTIONS_APP_PRIVATE_KEY` ; jeton borné ; en-tête renvoyé ici. Le repli PAT `SELF_HEAL_TOKEN` est **inchangé**. | `3c9d8ecd26d58757f6d5f463740ea78f458b26a9736b97e252c5d5417ee910b7` |
| modifié dans la PR #2107 (fichier non réservé) | `scripts/ops/mandat-remise.yml` | `environment: app-actions` ; `vars.ACTIONS_APP_ID` et `secrets.ACTIONS_APP_PRIVATE_KEY` ; en-tête | — |

Vérification : `git apply --check` de 09 sur `origin/main` `f9e288348`, et de 08 sur `main` +
06a (08 seul, sur `main`, ne passe pas : il dépend de 06a). Le YAML résultant se charge
(`yaml.safe_load`). `actionlint` n'est pas installé sur le DEV.

Pourquoi l'armement passe dans un job séparé : un environnement restreint à `main` refuse un job
dont la référence n'est pas `main`. Or, sur `pull_request_review`, la référence est celle de la PR.
Le job `🔐 Armement` ne tourne donc que sur `pull_request_target`, dont la référence est la base
(`main`). Rien n'est perdu : seuls les circuits faible et moyen arment. Le circuit faible n'exige
rien. Pour le circuit moyen, le verdict de la revue Claude est rendu dans le même run
`pull_request_target` (job `claude-review`, sur la tête de l'événement). L'approbation de l'owner,
qui arrive par `pull_request_review`, ne sert qu'au circuit élevé, et celui-ci n'arme jamais. Un run
`pull_request_review` continue de désarmer quand il le faut.

### Gestes de l'owner, dans l'ordre (poste, PowerShell 32 bits)

> **Correction et état AR-7 / AR-8 (2026-11-16).** L'étape 6 renvoyait au push depuis le DEV du §12,
> qui échoue pour un fichier de `.github/workflows/` : 08 et 09 ont été appliqués et poussés par
> Marwane depuis son PC, et sont sur `main` (`32d1930f1`). Faits, d'après le relevé du pilotage du
> 2026-11-16 à 21:06 UTC : étape 1 (environnement `app-actions`, limité à `main`), étape 2 (App
> `automecanik-actions` : métadonnées en lecture, code et pull requests en écriture) et étape 3
> (installée sur `nestjs-remix-monorepo` seul). **Restent à Marwane : l'étape 4 (variable
> `ACTIONS_APP_ID`) et l'étape 5 (clé privée).** Tant qu'elles manquent, le job `🔐 Armement`
> n'arme rien (`ACTIONS_APP_ID` absent, voir `merge-circuits.yml`).

L'environnement doit exister **avant** l'application de 09. Un job qui cite un environnement absent
le crée sans aucune restriction.

1. **Créer l'environnement restreint à `main`** :

```powershell
gh api --method PUT repos/ak125/nestjs-remix-monorepo/environments/app-actions -F "deployment_branch_policy[protected_branches]=false" -F "deployment_branch_policy[custom_branch_policies]=true"
gh api --method POST repos/ak125/nestjs-remix-monorepo/environments/app-actions/deployment-branch-policies -f name=main -f type=branch
gh api repos/ak125/nestjs-remix-monorepo/environments/app-actions/deployment-branch-policies --jq ".branch_policies[].name"
```

   La dernière ligne doit afficher `main` seul. N'ajouter **aucun** relecteur requis : il bloquerait
   chaque run automatique.

2. **Créer l'App** sur github.com : *Settings → Developer settings → GitHub Apps → New GitHub App*.
   - *GitHub App name* : `automecanik-actions`. Le nom semble libre (`/apps/automecanik-actions`
     répond 404 à la lecture publique), mais ce n'est pas prouvé. S'il est pris, il faut un autre
     nom et ajuster `allowed_bots` dans le patch 08.
   - *Homepage URL* : `https://github.com/ak125/nestjs-remix-monorepo`.
   - *Webhook* : décocher *Active*.
   - *Repository permissions* : *Contents* = *Read and write* ; *Pull requests* = *Read and
     write* ; *Metadata* = *Read-only*, posé d'office. Tout le reste à *No access*.
   - *Organization* et *Account permissions* : aucune.
   - *Where can this GitHub App be installed?* : *Only on this account*.
   - *Create GitHub App*, puis noter l'*App ID* affiché. Ce n'est pas un secret.

3. **Installer l'App** : page de l'App → *Install App* → `ak125` → *Only select repositories* →
   `nestjs-remix-monorepo`.

4. **Poser l'identifiant** :

```powershell
gh variable set ACTIONS_APP_ID --body "<App ID>" -R ak125/nestjs-remix-monorepo
```

5. **Générer la clé et la poser, sans l'afficher.** Page de l'App → *Private keys* → *Generate a
   private key*. Le navigateur télécharge un fichier `.pem`. Remplacer `<fichier>` par son nom
   exact (pas de joker) :

```powershell
Get-Content -Raw "$HOME\Downloads\<fichier>.pem" | gh secret set ACTIONS_APP_PRIVATE_KEY --env app-actions -R ak125/nestjs-remix-monorepo
Remove-Item "$HOME\Downloads\<fichier>.pem"
gh secret list --env app-actions -R ak125/nestjs-remix-monorepo
```

   La dernière ligne doit lister `ACTIONS_APP_PRIVATE_KEY` par son nom seul. La clé ne va jamais sur
   le DEV et ne se copie nulle part ailleurs.

6. **Appliquer 08 et 09** dans le même worktree et le même push que le §12, après 06a :

```powershell
& $SSH $DEV "sha256sum /tmp/owner-ar4/docs/audit/mandat-ar-20261116/patches/08-merge-circuits-app-actions.patch /tmp/owner-ar4/docs/audit/mandat-ar-20261116/patches/09-self-heal-app-actions.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply --check docs/audit/mandat-ar-20261116/patches/08-merge-circuits-app-actions.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply docs/audit/mandat-ar-20261116/patches/08-merge-circuits-app-actions.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply --check docs/audit/mandat-ar-20261116/patches/09-self-heal-app-actions.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 apply docs/audit/mandat-ar-20261116/patches/09-self-heal-app-actions.patch"
& $SSH $DEV "git -C /tmp/owner-ar4 commit -m 'fix(ci): une seule GitHub App pour Actions, clé dans l environnement app-actions (mandat AR-6, patches 08 et 09)' -- .github/workflows/merge-circuits.yml .github/workflows/registry-deps-self-heal.yml"
```

   La 1ʳᵉ ligne doit afficher les deux empreintes du tableau. Sinon, s'arrêter.

**Ne plus créer** `MERGE_CIRCUIT_APP_ID`, `MERGE_CIRCUIT_APP_PRIVATE_KEY`, `SELF_HEAL_APP_ID`,
`SELF_HEAL_APP_PRIVATE_KEY`, `MANDAT_APP_ID`, `MANDAT_APP_PRIVATE_KEY`, ni l'environnement
`mandat-remise`. Le §5 et les gestes 3 et 4 de
`docs/plans/2026-11-15-adr128-etape2-mandat-remise.md` sont remplacés par ce paragraphe.

**Rotation** : générer une nouvelle clé (geste 5), poser le secret, puis supprimer l'ancienne clé dans
*Private keys*. Un seul endroit à mettre à jour.

### Vérification après fusion

```powershell
gh run list -R ak125/nestjs-remix-monorepo --workflow registry-deps-self-heal.yml --limit 3
gh run list -R ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --limit 5
gh api repos/ak125/nestjs-remix-monorepo/deployments --jq ".[] | select(.environment==\"app-actions\") | .ref"
```

À la première PR admise au circuit faible ou moyen, le job `🔐 Armement` doit afficher « Fusion
automatique armée sur <sha> ». Chaque passage laisse une trace de déploiement `app-actions` dans la
PR. C'est attendu.

### Restes et inconnues

- **Non vérifié** : qu'un environnement restreint à `main` accepte un job `pull_request_target`.
  L'agent n'a pas pu lire la doc GitHub dans cette session. S'il le refuse, le job `🔐 Armement`
  échoue, rouge, et rien n'est armé : l'échec est fermé. Il faudrait alors trancher entre une
  politique de branche plus large et l'abandon de l'environnement pour ce job.
- **`automecanik-agents` a déjà `contents: write`.** Avec la clé du DEV, un agent peut fusionner
  par l'API une PR dont les checks requis sont verts. Seule la protection de `main` (§6) l'en
  empêche. Le retrait de ce droit d'écriture est hors du mandat AR-6 : il casserait le push des
  branches d'agents. Signalé pour décision de l'owner. Ne jamais ajouter `automecanik-actions` ni
  `automecanik-agents` aux contournements de la protection de `main`.
- `registry-deps-self-heal.yml` arme lui-même l'auto-fusion de sa PR (`gh pr merge --auto`). Avec
  les circuits, la PR passe aussi par `🚦 Circuit de fusion`. Ce double armement n'est pas modifié
  ici (étape 6 du plan).
- `dependabot-auto-merge.yml` (contradiction 23) arme encore avec `GITHUB_TOKEN`. Il n'est pas
  raccordé à l'App : un run déclenché par Dependabot ne reçoit pas les secrets Actions, ce qui est
  à vérifier. Hors périmètre AR-6.
