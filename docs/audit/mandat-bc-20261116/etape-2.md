# Mandat BC — étape 2 : contrôles canon locaux, `canon-sync` retiré

Étape 2 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`,
décisions 72, 73 et 121 de l'owner). Constats relevés le 17 novembre 2026 sur `main` du
monorepo (`b209d85c7`, puis `e15eb8be9`). PR #2125, en brouillon.

## Ce que fait l'étape

| Lecteur du vault | Avant | Après |
|---|---|---|
| `scripts/ci/check-aec-hash.sh`, `check-marketing-voice-hash.sh` | téléchargent `99-meta/canon-hashes.json` du vault | `scripts/canon/compute-canon-hashes.py --check`, puis contrôle que la copie nommée est déclarée au manifeste du monorepo ; aucun réseau, aucun jeton |
| `.husky/pre-commit`, bloc des miroirs canon | lance `_scripts/sync_canon_mirrors.py` du clone du vault | lance le générateur local dès qu'une copie, une source, le manifeste ou le générateur est indexé |
| `canon-sync.yml` et `scripts/ci/sync-canon-from-vault.sh` | cron de 03:00 UTC et `repository_dispatch` : recopient les canons du vault et ouvrent la PR `canon-sync/auto` | supprimés (workflow : patch 08). La copie se régénère par `--write` dans la PR qui modifie la source |
| `agent-exit-contract-hash.yml`, `marketing-voice-hash.yml` | déclenchés par les copies, un cron de 03:30 UTC et `repository_dispatch` | patch 08 : déclenchés aussi par la source, le manifeste et le générateur ; plus de cron ni de `repository_dispatch` |
| Journal des principes, P30 | ligne « Application » : étape 1 non fusionnée | ligne mise à jour ; règle inchangée |

## Constats avant d'agir

- L'étape 1 est sur `main` (#2112, `b209d85c7`, 07:48:38 UTC) : sources, manifeste et générateur
  existent. Run `canon-distribution` 44041567566 vert sur ce commit.
- Chaîne du 09 relevée verte avant de toucher : `agent-exit-contract-hash` 44011280891
  (monorepo), 44011326270 (RAW), 44011251789 (WIKI), `marketing-voice-hash` 44011468276,
  `canon-sync` 44007592811, `jcs-parity` 44012685671, passage `knowledge-jobs` de 07:00 UTC.
- Aucune PR `canon-sync/auto` ouverte, aucune branche `canon-sync/*` sur le dépôt.
- Les noms de jobs et la matrice des deux workflows ne sont pas changés. Aucun des contrôles
  `verify (…)` n'est un check requis de `main` (liste lue par
  `gh api repos/ak125/nestjs-remix-monorepo/branches/main`).

## Écarts au plan, assumés

- **Le cron de 03:30 UTC disparaît dans le monorepo.** Il détectait un écart entre le vault et
  les copies. Source et copies sont maintenant dans le même dépôt : un écart ne peut naître que
  d'un commit, et tout commit sur ces chemins déclenche le contrôle. Les crons de WIKI et de RAW
  restent.
- **Le SKILL `governance-vault-ops` n'est pas touché ici.** La PR #2118 (étape 8) le réécrit ; sa
  section « Miroirs canon » est écrite pour être vraie avant et après cette étape.
- **L'AEC n'est pas révisé dans cette PR.** Son paragraphe « Distribution canonique » décrit
  encore les mécanismes du vault et demande d'être mis à jour à chaque étape. Tant que WIKI et RAW
  comparent leurs copies au manifeste figé du vault (jusqu'à l'étape 4), une révision ferait
  diverger la source du monorepo de ce que ces deux dépôts contrôlent. Une seule révision, après
  l'étape 4, en patch (`.spec/00-canon/**` est réservé à l'owner).
- **L'interface des deux scripts est gardée** (`<chemin-de-la-copie>`), avec un contrôle de plus :
  une copie non déclarée au manifeste est refusée.

## Empreintes

| Fichier | sha256 |
|---|---|
| `docs/audit/mandat-bc-20261116/patches/08-canon-controles-locaux-workflows.patch` | `d36fc55f90cd21e5f4ff80a95a92d3984b5ca00701af68ab034db9b1fb435a8e` |

Le patch modifie `agent-exit-contract-hash.yml` et `marketing-voice-hash.yml` et supprime
`canon-sync.yml`. `git apply --check` : accepté sur la tête de la branche.

## Preuves

| Preuve | Résultat |
|---|---|
| Scripts, 5 copies déclarées, en local | code 0 pour chacune |
| Script, copie non déclarée (`workspaces/wiki/.claude/canon-mirrors/agent-exit-contract.md`) | code 1 |
| Script sans argument | code 2 |
| Un octet ajouté à un miroir, dépôt jetable | bloc du pre-commit : code 1 ; script : code 1 |
| Source modifiée sans `--write` | code 1 ; après `--write` : code 0 |
| CI de la PR, tête `b4e1301ae`, scripts locaux, workflows encore inchangés | `agent-exit-contract-hash` run 44043333364 : 3 `verify` verts (08:02 UTC) ; `marketing-voice-hash` run 44043333736 : 2 `verify` verts (08:02 UTC) |

## Limites

- **Le patch 08 n'a tourné dans aucun run.** Son YAML est valide et il s'applique ; les nouveaux
  déclencheurs ne seront observés qu'après son push depuis le poste.
- **Preuve de fin du plan, non atteinte :** « une PR de test qui modifie un octet d'un miroir est
  rouge en CI » n'a pas été jouée sur GitHub, seulement en local. Elle se joue après la fusion,
  sur une branche jetable. « Plus de run planifié de `canon-sync` » ne se constate qu'après la
  fusion.
- **Deux miroirs échappent au contrôle** parce qu'ils ne sont pas au manifeste : voir D16 et D17.
  Le pre-commit ne refuse pas leur édition à la main.
- Le pre-commit ne tourne que sur un poste où husky est installé. La CI fait foi.
- Tant que la PR est en brouillon sans le patch 08, la fusionner laisserait `canon-sync.yml` sur
  `main` avec un script supprimé : son cron de 03:00 UTC échouerait.

## Questions à l'owner

- **D16 — `workspaces/wiki/.claude/canon-mirrors/agent-exit-contract.md` (v1.0.0, périmé) :
  déclarer ou supprimer ?** Réponse proposée : le déclarer comme sixième copie de l'AEC et le
  régénérer par `--write`. Le workspace wiki charge alors la version en vigueur. Aucun code ne
  lit ce fichier aujourd'hui.
- **D17 — `.claude/canon-mirrors/exploration-budget.md` : déclarer ou reloger ?** Réponse
  proposée : le reloger avec sa politique hors de `canon-mirrors/`. Ce n'est pas la copie d'un
  canon distribué, et sa source est dans le vault. Seul `ownership.yaml` le nomme.

## État

| État | Constat |
|---|---|
| Implémenté | oui : deux scripts, pre-commit, suppression du script de synchronisation, P30, patch 08 |
| Intégré | non : #2125 en brouillon |
| Vérifié | scripts : en local et par 5 contrôles verts de la CI de la PR. Patch 08 : appliqué à blanc, jamais exécuté |
| Opérationnel | non : `main` lit encore le vault pour ces contrôles, et `canon-sync` y tourne chaque nuit |
| Bloqué | par le push du patch 08 et l'approbation de l'owner (circuit élevé : `.husky/`, `.claude/governance/`) |

## Gestes de Marwane

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV n'a pas
de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit pas dans ce
dépôt public.

Le bloc vérifie l'empreinte du patch 08, l'applique et le pousse depuis le poste, régénère
les projections sur le DEV, sort la PR du brouillon, attend les checks, exige cinq contrôles
`verify` verts, demande l'accord, approuve, attend le circuit, puis fusionne sur la tête lue.
Il se relance sans risque : un patch déjà appliqué est sauté.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc-etape2-controles-canon-locaux-20261117"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $LISTE = @(
    @("08-canon-controles-locaux-workflows.patch", "d36fc55f90cd21e5f4ff80a95a92d3984b5ca00701af68ab034db9b1fb435a8e")
  )
  $T = Join-Path $env:TEMP ("bc-etape2-" + (Get-Date -Format "yyyyMMddHHmmss"))

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2125 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $ST = (gh pr view 2125 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2125 illisible, rien n'est modifie"; return }
  if ($ST -ne "OPEN") { Write-Host ("PR 2125 : " + $ST + ", rien a faire"); return }

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
    git -C $T commit -m "ci: controles canon locaux, canon-sync retire (mandat BC, etape 2, patch 08)"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
    git -C $T push origin ("HEAD:refs/heads/" + $BR)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }
  }

  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2125"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }

  gh pr ready 2125 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2125 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2125 --repo $REPO --json name,state)
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
  $NOW = (gh pr view 2125 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }
  $REQ = @($J | Where-Object { ($_.name -like "verify*") -and ($_.state -eq "SUCCESS") })
  if ($REQ.Count -lt 5) { Write-Host ("ARRET : checks attendus verts : 5, releves : " + $REQ.Count + ", rien n'est fusionne"); return }

  $GO = Read-Host ("Approuver et fusionner la PR 2125 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2125 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2125 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2125 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
  Remove-Item -Recurse -Force $T
  Write-Host "PR 2125 fusionnee."
}
```

## Points d'attention

- En circuit élevé, le check « 🚦 Circuit de fusion » reste rouge tant que l'approbation de
  l'owner manque sur la tête. Le bloc lit les checks par `gh pr checks --json` : `gh` 2.50 ou
  plus récent.
- Après la fusion, à relever par l'agent : le run de `agent-exit-contract-hash` et de
  `marketing-voice-hash` sur le commit de fusion, puis `gh run list -w canon-sync`.
- Le vault continue d'émettre `canon-updated` vers le monorepo jusqu'à son archivage : plus
  aucun workflow du monorepo ne l'écoute, sans effet.
