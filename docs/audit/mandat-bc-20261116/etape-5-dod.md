# Mandat BC, complément BC-7 — la Definition of Done passe dans le monorepo, DoD5 corrigée

Relevé du 2026-11-17. Décision 139 de l'owner (verdict D8 du tri de la décision 108) : la liste des
neuf conditions de fin de travail quitte le Vault pour le dépôt principal, « au même endroit que les
deux règles déjà déplacées », et sa condition n° 5 ne cite plus que des contrôles qui existent.

| Repère | Valeur |
|---|---|
| Session Claude Code | `951b45b6-023f-468c-9d5c-cdf25d3c1cd2` |
| Worktree | `/home/deploy/worktrees/claude-bc7-dod-monorepo-20261117` |
| Branche | `governance/mandat-bc7-dod-monorepo-20261117` |
| Base | `origin/main` = `a9bd755d6f990e152679b61d1519d3e5c1d36e2a` (2026-11-17T16:10:45Z) |
| PR | #2142, brouillon |
| Source lue | Vault, `ledger/rules/rules-engineering-definition-of-done.md`, `main` = `b2e712791bee17c192acc5d04ed2ee1bd88488f1` (2026-11-16T20:52:01Z) |

## 1. Ce qui est livré, et pourquoi dans une PR à part

Le plan rattache ce déplacement à l'étape 5 (sort des pièces du Vault). Il est livré dans une PR à
part, #2142, et non dans #2127 (étapes 4 et 5), pour trois raisons :

1. #2127 ne porte que de la documentation et deux patches destinés aux dépôts WIKI et RAW ; elle
   attend des commits signés du poste dans ces deux dépôts. Le déplacement de la DoD touche un
   fichier réservé du monorepo, du code de CI et deux fichiers de `.github`. Les réunir ferait
   attendre chaque lot sur l'autre.
2. La tête de #2127 est citée avec les empreintes de ses patches. Lui ajouter des commits oblige à
   refaire ses preuves.
3. Le retour arrière reste simple : un revert de #2142 ne défait rien des étapes 4 et 5.

| Fichier | Nature | Voie |
|---|---|---|
| `.spec/00-canon/canon-distribution/rules-engineering-definition-of-done.md` | règle déplacée, 1.4.0 | patch 14 (réservé) |
| `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/pr-dod-gate.yml` | commentaires | patch 15 (réservé) |
| `.claude/rules/security-hooks.md` | renvoi | PR #2142 |
| `scripts/ci/pr-dod-gate.mjs` | commentaires, message d'échec | PR #2142 |
| `scripts/ci/pr-dod-gate.test.mjs` | deux titres, trois tests ajoutés | PR #2142 |

## 2. Comparaison mot pour mot avec l'original

| Fichier | Lignes | Octets | sha256 |
|---|---|---|---|
| Original du Vault (1.3.0) | 413 | 23136 | `820938ef7402ed029de4185f2bbca242c5ceb1636d79d2cd7bed55f83c311e12` |
| Fichier déplacé (1.4.0) | 428 | 26995 | `9da1e3800ce2e4a3ee22f6dc99398bb6745071d129afd72a8dd773c9bf1d92b8` |

Méthode : la section DoD5 (de son titre à la ligne qui précède le séparateur `---`) est retirée des
deux fichiers, puis `diff` compare le reste. Résultat : trois lignes diffèrent, toutes de
métadonnées de version.

| Ligne | Original | Fichier déplacé |
|---|---|---|
| 5 (frontmatter) | `updated: 2026-11-07` | `updated: 2026-11-17` |
| 28 | `**Version** : 1.3.0 (… ADR-123, 2026-11-07)` | `**Version** : 1.4.0 (… ADR-123, 2026-11-07, puis DoD5 corrigée à son déplacement dans le monorepo, décision 139, 2026-11-17)` |
| dernière | `*Dernière revue : 2026-11-07 (DoD2 énoncé, point 6 et anti-pattern, ADR-123)*` | `*Dernière revue : 2026-11-17 (DoD5 : mesures existantes et « Non mesuré », décision 139 ; règle déplacée du vault vers le monorepo)*` |

**Écart déclaré à la consigne « mot pour mot, sauf DoD5 ».** Ces trois lignes ne sont pas dans
DoD5. Sans elles, deux textes différents porteraient le numéro 1.3.0, celui de l'archive et celui
du monorepo, et la date de dernière revue serait fausse. Pour revenir au mot pour mot strict :
remettre ces trois lignes, régénérer le patch 14 ; son empreinte change.

Tout le reste est identique, y compris la ligne DoD5 du modèle d'auto-évaluation
(`- [ ] DoD5 — Drift zéro: registry-fresh green, migrations atomic`), les liens `[[…]]` vers des
fichiers du Vault et le champ `related_rules`.

## 3. DoD5 : ancien et nouveau texte

| Élément | Ancien texte (Vault, 1.3.0) | Nouveau texte (monorepo, 1.4.0) |
|---|---|---|
| Énoncé | **OBLIGATOIRE** : aucune migration en attente, aucun drift entre schema canon (`audit/registry/db.json`) et état Supabase live, aucun contrat de type cassé. | **OBLIGATOIRE** : aucune migration en attente, aucun drift entre schema canon (`audit/registry/db.json`) et état Supabase live, aucun contrat de type cassé.<br>Seule une partie de cette exigence est mesurée. Les tests 1 à 4 nomment les contrôles qui tournent ; « Non mesuré » nomme ce qu'aucun contrôle ne vérifie. La case DoD5 se coche sur les tests 1 à 4, et la preuve porte les mentions de « Non mesuré ». |
| Registre (ancien test 1) | 1. **`registry-fresh.yml` vert** sur la PR (L1 inventory ↔ L2 overlay ↔ live DB cohérents). | 1. **Job « Registry freshness (warn-only, Phase 1) » vert** sur la PR (`registry-fresh.yml`). Il vérifie, sans lire la base, que les six projections committées du registre (`files.json`, `runtime.json`, `deps.json`, `db.json`, `rpc.json`, `canonical.json`) sont identiques à leur reconstruction depuis le dépôt, que l'overlay L2 est valide et que les invariants I1 à I6 tiennent. Le job est `continue-on-error: true` : le run du workflow conclut `success` même quand le job échoue ; lire la conclusion du job. Si le filtre `paths` ne déclenche pas le workflow, le test est N/A et la preuve le dit. |
| Migrations atomiques (ancien test 2) | 2. **Migrations atomiques** : si DDL, fichier unique sous `backend/supabase/migrations/YYYYMMDD_*.sql`, pas de migration manuelle hors pipeline. | 2. **Migrations atomiques** : si DDL, fichier unique sous `backend/supabase/migrations/YYYYMMDD_*.sql`, pas de migration manuelle hors pipeline. Sur la PR, le job « 🗄️ Migration Safety » de `ci.yml` passe squawk puis `apply-supabase-migration.py --lint-markers` sur les fichiers SQL ajoutés ou modifiés. L'application passe par `apply-supabase-migrations.yml`, lancé à la main avec la confirmation `APPLY`. |
| Types (ancien test 3) | 3. **Types regénérés** : si schema DB change, `@repo/database-types` regénéré et commité. | Sorti des tests, écrit comme non mesuré :<br>- **Types regénérés** : si le schéma change, `@repo/database-types` est regénéré et commité. Aucun contrôle ne le vérifie : le script `generate:types` du paquet affiche la commande à lancer à la main. |
| Registre des migrations (ancien test 4) | 4. **`mcp__supabase__list_migrations`** matche `git ls-files backend/supabase/migrations/` (pas de hand-applied non commité). | 3. **Registre des migrations conforme à git** : `migration-ledger-freshness.yml` (chaque jour à 04:30 UTC, ou lancé à la main) exécute `apply-supabase-migration.py --status --no-bootstrap --max-pending-age-days 30`, qui compare `infra.schema_migrations` aux fichiers du dépôt. La ligne `Summary` donne 0 pending, 0 drift, 0 orphan, 0 applying, 0 failed ; citer le run. Les compteurs se lisent sur cette ligne : le code de sortie n'échoue ni sur un `pending` de moins de 30 jours ni sur un `orphan`. Le run planifié mesure `main`, pas l'arbre de la PR : une migration ajoutée par la PR devient `pending` à la fusion et le reste jusqu'à son application ; la preuve le dit.<br>- **Liste des migrations de Supabase** (`mcp__supabase__list_migrations`) : aucun contrôle ne la compare à git. Le registre mesuré est `infra.schema_migrations` (test 3). |
| Objets déclarés présents en base | (absent) | 4. **Objets déclarés présents en base** : le même workflow exécute `check-ledger-catalog-ratchet.py --verify`. Un objet (relation, fonction, type, valeur d'enum) déclaré par une migration `applied` existe dans le catalogue, par nom, dans n'importe quel schéma, aux absences près de `audit/baselines/ledger-catalog-baseline.json` ; citer le run et sa ligne de résultat. |
| Non mesuré, autres points | (absent : l'énoncé les présentait comme acquis) | Aucun contrôle ne vérifie les points suivants. Ils restent exigés ; la preuve les déclare comme tels, sans les présenter comme mesurés.<br>- **`audit/registry/db.json` contre la base live** : `db.json` est produit par un scan hors ligne des migrations et de `audit/db-usage-map.json` (`scripts/registry/build-db-registry.js`). Ni `registry-fresh.yml` ni `--verify` ne le comparent à la base.<br>- **Objets créés en base hors migration, colonnes** : `--verify` part des objets déclarés par les migrations appliquées. Il ne voit ni un objet créé à la console, ni une colonne ajoutée, modifiée ou supprimée.<br>- **Nom et unicité d'un fichier de migration** : le moteur ignore, avec un avertissement et sans échec, un fichier dont le nom ne suit pas `YYYYMMDD_nom.sql` ou `YYYYMMDDHHMMSS_nom.sql`. Il identifie une migration par son nom complet : deux fichiers de même préfixe de date sont acceptés.<br>- **Audit d'usage avant un `DROP COLUMN`** : squawk lit le SQL de la migration, pas le code applicatif. |
| Anti-patterns bloquants | - Migration appliquée en prod via console Supabase sans fichier git.<br>- `DROP COLUMN` sans audit usage applicatif préalable (Q3 violation rétro).<br>- Type `any` dans `@repo/database-types` au lieu de regénérer.<br>- 2 migrations même timestamp (collision). | (quatre lignes inchangées) |
| Evidence requise | - [x] registry-fresh.yml: green<br>- [x] Migrations: &lt;list of files added&gt; ou "none"<br>- [x] Types regenerated: yes / no / N/A<br>- [x] mcp__supabase__list_migrations matches git: yes | - [x] Registry freshness (job) : green, ou N/A (workflow non déclenché)<br>- [x] Migrations: &lt;list of files added&gt; ou "none" ; Migration Safety : green<br>- [x] Migration ledger --status : &lt;run&gt;, 0 pending, 0 drift, 0 orphan, 0 applying, 0 failed<br>- [x] Ledger ↔ catalogue --verify : &lt;run&gt;, &lt;ligne de résultat&gt;<br>- [x] Types regenerated: yes / no / N/A (déclaratif, non mesuré)<br>- [x] comparaison db.json / base live : non mesurée |
| Raison | **Raison** : chaque drift L1 ↔ live = un crash futur sur deploy frais ou rebuild canonical. Le drift se compose silencieusement. Cf. ADR-058 V4 invariant : `live = canonical = git`. | **Raison** : chaque drift L1 ↔ live = un crash futur sur deploy frais ou rebuild canonical. Le drift se compose silencieusement. Cf. ADR-058 V4 invariant : `live = canonical = git`. De cet invariant, la CI mesure `canonical = git` (test 1) et, côté base, le registre des migrations et l'existence des objets déclarés (tests 3 et 4). |

Ce qui a guidé la réécriture : l'énoncé de l'exigence est gardé tel quel ; chaque test nomme le
contrôle qui le mesure ; ce qu'aucun contrôle ne mesure est sorti des tests et écrit dans
« Non mesuré ». Les quatre anti-patterns restent des interdits : aucun n'est retiré, alors que deux
d'entre eux ne sont détectés par rien (console sans fichier git, même préfixe de date). La mise en
forme de la section suit celle de l'original (liste « Evidence requise » dans un bloc `text`).

## 4. Les contrôles nommés existent et tournent

Vérifié sur `origin/main` `a9bd755d6` et sur les runs réels.

| Contrôle | Fichier | Déclenchement | Run lu |
|---|---|---|---|
| Job « Registry freshness (warn-only, Phase 1) » | `.github/workflows/registry-fresh.yml` | PR et push sur `main`, filtre `paths` ; `continue-on-error: true` ; aucun secret, ne lit pas la base | 44122779320, push `a9bd755d6`, 2026-11-17T16:10:50Z, job `success` |
| Job « 🗄️ Migration Safety » (squawk, `--lint-markers`) | `.github/workflows/ci.yml` | PR et push ; ne traite que les fichiers SQL ajoutés ou modifiés | 44122779361, `a9bd755d6`, 2026-11-17T16:10:50Z, job `success` (aucun fichier SQL changé : le contrôle s'est sauté) |
| `apply-supabase-migration.py --status --no-bootstrap --max-pending-age-days 30` | `.github/workflows/migration-ledger-freshness.yml` | chaque jour, cron `30 4 * * *`, ou à la main | 44018253438, 2026-11-17T04:35:36Z, `Summary : 354 applied, 0 pending, 0 drift, 0 orphan, 0 applying, 0 failed` |
| `check-ledger-catalog-ratchet.py --verify` | même workflow, étape suivante | idem | même run : `354 migrations applied · 99 absences · baseline 99`, « ledger et catalogue concordent (au baseline près) » |
| Application des migrations | `.github/workflows/apply-supabase-migrations.yml` | à la main, confirmation `APPLY` | 44045741137, 2026-11-17T08:19:25Z, `success`, applique `20261116_pricing_frozen_masked_dispo_zero` |

Lus dans le code :

- `scripts/ci/apply-supabase-migration.py`, `print_status` : le code de sortie vaut 1 si
  `drift + applying + failed > 0` ; « orphans are warnings only ». Le dépassement de 30 jours d'un
  `pending` échoue à part (`report_stale_pending`).
- Même fichier, `parse_local_migrations` : un nom hors format donne `[warn] skipping non-matching
  filename` et le fichier est ignoré ; l'identité d'une migration est le nom complet du fichier.
- `scripts/registry/build-db-registry.js`, en-tête : « this producer is an offline scan and does
  not know the database ».
- `packages/database-types/package.json` : `generate:types` est un `echo` de la commande à lancer.
  Aucun workflow ne contrôle la régénération (recherche dans `.github/workflows`, `scripts/ci`,
  `.husky`).

Un fait à garder en tête pour lire le test 4 : le contrôle registre ↔ catalogue est vert avec
99 absences connues, inscrites au baseline. Vert veut dire « aucune absence nouvelle », pas
« tous les objets déclarés existent ».

## 5. Lecteurs de la règle : avant, après

| Lecteur | Avant | Après | Voie |
|---|---|---|---|
| `.claude/rules/security-hooks.md:15` | « règle vault `rules-engineering-definition-of-done` » | chemin du monorepo | PR #2142 |
| `scripts/ci/pr-dod-gate.mjs:6` (en-tête) | « vault rule rules-engineering-definition-of-done, PR #299 » | chemin du monorepo | PR #2142 |
| `scripts/ci/pr-dod-gate.mjs:68` | « (vault template) » | « (rule template) » | PR #2142 |
| `scripts/ci/pr-dod-gate.mjs:218` (message d'échec affiché sur la PR) | « template in vault `rules-engineering-definition-of-done.md` » | « template in » suivi du chemin du monorepo | PR #2142 |
| `scripts/ci/pr-dod-gate.test.mjs:82` et `:102` (titres) | « the vault template » | « the rule template » | PR #2142 |
| `.github/PULL_REQUEST_TEMPLATE.md:59` | « Règle vault rules-engineering-definition-of-done ; lue par … » | chemin du monorepo ; « section contrôlée par … » | patch 15 |
| `.github/workflows/pr-dod-gate.yml:3` | « vault rule rules-engineering-definition-of-done, PR #299 » | chemin du monorepo | patch 15 |

Cherché et sans lecteur de la règle du Vault : `CLAUDE.md`, `AGENTS.md`, `agents/*/AGENTS.md`,
`workspaces/**`, `.claude/skills/**`, `.claude/canon-mirrors/` (aucun miroir de la DoD), le
manifeste `.spec/00-canon/canon-distribution/canon-hashes.json` et celui du Vault
(`99-meta/canon-hashes.json`, clés `aec` et `marketing_voice` seulement), les clones locaux de WIKI
(`a8368b6`) et de RAW (`b097ca4`). Commande, sur `origin/main` :
`git grep -n -i "definition-of-done"`, hors `docs/audit`, `audit`, `log.md`.

Laissé tel quel : `scripts/ci/pr-dod-gate.mjs:15-17`. Le commentaire parle de
`planning-worktype.yml`, un autre fichier du Vault que la garde ne lit pas ; la phrase reste vraie.

### Une seule copie fait foi : le mécanisme

La règle n'est pas inscrite au manifeste `canon-hashes.json`. Ce manifeste sert à contrôler des
copies ; la DoD n'en a aucune, et `scripts/canon/compute-canon-hashes.py` refuse un canon sans
copie déclarée. Lui créer une copie pour l'inscrire irait contre « une seule copie ».

Or, dans `.spec/00-canon/**`, un fichier que ni code ni contrôle ne lit est une prose de référence,
sans autorité (skill `governance-vault-ops`). Le test de la garde lit donc la règle. Trois tests
ajoutés à `scripts/ci/pr-dod-gate.test.mjs`, lancés par `audit.yml` (étape « 🧾 PR
Definition-of-Done gate — evaluateDoD() unit proof (BLOCKING) ») :

1. la règle a une section `## DoDn —` par identifiant que la garde exige, dans le même ordre ;
2. le modèle d'auto-évaluation de la règle porte une ligne par identifiant ;
3. le modèle de PR porte une ligne par identifiant.

Ce que ces tests ne contrôlent pas : le libellé des lignes. La ligne DoD2 du modèle de PR
(« assignee + ≥1 human approval ») diffère déjà de celle de la règle (« assignee + revue niveau
&lt;A|B|C&gt; sur la tête &lt;sha40&gt; … ») ; l'écart existait avant ce déplacement et n'est pas
corrigé ici.

**Ajout hors de la lettre du complément.** Ces trois tests ne sont pas demandés mot pour mot. Ils
sont le plus petit moyen de tenir « une seule copie fait foi » par un contrôle plutôt que par une
phrase. Pour les retirer : supprimer le dernier bloc `describe` du fichier de test et l'import de
`readFileSync`.

Preuve locale :

| État | Commande | Résultat |
|---|---|---|
| Branche, sans le patch 14 | `node --test scripts/ci/pr-dod-gate.test.mjs` | 29 réussis, 2 échecs (`ENOENT` sur le fichier de la règle), code 1 |
| Dépôt du scratchpad, fichiers de la branche puis patches 14 et 15 | même commande | 31 réussis, 0 échec, code 0 |

## 6. Patches réservés

| Patch | Fichiers | sha256 du patch | `git apply --check` |
|---|---|---|---|
| `patches/14-dod-canon-distribution-source.patch` | `.spec/00-canon/canon-distribution/rules-engineering-definition-of-done.md` (nouveau) | `40259de72cd0dbd927f439c2c9b1ca20bcfe4d50518c364507e8bb15ba530f77` | code 0 sur la branche et dans un dépôt vide |
| `patches/15-dod-lecteurs-github.patch` | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/pr-dod-gate.yml` | `102d93e21c572d102f2dd80960ddd04befaa2d73156f6c8ac3e870cf024fcaad` | code 0 sur la branche et dans un dépôt de preuve |

Construits hors du dépôt, dans un index temporaire, contre `origin/main` `a9bd755d6`. Aucun des
trois fichiers n'est écrit dans le worktree. Le fichier produit par le patch 14 a pour sha256
`9da1e380…92b8` (tableau de la section 2). Le patch 15 ne change que des commentaires : le
workflow `pr-dod-gate.yml` garde ses déclencheurs, ses permissions et ses étapes.

Le patch 14 a été régénéré une fois avant la livraison : sa première version (commit `6138e156e`,
empreinte `c6e94f8d…8d30`) avait perdu le bloc `text` de la liste « Evidence requise », ce qui
faisait disparaître `<run>` au rendu. Seule l'empreinte de ce tableau fait foi.

Après le patch 14, deux projections du registre sont à régénérer (`audit/registry/files.json`,
`canonical.json`) : par l'outil de l'owner, pas à la main. Le bloc le fait.

## 7. Limites et points laissés ouverts

1. **Passages de la règle qui décrivent le Vault.** Repris mot pour mot, ils deviennent faux à
   l'archivage : « Enforcement automatique » cite `vault-governance.yml` et
   `weekly-vault-lint.yml` ; « Escape hatch » confie l'audit des dérogations à `weekly-vault-lint`
   et demande une ligne dans `__governance_event_log`. Non vérifié : si ces deux workflows du Vault
   tournent encore, et si une dérogation a déjà été écrite dans cette table.
   Question pour Marwane : corriger ces passages comme DoD5, dans une version 1.4.1 ?
   Réponse proposée : oui, après ce lot, avec la même règle (ne nommer que ce qui tourne, écrire le
   reste comme non mesuré).
2. **`pr-dod-gate.yml` « lit cette rule »** (« Enforcement automatique », point 2) : la garde lit
   le corps de la PR, pas la règle. Avec les trois tests, la règle est lue en CI par le test de la
   garde. La phrase reste approximative ; même correction que le point 1.
3. **DoD5 mesure `main`, pas la PR**, pour les tests 3 et 4 : le workflow du registre des
   migrations est quotidien. Le nouveau texte le dit ; il ne crée aucun contrôle.
4. **Ce lot ne crée aucune mesure.** La comparaison de `db.json` avec la base live, le contrôle
   des types et celui du nom des fichiers de migration restent à construire, si Marwane les veut.
5. **PR #415 du Vault (ADR-134)** : son texte pour DoD5 a servi de point de départ, revérifié
   contre `main`. Elle se ferme avec un renvoi vers #2142 (voir `verdicts-vault.md`, #2116).

## 8. Geste du poste : un seul bloc PowerShell 32 bits

Non exécuté ici (le DEV n'a pas PowerShell). Il se lance deux fois : le premier passage pousse les
patches 14 et 15, régénère les projections, puis s'arrête parce que DoD1 n'est pas cochée ;
l'agent du DEV relit alors la CI de la tête et coche DoD1 ; le second passage sort la PR du
brouillon, attend les contrôles, demande l'approbation de Marwane et attend la fusion par l'App
(P20). Remplacer `<hote DEV>` par l'hôte du DEV.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc7-dod-monorepo-20261117"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $PS = @(
    @("14-dod-canon-distribution-source.patch", "40259de72cd0dbd927f439c2c9b1ca20bcfe4d50518c364507e8bb15ba530f77"),
    @("15-dod-lecteurs-github.patch", "102d93e21c572d102f2dd80960ddd04befaa2d73156f6c8ac3e870cf024fcaad")
  )
  $T = Join-Path $env:TEMP ("bc7-dod-" + (Get-Date -Format "yyyyMMddHHmmss"))

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2142 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $ST = (gh pr view 2142 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2142 illisible, rien n'est modifie"; return }
  if ($ST -ne "OPEN") { Write-Host ("PR 2142 : " + $ST + ", rien a faire"); return }

  gh repo clone $REPO $T -- --depth 1 --branch $BR -c core.autocrlf=false
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone refuse"; return }
  $NEW = $false
  foreach ($P in $PS) {
    $H = (Get-FileHash -Algorithm SHA256 (Join-Path $T ($PD + $P[0]))).Hash.ToLower()
    if ($H -ne $P[1]) { Write-Host ("ARRET : empreinte de " + $P[0] + " = " + $H); return }
    git -C $T apply --reverse --check ($PD + $P[0]) 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host ("Deja applique : " + $P[0]); continue }
    git -C $T apply --check ($PD + $P[0])
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : ne s'applique pas : " + $P[0]); return }
    git -C $T apply ($PD + $P[0])
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : application de " + $P[0]); return }
    $NEW = $true
  }
  if ($NEW) {
    git -C $T add -- .spec/00-canon/canon-distribution .github
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add"; return }
    git -C $T commit -m "chore(governance): Definition of Done dans le monorepo, DoD5 corrigee (mandat BC-7, patches 14 et 15)"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
    git -C $T push origin ("HEAD:refs/heads/" + $BR)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }
    & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2142"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }
  }
  Remove-Item -Recurse -Force $T

  $BODY = (gh pr view 2142 --repo $REPO --json body --jq .body) -join " "
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : corps de la PR illisible"; return }
  if ($BODY -notmatch "- \[x\] DoD1 ") { Write-Host "ARRET attendu au premier passage : DoD1 n'est pas cochee. L'agent du DEV relit la CI de la tete, coche DoD1, puis ce bloc se relance tel quel."; return }

  gh pr ready 2142 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2142 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2142 --repo $REPO --json name,state)
    if (-not $RAW) { Write-Host "ARRET : checks illisibles, rien n'est fusionne"; return }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $O = @($J | Where-Object { $_.name -notlike $CIRC })
    $BAD = @($O | Where-Object { ($OKS -notcontains $_.state) -and ($WAITS -notcontains $_.state) })
    $PEND = @($O | Where-Object { $WAITS -contains $_.state })
    if ($BAD.Count -gt 0) {
      $BAD | ForEach-Object { Write-Host ("  " + $_.state + " : " + $_.name) }
      Write-Host "ARRET : un check est en echec, rien n'est fusionne"; return
    }
    if (($PEND.Count -eq 0) -and ($O.Count -ge 10)) { $VERT = $true; break }
    Write-Host ("Checks en cours : " + $PEND.Count)
    Start-Sleep -Seconds 30
  }
  if (-not $VERT) { Write-Host "ARRET : checks non termines apres 45 minutes, rien n'est fusionne"; return }
  $NOW = (gh pr view 2142 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }

  $GO = Read-Host ("Approuver la PR 2142 sur la tete " + $HEAD + " ? L'App fusionne ensuite. (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2142 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $FUS = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 20
    $STN = (gh pr view 2142 --repo $REPO --json state --jq .state)
    if ($LASTEXITCODE -ne 0) { continue }
    if ($STN -eq "MERGED") { $FUS = $true; break }
    if ($STN -eq "CLOSED") { Write-Host "ARRET : la PR 2142 a ete fermee sans fusion"; return }
  }
  if (-not $FUS) { Write-Host "ARRET : l'App n'a pas fusionne la PR 2142 en 20 minutes ; lire le run du workflow Circuit de fusion"; return }

  Write-Host "PR 2142 fusionnee par l'App."
}
```
