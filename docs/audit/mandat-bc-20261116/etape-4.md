# Mandat BC — étape 4 : WIKI et RAW vérifient leur copie de l'AEC contre le monorepo

Étape 4 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`,
décisions 72, 73 et 121 de l'owner). Constats relevés le 17 novembre 2026 sur `main` du
monorepo (`abcfc30c3`), du wiki (`13869631b`) et de raw (`b097ca48a`). Trois PR, en brouillon :
wiki #140, raw #82, monorepo #2127 (patches et documents).

## Ce que fait l'étape

| Sujet | Avant | Après |
|---|---|---|
| Manifeste lu par `_scripts/check-aec-hash.sh` | `99-meta/canon-hashes.json` du vault | `.spec/00-canon/canon-distribution/canon-hashes.json` du monorepo, sur `main` |
| Lecture | `gh api` sur le vault, repli `curl` | `gh api` sur le monorepo, repli `curl` sur l'URL brute ; le journal dit laquelle a servi |
| Jeton du workflow | `VAULT_READ_TOKEN`, sinon `GITHUB_TOKEN` | `GITHUB_TOKEN` seul (patches 10 et 11) |
| Valeur lue | acceptée telle quelle | refusée si ce n'est pas un SHA-256 |
| Message d'écart | renvoie au vault | renvoie à la copie du monorepo à recopier |

Le cron de 03:30 UTC, l'écoute de `canon-updated` et les chemins déclencheurs ne changent pas.

## Constats avant d'agir

- Le manifeste du monorepo est sur `main` depuis #2112 (`b209d85c7`) et se lit sans jeton
  (HTTP 200). Son empreinte de l'AEC est celle du vault : `ed479960…785931f`. Le changement de
  source ne fait donc dériver aucune copie.
- Chaîne du 09, runs du 17 nov. à 03:35 UTC, tous verts : monorepo 44011280891, raw 44011326270,
  wiki 44011251789.
- Le script est dans les chemins déclencheurs du workflow : la PR qui le modifie rejoue le
  contrôle avec le nouveau script. La preuve ne dépend pas de l'étape 3.
- `verify` n'est pas dans les checks requis du ruleset du wiki. Les règles de branche de raw ne
  sont pas lisibles avec le jeton du DEV (HTTP 403).

## Écarts au plan, assumés

- **Le script garde `gh api` en premier et `curl` en repli**, comme avant. Le plan donnait l'un
  ou l'autre.
- **Le workflow est livré en patch**, pas dans la PR : le jeton du DEV ne pousse pas de fichier
  de workflow. Entre-temps le workflow d'origine appelle le nouveau script, ce qui fonctionne.
- **Le test négatif est joué sur deux PR de test**, ouvertes puis fermées par l'agent sans
  fusion, branches supprimées (wiki #141, raw #83).

## Empreintes

| Fichier (`docs/audit/mandat-bc-20261116/patches/`) | Dépôt, PR | sha256 |
|---|---|---|
| `10-wiki-aec-manifeste-monorepo-workflow.patch` | wiki #140 | `b623bc4b920c9673877315c46ffeba97b3a81fe35cb8a9d66c3d49115b46c9a4` |
| `11-raw-aec-manifeste-monorepo-workflow.patch` | raw #82 | `46c6a74443006125cda45bbf5464ccab3eadcaad86cc41a10175582c354f5638` |

Chaque patch modifie `.github/workflows/agent-exit-contract-hash.yml` : commentaire d'en-tête,
nom de l'étape, jeton. `git apply --check` : accepté sur la tête de chaque branche.

## Preuves

| Preuve | Résultat |
|---|---|
| Script, en local, par `gh api` (wiki et raw) | code 0, « OK » |
| Script, en local, sans `gh` (URL brute) | code 0 |
| Copie altérée ou absente, en local | code 1 |
| Job `verify` de wiki #140, tête `15725ec0d` | vert, run 44045354776, 08:17:08 UTC |
| Job `verify` de raw #82, tête `2a9a7611c` | vert, run 44045359835, 08:17:15 UTC |
| Journal des deux runs | « Manifest read from: gh api repos/ak125/nestjs-remix-monorepo/contents/.spec/00-canon/canon-distribution/canon-hashes.json » |
| Test négatif wiki #141 (copie altérée d'une ligne) | rouge, run 44046091011, 08:22:04 UTC, « AEC distribution drift » |
| Test négatif raw #83 | rouge, run 44046104316, 08:22:12 UTC, « AEC distribution drift » |
| Autres checks | wiki #140 : 9 verts ; raw #82 : 3 verts |

## Limites

- **Les workflows patchés n'ont tourné dans aucun run.** Les runs verts ci-dessus ont pu lire le
  monorepo avec `VAULT_READ_TOKEN` : lequel des deux jetons a servi n'est pas lisible. La
  lecture avec le seul jeton du job est prouvée au moment où le patch est poussé sur la PR,
  avant la fusion : le bloc exige alors `verify` vert.
- **Preuve de fin du plan, atteinte en partie.** Test négatif et journaux : faits. « Run vert
  sur `main` après fusion » : pas avant la fusion. Le bloc l'affiche.
- Le texte de l'AEC nomme encore le vault comme lieu du manifeste. Le corriger change son
  empreinte : c'est une révision du canon, à faire après cette étape, pas dedans.

## Questions à l'owner

- **D19 — Lire le manifeste sur `main` du monorepo, ou sur un SHA ou un tag ?** Réponse
  proposée : `main`. C'est le comportement d'aujourd'hui : une fusion qui change l'AEC rend
  wiki et raw rouges jusqu'à leur PR de copie, ce qui signale l'écart le jour même.
- **D20 — Rendre `verify` requis sur `main` du wiki ?** Réponse proposée : oui, après la fusion
  de #140. Le workflow ne tourne que sur ses chemins : le ruleset doit accepter l'absence du
  check sur une PR qui ne les touche pas, sinon ces PR restent bloquées. À régler par l'owner
  dans le ruleset ; rien n'est modifié ici.

## État

| État | Constat |
|---|---|
| Implémenté | oui : script des deux dépôts, patches 10 et 11 |
| Intégré | non : wiki #140, raw #82 et monorepo #2127 en brouillon |
| Vérifié | script : runs de PR verts et tests négatifs rouges. Workflows patchés : jamais exécutés |
| Opérationnel | non : sur `main`, wiki et raw lisent encore le vault |
| Bloqué | par le push des patches 10 et 11 et les trois fusions (gestes de l'owner) |

## Gestes de Marwane

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV n'a pas
de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit pas dans ce
dépôt public.

Le bloc lit les patches dans la branche de #2127 (ou sur `main` si elle est fusionnée) et
vérifie leurs empreintes. Pour le wiki puis pour raw : il applique le patch, le pousse, sort
la PR du brouillon, attend les checks, exige `verify` vert, demande l'accord, fusionne sur la
tête lue, puis affiche le dernier run du contrôle sur `main`. Il finit par #2127 : projections
régénérées sur le DEV, checks, accord, circuit, fusion. Il se rejoue : ce qui est fait est sauté.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc-etapes4-5-aec-wiki-raw-20261117"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $WF = "agent-exit-contract-hash.yml"
  $LOTS = @(
    @("ak125/automecanik-wiki", "140", "claude/mandat-bc-etape4-aec-manifeste-monorepo-20261117", "10-wiki-aec-manifeste-monorepo-workflow.patch", "b623bc4b920c9673877315c46ffeba97b3a81fe35cb8a9d66c3d49115b46c9a4", 9),
    @("ak125/automecanik-raw", "82", "governance/mandat-bc-etape4-aec-manifeste-monorepo-20261117", "11-raw-aec-manifeste-monorepo-workflow.patch", "46c6a74443006125cda45bbf5464ccab3eadcaad86cc41a10175582c354f5638", 3)
  )
  $STAMP = (Get-Date -Format "yyyyMMddHHmmss")
  $T = Join-Path $env:TEMP ("bc-etape4-" + $STAMP)

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2127 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $ST = (gh pr view 2127 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2127 illisible, rien n'est modifie"; return }
  if ($ST -eq "CLOSED") { Write-Host "ARRET : la PR 2127 est fermee sans fusion, rien n'est modifie"; return }
  $SRC = $BR
  if ($ST -eq "MERGED") { $SRC = "main" }

  gh repo clone $REPO $T -- --depth 1 --branch $SRC -c core.autocrlf=false
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone du monorepo refuse"; return }
  foreach ($L in $LOTS) {
    $H = (Get-FileHash -Algorithm SHA256 (Join-Path $T ($PD + $L[3]))).Hash.ToLower()
    if ($H -ne $L[4]) { Write-Host ("ARRET : empreinte de " + $L[3] + " = " + $H); return }
  }

  foreach ($L in $LOTS) {
    $R = $L[0]
    $P = $L[1]
    $LST = (gh pr view $P --repo $R --json state --jq .state)
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : etat de la PR " + $P + " de " + $R + " illisible"); return }
    if ($LST -ne "OPEN") { Write-Host ("PR " + $P + " de " + $R + " : " + $LST + ", rien a faire"); continue }
    $TR = Join-Path $env:TEMP ("bc-etape4-" + $P + "-" + $STAMP)
    $F = (Join-Path $T ($PD + $L[3]))
    $env:GIT_LFS_SKIP_SMUDGE = "1"
    gh repo clone $R $TR -- --depth 1 --branch $L[2] -c core.autocrlf=false
    $RC = $LASTEXITCODE
    Remove-Item Env:GIT_LFS_SKIP_SMUDGE
    if ($RC -ne 0) { Write-Host ("ARRET : clone de " + $R + " refuse"); return }
    git -C $TR apply --reverse --check $F 2>$null
    if ($LASTEXITCODE -ne 0) {
      git -C $TR apply --check $F
      if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : ne s'applique pas : " + $L[3]); return }
      git -C $TR apply $F
      if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : application de " + $L[3]); return }
      git -C $TR add -- (".github/workflows/" + $WF)
      if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add"; return }
      git -C $TR commit -m "ci(aec): le workflow lit le manifeste du monorepo, sans jeton du vault (mandat BC, etape 4)"
      if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
      git -C $TR push origin ("HEAD:refs/heads/" + $L[2])
      if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : push refuse sur " + $R); return }
    }
    gh pr ready $P --repo $R
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
    $LHEAD = (gh pr view $P --repo $R --json headRefOid --jq .headRefOid)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
    Start-Sleep -Seconds 60
    $LVERT = $false
    for ($i = 0; $i -lt 40; $i++) {
      $RAW = (gh pr checks $P --repo $R --json name,state)
      if (-not $RAW) { Write-Host ("ARRET : checks de " + $R + " illisibles, rien n'y est fusionne"); return }
      $J = @((($RAW -join "") | ConvertFrom-Json))
      $BAD = @($J | Where-Object { ($OKS -notcontains $_.state) -and ($WAITS -notcontains $_.state) })
      $PEND = @($J | Where-Object { $WAITS -contains $_.state })
      $VER = @($J | Where-Object { ($_.name -eq "verify") -and ($_.state -eq "SUCCESS") })
      if ($BAD.Count -gt 0) {
        $BAD | ForEach-Object { Write-Host ("  " + $_.state + " : " + $_.name) }
        Write-Host ("ARRET : un check de " + $R + " est en echec, rien n'y est fusionne"); return
      }
      if (($PEND.Count -eq 0) -and ($VER.Count -gt 0) -and ($J.Count -ge $L[5])) { $LVERT = $true; break }
      Write-Host ("Checks de " + $R + " en cours : " + $PEND.Count)
      Start-Sleep -Seconds 30
    }
    if (-not $LVERT) { Write-Host ("ARRET : checks de " + $R + " non termines apres 20 minutes"); return }
    $LNOW = (gh pr view $P --repo $R --json headRefOid --jq .headRefOid)
    if ($LNOW -ne $LHEAD) { Write-Host ("ARRET : la tete a change : " + $LNOW); return }
    $GO = Read-Host ("Fusionner la PR " + $P + " de " + $R + " sur la tete " + $LHEAD + " ? (oui/non)")
    if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
    gh pr merge $P --repo $R --squash --match-head-commit $LHEAD
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
    Remove-Item -Recurse -Force $TR
    Start-Sleep -Seconds 90
    Write-Host ("Dernier run du controle de l'AEC sur main de " + $R + " (attendu : completed success) :")
    gh run list --workflow $WF --repo $R --branch main --limit 1
    if ($LASTEXITCODE -ne 0) { Write-Host "A REFAIRE : lecture du run (la suite continue)" }
  }
  Remove-Item -Recurse -Force $T

  if ($ST -ne "OPEN") { Write-Host "PR 2127 deja fusionnee. Etape 4 terminee."; return }
  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2127"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }
  gh pr ready 2127 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2127 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2127 --repo $REPO --json name,state)
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
  $NST = (gh pr view 2127 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la PR 2127"; return }
  if ($NST -eq "MERGED") { Write-Host "PR 2127 deja fusionnee par son circuit. Etape 4 terminee."; return }
  $NOW = (gh pr view 2127 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }
  $GO = Read-Host ("Approuver et fusionner la PR 2127 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2127 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2127 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2127 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
  Write-Host "PR 2127 fusionnee. Etape 4 terminee."
}
```

## Points d'attention

- Après la fusion, à relever par l'agent : le run `push` du contrôle sur `main` du wiki et de
  raw, puis le passage du cron de 03:30 UTC.
- `VAULT_READ_TOKEN` n'est plus lu par aucun workflow du wiki ni de raw après cette étape et
  l'étape 7 (raw #81). Le secret peut alors être supprimé des deux dépôts : geste de l'owner.
- L'ordre wiki, raw, monorepo n'a pas d'importance : les trois PR sont indépendantes.
