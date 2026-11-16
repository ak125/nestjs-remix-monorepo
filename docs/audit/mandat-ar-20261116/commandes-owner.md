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
3. Labels, variable, App et secrets (§3 à §5). Rien ne fusionne tant que l'App n'est pas posée.
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
| `04-merge-circuits-workflow.patch` | Nouveau workflow `🚦 Circuit de fusion` : il calcule le circuit, pose le label et vérifie l'approbation exigée sur la tête. Il arme l'auto-fusion seulement en circuit faible, ou en moyen une fois approuvé. |

## 3. Labels

```bash
gh label create "circuit:faible" -R $R --color 0E8A16 --description "Décision 72 : CI verte, puis fusion automatique"
gh label create "circuit:moyen"  -R $R --color FBCA04 --description "Décision 72 : CI verte et revue Codex, puis fusion automatique"
gh label create "circuit:eleve"  -R $R --color B60205 --description "Décision 72 : approbation de l'owner"
```

## 4. Relecteur Codex (circuit moyen)

Aucune revue Codex n'existe aujourd'hui sur le dépôt : ni workflow, ni App, ni trace sur les PR.
Tant que cette variable n'est pas posée, une PR du circuit moyen garde le check rouge et ne fusionne
pas. Il n'y a aucun repli.

```bash
gh variable set CODEX_REVIEWER_LOGIN -R $R --body "<login GitHub exact de l'identité qui poste les revues Codex>"
```

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
