# Actes réservés à l'owner — commandes exactes (mandat BB)

Aucune de ces commandes n'a été lancée par l'agent. Le bloc PowerShell n'a pas été exécuté : la
machine DEV n'a pas de PowerShell, et sa syntaxe n'a donc pas été vérifiée par un interpréteur.
Ce qui a été rejoué sur la machine DEV est listé au §4.

**Machine et compte** : le poste de l'owner, avec `git` et `gh` authentifié sur le compte `ak125`,
administrateur du dépôt. Le jeton de la machine DEV ne pousse pas de workflow et n'a pas
`actions:write` : il ne peut ni publier ces correctifs, ni supprimer un cache, ni annuler un run.

## 1. Ce que fait le bloc

Il se relance sans risque : chaque étape lit l'état avant d'agir.

1. Clone jetable de `main` dans le dossier temporaire du poste. Le clone habituel de l'owner n'est
   pas touché.
2. Contrôle de l'empreinte sha256 des six correctifs. Une différence arrête tout.
3. Deux PR, chacune sautée si elle existe déjà :
   - `ci/mandat-bb-cache-concurrence` : correctifs 01, 02, 04, 05 (15 fichiers de workflow) ;
   - `ci/mandat-bb-backend-tests-2-workers` : correctif 03 seul, à juger sur son propre run.
4. Une troisième PR, `ci/mandat-bb-release-prod-cache` (correctif 02b, `release-prod.yml`),
   seulement si `$AvecReleaseProd` vaut `$true`. Ce fichier relève de la chaîne PROD : la valeur
   livrée est `$false`, à changer par l'owner s'il le décide.
5. État des PR et durée des jobs du run de la PR du correctif 03.
6. Suppression de deux caches npm de `main`, seulement quand la première PR est fusionnée : relancer
   le bloc après la fusion.
7. Annulation des 169 runs restés en file depuis le 2026-11-11 (PR #2004, #2014, #2015, #2016, déjà
   fusionnées ; aucun job). Filtre : en file, créés le 2026-11-11, événements `pull_request` et
   `pull_request_target`. Un run `release-prod.yml` part d'un tag ou d'un lancement manuel : il ne
   répond pas à ce filtre.
8. Lecture du plan du compte.

Le bloc ne fusionne rien, ne modifie pas la protection de `main` et n'écrit dans aucun fichier
réservé autre que les workflows des correctifs.

## 2. Le bloc (Windows PowerShell, 32 bits compris)

```powershell
& {
    $Repo = 'ak125/nestjs-remix-monorepo'
    $Url = 'https://github.com/ak125/nestjs-remix-monorepo.git'
    $BrancheMandat = 'mandat-bb/ci-attente-20261116'
    $AvecReleaseProd = $false
    $SupprimerCaches = $true
    $AnnulerRunsFantomes = $true

    $Base = Join-Path $env:TEMP 'mandat-bb-ci'
    $Work = Join-Path $Base 'main'
    $Src = Join-Path $Base 'mandat'
    $Rel = 'docs\audit\mandat-bb-20261116'
    $BrancheCache = 'ci/mandat-bb-cache-concurrence'
    $BrancheJest = 'ci/mandat-bb-backend-tests-2-workers'

    $Empreintes = @{
        '01-cache-npm-jobs-heberges-sans-installation.patch' = '43dfda38dfb387396aa1f5f47caf6c6a5a30741155732623e3049fef9a840618'
        '02-cache-npm-jobs-self-hosted.patch' = '66c1a67e2bcccb1d2374c57c6dff2f9326533e5a86d557ea3f85c6accae99c99'
        '02b-cache-npm-release-prod.patch' = '1b0fee7586c400daf1ed8b3e03ca72c0508792626612baa3da37f7b185297b6a'
        '03-backend-tests-deux-workers.patch' = '94c04a42fd18e46d7e9ca6b0bba7b0af139f99742a69a79ff1a50d4adf38a2e3'
        '04-annulation-runs-depasses.patch' = '198a58073fd3cf15d3ed867746af2692627c3ab89d19478b82fe109d5da09028'
        '05-porte-fichiers-nouveaux-journal.patch' = 'a11d3486d249fa4fca3fbd1d5afe7381059308aba283d94f93617cb0245ab639'
    }

    $Lots = @(
        @{
            Branche = $BrancheCache
            Patches = @('01-cache-npm-jobs-heberges-sans-installation.patch', '02-cache-npm-jobs-self-hosted.patch', '04-annulation-runs-depasses.patch', '05-porte-fichiers-nouveaux-journal.patch')
            Titre = 'ci: cache npm, annulation des runs depasses, journal de la porte des fichiers nouveaux (mandat BB)'
            Corps = 'pr-a-cache-concurrence.md'
        },
        @{
            Branche = $BrancheJest
            Patches = @('03-backend-tests-deux-workers.patch')
            Titre = 'ci: jest a deux workers dans Backend Tests (mandat BB)'
            Corps = 'pr-b-backend-tests-2-workers.md'
        }
    )
    if ($AvecReleaseProd) {
        $Lots += @{
            Branche = 'ci/mandat-bb-release-prod-cache'
            Patches = @('02b-cache-npm-release-prod.patch')
            Titre = 'ci: release-prod sans telechargement du cache npm (mandat BB)'
            Corps = 'pr-c-release-prod-cache.md'
        }
    }

    gh auth status
    if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : gh non authentifie (gh auth login)'; return }

    if (Test-Path $Base) { Remove-Item -Recurse -Force $Base }
    New-Item -ItemType Directory -Path $Base | Out-Null
    git clone -c core.longpaths=true --depth 1 --branch main $Url $Work
    if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : clone de main impossible'; return }

    $Dossier = Join-Path $Work $Rel
    if (-not (Test-Path (Join-Path $Dossier 'patches'))) {
        git clone -c core.longpaths=true --depth 1 --branch $BrancheMandat $Url $Src
        if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : dossier du mandat absent de main et branche du mandat introuvable'; return }
        $Dossier = Join-Path $Src $Rel
    }
    $DossierPatches = Join-Path $Dossier 'patches'
    $DossierCorps = Join-Path $Dossier 'pr'

    foreach ($Nom in $Empreintes.Keys) {
        $Fichier = Join-Path $DossierPatches $Nom
        if (-not (Test-Path $Fichier)) { Write-Host ('ARRET : correctif absent : ' + $Nom); return }
        $Lue = (Get-FileHash -Algorithm SHA256 -Path $Fichier).Hash.ToLower()
        if ($Lue -ne $Empreintes[$Nom]) { Write-Host ('ARRET : empreinte differente pour ' + $Nom); return }
    }
    Write-Host 'Empreintes des 6 correctifs : conformes'

    foreach ($Lot in $Lots) {
        $Branche = $Lot.Branche
        $Titre = $Lot.Titre
        $Corps = Join-Path $DossierCorps $Lot.Corps

        $Deja = gh pr list --repo $Repo --head $Branche --state all --json number --jq 'length'
        if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : lecture des PR impossible'; return }
        if ($Deja -ne '0') { Write-Host ('PR deja ouverte pour ' + $Branche + ' : lot saute'); continue }

        git -C $Work ls-remote --exit-code --heads origin $Branche
        if ($LASTEXITCODE -eq 0) { Write-Host ('Branche ' + $Branche + ' deja poussee sans PR : lot saute, ouvrir la PR a la main'); continue }

        git -C $Work switch -c $Branche origin/main
        if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : creation de la branche ' + $Branche + ' impossible'); return }

        foreach ($Nom in $Lot.Patches) {
            $Fichier = Join-Path $DossierPatches $Nom
            git -C $Work apply --check $Fichier
            if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : le correctif ne s applique plus sur main : ' + $Nom); return }
            git -C $Work apply $Fichier
            if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : application impossible : ' + $Nom); return }
        }

        git -C $Work commit -m $Titre -- .github/workflows
        if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : commit impossible (user.name et user.email de git ?)'; return }
        git -C $Work push -u origin $Branche
        if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : push de ' + $Branche + ' refuse'); return }
        gh pr create --repo $Repo --base main --head $Branche --assignee ak125 --title $Titre --body-file $Corps
        if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : ouverture de la PR impossible pour ' + $Branche); return }
    }

    Write-Host '--- Etat des PR de correctifs'
    foreach ($Lot in $Lots) {
        $Branche = $Lot.Branche
        gh pr list --repo $Repo --head $Branche --state all --json number,state,url --jq '.[] | [.number, .state, .url] | @tsv'
    }

    Write-Host '--- Jobs du dernier run ci.yml de la PR jest (comparer Backend Tests a 5,3 min)'
    $RunJest = gh run list --repo $Repo --workflow ci.yml --branch $BrancheJest --event pull_request --limit 1 --json databaseId --jq '.[0].databaseId'
    if (($LASTEXITCODE -eq 0) -and $RunJest) { gh run view $RunJest --repo $Repo } else { Write-Host 'Aucun run pour l instant : relancer le bloc dans dix minutes' }

    if ($SupprimerCaches) {
        Write-Host '--- Caches npm de main'
        $Fusion = gh pr list --repo $Repo --head $BrancheCache --state merged --json number --jq 'length'
        if (($LASTEXITCODE -eq 0) -and ($Fusion -eq '1')) {
            $Caches = @(gh cache list --repo $Repo --key node-cache-Linux-x64-npm- --ref refs/heads/main --json id,sizeInBytes --jq '.[] | select(.sizeInBytes < 100000 or .sizeInBytes > 3000000000) | .id')
            if ($Caches.Count -eq 0) { Write-Host 'Aucun cache vide ni cache de plus de 3 Go : rien a supprimer' }
            foreach ($Id in $Caches) {
                gh cache delete $Id --repo $Repo
                if ($LASTEXITCODE -ne 0) { Write-Host ('Cache non supprime : ' + $Id) }
            }
        } else {
            Write-Host 'PR de cache pas encore fusionnee : aucun cache supprime. Relancer le bloc apres la fusion.'
        }
    }

    if ($AnnulerRunsFantomes) {
        Write-Host '--- Runs en file depuis le 2026-11-11'
        foreach ($Evenement in @('pull_request', 'pull_request_target')) {
            $Runs = @(gh run list --repo $Repo --status queued --created 2026-11-11 --event $Evenement --limit 400 --json databaseId --jq '.[].databaseId')
            if ($LASTEXITCODE -ne 0) { Write-Host 'Lecture de la file impossible'; continue }
            Write-Host ($Evenement + ' : ' + $Runs.Count + ' run(s) a annuler')
            foreach ($Id in $Runs) {
                gh run cancel $Id --repo $Repo
                if ($LASTEXITCODE -ne 0) {
                    $Chemin = 'repos/' + $Repo + '/actions/runs/' + $Id + '/force-cancel'
                    gh api -X POST $Chemin
                    if ($LASTEXITCODE -ne 0) { Write-Host ('Run non annule : ' + $Id) }
                }
            }
        }
    }

    Write-Host '--- Plan du compte (vide si le jeton ne le montre pas)'
    gh api user --jq .plan.name
    Write-Host 'Termine.'
}
```

## 3. Après le bloc

**Mesures à lire.**

| Correctif | Où lire | Avant |
|---|---|---|
| 03 | job `🧪 Backend Tests` du run de sa PR (affiché par le bloc) | 5,3 min en médiane, p90 6,4 ; étape des tests 144 s |
| 02 | après fusion, run `ci.yml` de `main` : étape `setup-node` des jobs deploy, E2E, Lighthouse | 185 à 189 s par job, ≈ 9,3 min par cycle |
| 01 | après fusion et suppression des caches : étape d'installation des jobs de PR | 93 s en médiane |
| 02b | prochain run `release-prod.yml`, étape `setup-node` | 185 à 198 s |

Le correctif 03 se fusionne seulement si son job est vert et plus court. Sinon, fermer sa PR.

**Fusion.** Par l'owner, avec son geste habituel (`merge-pr.sh <PR>` sur la machine DEV). Ces PR
sont écrites par l'owner : il ne peut pas les approuver lui-même, donc le check `🚦 Circuit de
fusion` y reste rouge. Ce check ne fait pas partie des 14 contrôles requis. Un agent ne fusionne
pas et n'arme rien.

**Caches.** Le bloc supprime, sur `refs/heads/main`, l'entrée npm vide (882 octets, id 9471832109 à
23:42Z) et l'entrée de 3,9 Go du runner self-hosted (id 9472058683). Il les retrouve par leur
taille, pas par leur identifiant. Entre la suppression et le premier run de `main`, chaque PR
sauvegarde son propre cache : relancer le bloc juste après une fusion sur `main` limite cette
fenêtre. Sans le correctif 02b, le prochain run `release-prod.yml` recrée l'entrée de 3,9 Go.

**Retour arrière.** `git revert` du commit de fusion de la PR concernée. Un cache supprimé se
reconstruit seul. Un run annulé du 11 novembre n'a rien à rejouer : sa PR est fusionnée.

## 4. Ce qui a été rejoué sur la machine DEV

- Chaque commande `gh` de lecture du bloc, telle quelle (`gh` 2.101.0) : liste des PR par branche
  (`0` sans PR, `1` pour une PR fusionnée), liste des deux caches (ids 9471832109 et 9472058683),
  liste des runs en file (155 `pull_request`, 14 `pull_request_target`), `gh run view`.
- L'application des trois lots sur `origin/main` `3832abfc2`, à 2026-11-16T23:58:37Z, dans un index
  temporaire (`git read-tree`, `git apply --cached`, `git write-tree`), sans toucher l'arbre de
  travail : lot 1, 15 fichiers, +50 −4 ; lot 2, 1 fichier, +1 −1 ; lot 3, 1 fichier, +1. Tous les
  fichiers modifiés sont sous `.github/workflows/`.
- Le texte du bloc : ASCII seul, aucun `&&`, aucun guillemet double.
- Non rejoué : le clone, `git switch`, `git commit`, `git push`, `gh pr create`,
  `gh cache delete`, `gh run cancel`, et tout PowerShell.

## 5. Décisions hors bloc

| Décision | Geste | Détail |
|---|---|---|
| Aucun resync d'entretien : seul le train met une PR à jour | consigne de pilotage, dans le Space | `README.md` §6 |
| Train des circuits faible et moyen | installer `scripts/train-circuits.sh` et `scripts/train-preflight.sh` à côté de `resync-pr.sh`, lancer `train-circuits.sh <fichier-train>` (plan), puis `train-circuits.sh --run <fichier-train>` | `README.md` §6 ; le mode `--run` n'a jamais été exécuté |
| Entrées d'ownership | copier les entrées retenues de `options/ownership-globs.yaml` dans `ownership.yaml`, par une PR de l'owner | `README.md` §7 |
| Correctif 02b | passer `$AvecReleaseProd` à `$true` dans le bloc | chaîne PROD |
| Plan Pro | réglages de facturation du compte, `https://github.com/settings/billing` | non recommandé, `README.md` §5 |
