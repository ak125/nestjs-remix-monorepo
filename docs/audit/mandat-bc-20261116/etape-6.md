# Mandat BC — étape 6 : retrait de la porte de fusion ADR-124

Étape 6 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`).
Constats relevés le 17 novembre 2026 sur `main` du monorepo (`4a4d43bb6`). PR #2131, en brouillon.

## Décision suivie

Le plan prévoyait de reloger dans le monorepo la politique que lisait la porte
(`ledger/policies/merge-perimeter.v1.json` du vault). C'était l'objet de #2113. Deux décisions de
l'owner ont changé l'étape :

- **décision 120** (journal, P20) : le circuit faible est activé ; la porte ADR-124 ne s'applique
  plus, son script n'étant appelé par aucun workflow ;
- **décision 132** (17 nov., option B de la question D9, qui tranche aussi D7) : la porte est
  retirée. Le pilotage a fermé #2113 et #2079 à 10:55 UTC.

L'étape devient donc un retrait : plus rien, dans le monorepo, ne lit la politique du vault.

## Ce qui est retiré

| Élément | Où | Qui |
|---|---|---|
| `scripts/ci/merge-perimeter-gate.mjs` (323 lignes) | PR #2131 | agent |
| `scripts/ci/merge-perimeter-gate.test.mjs` (245 lignes) | PR #2131 | agent |
| Pas « 🚧 Merge perimeter gate » de `.github/workflows/audit.yml` | patch 12 | owner |
| Ligne `/scripts/ci/merge-perimeter-gate.mjs` de `.github/CODEOWNERS` | patch 12 | owner |
| Phrase « Tant que l'owner ne les a pas activés, la porte ADR-124 s'applique » de `CLAUDE.md` | patch 12 | owner |
| Outil du DEV `/home/deploy/resync/merge-perimeter.sh` et sa variante `.bc6` | ligne ci-dessous | owner |

## Ce qui est corrigé

| Fichier | Avant | Après |
|---|---|---|
| `.claude/rules/deployment.md`, cycle PREPROD | « celle qu'exécute une porte de fusion automatique (ADR-124 D7) » | « celle que fusionne l'App dans un circuit de fusion (P20) » |
| `.claude/rules/deployment.md`, point 1 de la livraison | « la seule fusion automatique reste la porte d'ADR-124 » | seul le circuit faible est déclaré activé (décision 120) ; la porte est retirée (décision 132) ; hors de ce circuit, l'owner fusionne sur une tête épinglée |
| Journal des principes, P20, ligne « Application » | « Le script de la porte […] n'est appelé par aucun workflow ; seul son test tourne » | « Le script de la porte ADR-124 et son test sont retirés du dépôt (décision 132) » |
| `scripts/ci/merge-circuit.mjs`, commentaire d'en-tête | « même résolution que la porte ADR-124 » | renvoi à `findOwnershipMatch` de `scripts/registry/check-new-files.js` |
| `CLAUDE.md` §Gouvernance (patch 12) | « Tant que l'owner ne les a pas activés, la porte ADR-124 s'applique. » | « leur état d'application est dans P20 du journal. » |

La règle de P20 ne change pas : seule sa phrase de fait est mise à jour. `CLAUDE.md` renvoie à P20
au lieu de redire quel circuit est activé : une seule source pour cet état.

## Patch réservé

| Pièce | sha256 |
|---|---|
| `patches/12-retrait-porte-adr124-reserve.patch` | `99520d09f8589dafaf90770c89daac24982636004fc67a8868e875c8a8037f81` |

Trois fichiers, 2 insertions, 8 suppressions. Construit hors du dépôt à partir de `origin/main`
(`4a4d43bb6`) ; `git apply --check` vert sur l'arbre de la branche.

## Ligne pour supprimer l'outil du DEV

À lancer par l'owner sur la machine DEV (le bloc ci-dessous la lance après la fusion) :

```bash
rm -f /home/deploy/resync/merge-perimeter.sh /home/deploy/resync/merge-perimeter.sh.bc6 /home/deploy/resync/merge-perimeter.pause /home/deploy/resync/merge-perimeter.lock
```

Relevé du 17 nov. : `merge-perimeter.sh` (9 nov.) et `merge-perimeter.sh.bc6` (17 nov.) existent ;
les fichiers `.pause` et `.lock` n'existent pas (`rm -f` les ignore). Aucune ligne de `crontab -l`
n'appelle l'outil.

## Preuves (17 nov., machine DEV)

| Constat | Résultat |
|---|---|
| Seul importateur du script sur `main` | son test |
| Seul appelant du test | le pas d'`audit.yml` que retire le patch 12 |
| Arbre de la branche sans le patch 12 : `node --test scripts/ci/merge-perimeter-gate.test.mjs` | échec, « Could not find » : **« 🛡️ Deterministic gates » est rouge tant que le patch n'est pas poussé** |
| Arbre de la branche + patch 12 : `ci-test-wiring.test.mjs` | 15 réussis sur 15 |
| Arbre de la branche + patch 12 : `merge-circuit.test.mjs` | 6 réussis sur 6 |
| Arbre de la branche + patch 12 : `merge-perimeter` dans `.github`, `scripts`, `CLAUDE.md` | 0 occurrence |
| `audit.yml` patché | YAML valide, 5 pas `node --test scripts/ci/…`, tous sur un fichier présent |
| `validate-agents-md.sh --file` sur le `CLAUDE.md` patché | PASS ; 127 lignes avant et après |
| Circuit calculé (`merge-circuit.mjs --files …`) | élevé : `scripts/ci/merge-circuit.mjs` et le script retiré sont en zone CODEOWNERS |

Les essais « branche + patch » sont joués dans un arbre jetable hors du dépôt. La preuve en CI
n'existe qu'après le push du patch 12.

## Ce qui reste, et pourquoi

- `audit/registry/files.json` et `audit/registry/canonical.json` nomment encore les deux fichiers
  supprimés : ce sont des projections, régénérées par `resync-pr.sh 2131` (dans le bloc).
  « Registry freshness » est rouge d'ici là.
- `ledger/policies/merge-perimeter.v1.json` reste dans le vault : c'est une pièce de l'archive.
- Sur le DEV, `/home/deploy/resync/commit-audit-1972.sh` et `audit-1972.yml` nomment encore le
  test de la porte. Ce sont les pièces d'un geste ponctuel déjà fait (#1972) ; elles ne sont
  appelées par rien. Non touchées : à l'owner de dire s'il les garde.
- Les mentions de la porte dans `docs/audit/`, `audit/` et `log.md` sont de l'historique daté.

## État

| État | Constat |
|---|---|
| Implémenté | oui : PR #2131 et patch 12 |
| Intégré | non : PR en brouillon, patch 12 à pousser, fusion en circuit élevé par l'owner |
| Vérifié | en local sur l'arbre final ; pas encore en CI |
| Opérationnel | sans objet : la porte ne servait déjà plus (P20) |
| Bloqué | par le push du patch 12 (le jeton du DEV ne pousse ni `.github/` ni `CLAUDE.md` racine) |

## Geste de l'owner

Un seul bloc, Windows PowerShell 5.1 (32 bits). Il pousse le patch 12 après contrôle de son
empreinte, lance `resync-pr.sh`, attend les checks, demande l'accord, approuve, fusionne sur la
tête épinglée, puis supprime l'outil du DEV. Rejouable. **Non exécuté par l'agent.**

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc-etape6-retrait-porte-adr124-20261117"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $LISTE = @(
    @("12-retrait-porte-adr124-reserve.patch", "99520d09f8589dafaf90770c89daac24982636004fc67a8868e875c8a8037f81")
  )
  $T = Join-Path $env:TEMP ("bc-e6-" + (Get-Date -Format "yyyyMMddHHmmss"))

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2131 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $ST = (gh pr view 2131 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2131 illisible, rien n'est modifie"; return }
  if ($ST -ne "OPEN") { Write-Host ("PR 2131 : " + $ST + ", rien a faire"); return }

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
  git -C $T add -A -- .github/workflows/audit.yml .github/CODEOWNERS CLAUDE.md
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add"; return }
  git -C $T diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git -C $T commit -m "chore(ci): patch reserve 12, retrait de la porte ADR-124 (audit.yml, CODEOWNERS, CLAUDE.md)"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
    git -C $T push origin ("HEAD:refs/heads/" + $BR)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }
  }

  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2131"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }

  gh pr ready 2131 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2131 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2131 --repo $REPO --json name,state)
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
  $NOW = (gh pr view 2131 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }
  $REQ = @($J | Where-Object { ($_.name -like "*Deterministic gates*") -and ($_.state -eq "SUCCESS") })
  if ($REQ.Count -lt 1) { Write-Host ("ARRET : checks attendus verts : 1, releves : " + $REQ.Count + ", rien n'est fusionne"); return }

  $GO = Read-Host ("Approuver et fusionner la PR 2131 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2131 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2131 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2131 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
  Remove-Item -Recurse -Force $T
  Write-Host "PR 2131 fusionnee."
  & $SSH $DEV "rm -f /home/deploy/resync/merge-perimeter.sh /home/deploy/resync/merge-perimeter.sh.bc6 /home/deploy/resync/merge-perimeter.pause /home/deploy/resync/merge-perimeter.lock"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : suppression de l'outil du DEV refusee (la PR est fusionnee)"; return }
  Write-Host "Outil de la porte supprime du DEV."
}
```
