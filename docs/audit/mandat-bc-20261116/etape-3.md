# Mandat BC — étape 3 : la publication du canon part du monorepo

Étape 3 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`,
décisions 72, 73 et 121 de l'owner). Constats relevés le 17 novembre 2026 sur `main` du
monorepo (`e15eb8be9`) et du vault (`b2e712791bee`). PR #2126, en brouillon.

## Ce que fait l'étape

| Sujet | Avant | Après |
|---|---|---|
| Qui annonce un canon modifié | le vault, `canon-publish.yml` : `repository_dispatch` `canon-updated` vers wiki, raw et monorepo | le monorepo, `canon-publish.yml` (patch 09), vers wiki et raw seulement |
| Quel canon est annoncé | `client_payload[canon]` fixé à `aec` | tiré du diff du manifeste : seuls les canons dont le `distribution_sha256` a changé |
| Quels dépôts | liste écrite dans le workflow | dépôts déclarés au manifeste, monorepo exclu |
| Calcul du plan | aucun | `scripts/canon/compute-canon-hashes.py --dispatch-plan`, testé, sans réseau |

Le workflow se déclenche sur un push de `main` qui touche `.spec/00-canon/canon-distribution/**`,
ou à la main (`workflow_dispatch`, entrée `canon`). Il rejoue `--check` avant toute annonce.

## Constats avant d'agir

- Le workflow du vault fonctionne encore : sa dernière annonce a produit les runs 43954251770
  (wiki) et 43954235161 (raw) le 16 nov. à 20:52 UTC. L'App est donc installée sur ces deux dépôts.
- Ces deux runs sont rouges, comme les deux précédents (8 nov., 3 nov.) : une annonce arrive
  avant la PR de copie, le contrôle constate l'écart. C'est le comportement voulu par le plan.
- Les contrôles de wiki et de raw ne lisent pas `client_payload` : le contenu de l'annonce
  ne change rien pour eux aujourd'hui.
- Le monorepo utilise déjà `actions/create-github-app-token@v3` avec un environnement restreint
  à `main` (`app-actions`, `merge-circuits.yml`). Le patch 09 suit cette forme.
- La liste des secrets du monorepo n'est pas lisible avec le jeton du DEV (HTTP 403) : la
  présence de `CANON_APP_ID` et `CANON_APP_PRIVATE_KEY` n'est pas vérifiée.
- `.github/workflows/**`, `docs/audit/**` et les deux fichiers de `scripts/canon/` sont déjà
  couverts par `ownership.yaml` : aucun extrait à appliquer.

## Écarts au plan, assumés

- **Le plan d'annonce est dans le générateur, pas dans le YAML.** Il se teste (9 tests) et la CI
  existante (`canon-distribution.yml`) le rejoue à chaque PR qui touche le générateur.
- **Le job d'annonce lit ses secrets dans un environnement `canon-publish`.** Des secrets de
  dépôt du même nom fonctionnent aussi : voir D18.
- **Un couple (canon, dépôt) nouveau est annoncé** même si le texte du canon n'a pas changé :
  un dépôt qu'on vient de déclarer doit recevoir sa première annonce.
- **Le contrôle de PR du workflow du vault n'est pas repris** : `canon-distribution.yml` le fait.

## Empreintes

| Fichier | sha256 |
|---|---|
| `docs/audit/mandat-bc-20261116/patches/09-canon-publish-workflow.patch` | `fcf460cbe955621a9298699586eb9bf206387edec5dd04b7f629c518508e58c6` |

Le patch crée `.github/workflows/canon-publish.yml`. `git apply --check` : accepté sur la tête
de la branche.

## Preuves

| Preuve | Résultat |
|---|---|
| Tests du générateur, en local | 41 passés (32 existants, 9 nouveaux) |
| `--dispatch-plan --canon aec` sur le dépôt | wiki et raw |
| `--dispatch-plan --canon marketing_voice` | `[]` : aucun dépôt hors monorepo |
| `--dispatch-plan --before` avec le manifeste courant | `[]` |
| `--dispatch-plan --before` avec une empreinte de l'AEC changée | wiki et raw |
| Canon inconnu, aucun sélecteur, ancien manifeste absent | code 1, message explicite |
| `--before` ou `--canon` sans `--dispatch-plan` | refus (code 2) |
| Récupération du commit précédent par son SHA (`git fetch --depth=1`), clone jetable de GitHub | réussie pour `b209d85c7` et son parent ; manifeste absent du parent, branche « tout est nouveau » : wiki et raw |
| YAML du workflow | chargé par PyYAML ; aucune expression `${{ }}` dans une étape `run:` |

## Limites

- **Le workflow n'a tourné dans aucun run.** Un fichier de workflow nouveau ne s'exécute pas
  avant d'être sur `main`. Les étapes `run:` ont été rejouées à la main, pas le workflow.
- **Preuve de fin du plan, non atteinte :** « un `workflow_dispatch` du nouveau workflow produit
  un run `repository_dispatch` dans wiki et raw ». Elle demande la fusion, les deux secrets et
  un lancement que le jeton du DEV ne peut pas faire. Le bloc ci-dessous la joue.
- La permission `Contents: write` de l'App sur wiki et raw est déduite des runs du 16 nov.,
  pas lue dans sa configuration.
- Tant que le vault n'est pas archivé, il annonce aussi : wiki et raw reçoivent deux annonces
  pour un même changement. Sans effet, chaque annonce relance le même contrôle.
- Une annonce de l'AEC rend wiki et raw rouges jusqu'à leur PR de copie. Rien n'ouvre cette PR
  à leur place.

## Question à l'owner

- **D18 — Où poser `CANON_APP_ID` et `CANON_APP_PRIVATE_KEY` ?** Réponse proposée : dans un
  environnement `canon-publish` du monorepo, restreint à la branche `main`, comme
  `app-actions`. La clé n'est alors lisible par aucun workflow lancé depuis une autre branche.
  Sinon, en secrets de dépôt : le workflow fonctionne sans changement, et GitHub crée
  l'environnement vide, sans restriction, à la première exécution.

## État

| État | Constat |
|---|---|
| Implémenté | oui : mode `--dispatch-plan`, 9 tests, patch 09 |
| Intégré | non : #2126 en brouillon |
| Vérifié | générateur : tests locaux, à confirmer par le check `canon-distribution` de la PR. Workflow : jamais exécuté |
| Opérationnel | non : le vault est encore le seul à annoncer |
| Bloqué | par le push du patch 09, la création des deux secrets et la fusion (gestes de l'owner) |

## Gestes de Marwane

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV n'a pas
de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit pas dans ce
dépôt public.

Avant le bloc : créer les deux secrets (D18). Le bloc vérifie l'empreinte du patch 09,
l'applique et le pousse depuis le poste, régénère les projections sur le DEV, sort la PR du
brouillon, attend les checks, exige le check `canon-distribution` vert, demande l'accord,
attend le circuit, puis fusionne sur la tête lue. Il propose ensuite l'annonce de preuve et
affiche le dernier run de chaque dépôt.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc-etape3-canon-publish-20261117"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $LISTE = @(
    @("09-canon-publish-workflow.patch", "fcf460cbe955621a9298699586eb9bf206387edec5dd04b7f629c518508e58c6")
  )
  $T = Join-Path $env:TEMP ("bc-etape3-" + (Get-Date -Format "yyyyMMddHHmmss"))

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2126 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $ST = (gh pr view 2126 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2126 illisible, rien n'est modifie"; return }
  if ($ST -ne "OPEN") { Write-Host ("PR 2126 : " + $ST + ", rien a faire"); return }

  gh repo clone $REPO $T -- --depth 1 --branch $BR -c core.autocrlf=false
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone refuse"; return }
  foreach ($P in $LISTE) {
    $H = (Get-FileHash -Algorithm SHA256 (Join-Path $T ($PD + $P[0]))).Hash.ToLower()
    if ($H -ne $P[1]) { Write-Host ("ARRET : empreinte de " + $P[0] + " = " + $H); return }
  }
  foreach ($P in $LISTE) {
    git -C $T apply --reverse --check ($PD + $P[0]) 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host ("Deja applique : " + $P[0]); continue }
    git -C $T apply --check ($PD + $P[0])
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : ne s'applique pas : " + $P[0]); return }
    git -C $T apply ($PD + $P[0])
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : application de " + $P[0]); return }
  }
  git -C $T add -A -- .github/workflows
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add"; return }
  git -C $T diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git -C $T commit -m "ci: workflow canon-publish (mandat BC, etape 3, patch 09)"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
    git -C $T push origin ("HEAD:refs/heads/" + $BR)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }
  }

  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2126"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }

  gh pr ready 2126 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2126 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2126 --repo $REPO --json name,state)
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
  $NOW = (gh pr view 2126 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }
  $REQ = @($J | Where-Object { ($_.name -like "canon-distribution*") -and ($_.state -eq "SUCCESS") })
  if ($REQ.Count -lt 1) { Write-Host ("ARRET : checks attendus verts : 1, releves : " + $REQ.Count + ", rien n'est fusionne"); return }

  $GO = Read-Host ("Approuver et fusionner la PR 2126 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2126 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2126 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2126 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
  Remove-Item -Recurse -Force $T
  Write-Host "PR 2126 fusionnee."

  $GO2 = Read-Host "Secrets CANON_APP_ID et CANON_APP_PRIVATE_KEY crees dans le monorepo ? Lancer l'annonce de preuve (canon aec) ? (oui/non)"
  if ($GO2 -ne "oui") { Write-Host "Annonce de preuve non lancee. Plus tard, une seule commande : gh workflow run canon-publish.yml --repo ak125/nestjs-remix-monorepo --ref main -f canon=aec"; return }
  gh workflow run canon-publish.yml --repo $REPO --ref main -f canon=aec
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lancement de canon-publish refuse"; return }
  Start-Sleep -Seconds 120
  Write-Host "Dernier run de canon-publish (monorepo) :"
  gh run list --repo $REPO --workflow canon-publish.yml --limit 1
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : runs du monorepo illisibles"; return }
  Write-Host "Dernier run recu par le wiki :"
  gh run list --repo ak125/automecanik-wiki --workflow agent-exit-contract-hash.yml --event repository_dispatch --limit 1
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : runs du wiki illisibles"; return }
  Write-Host "Dernier run recu par raw :"
  gh run list --repo ak125/automecanik-raw --workflow agent-exit-contract-hash.yml --event repository_dispatch --limit 1
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : runs de raw illisibles"; return }
}
```

## Points d'attention

- L'annonce de preuve relance le contrôle de l'AEC sur wiki et raw. Leurs copies sont à jour
  (1.3.0) : les deux runs doivent être verts. Un run rouge du job d'annonce avec « absent »
  signale des secrets manquants.
- Après la fusion, à relever par l'agent : le run de `canon-publish` sur `main` et les runs
  `repository_dispatch` reçus par wiki et raw.
- L'étape 4 ne dépend pas de celle-ci : wiki et raw peuvent lire le manifeste du monorepo
  avant de recevoir ses annonces.
