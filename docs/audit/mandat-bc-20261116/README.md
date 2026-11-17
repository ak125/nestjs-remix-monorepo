# Mandat BC — sortie du vault, étapes 1 à 8

Dossier de preuves du mandat BC (décision 107 de Marwane). Plan suivi :
[`../mandat-ar-20261116/inventaire-vault-et-plan.md`](../mandat-ar-20261116/inventaire-vault-et-plan.md) §2.
Une étape = une PR prouvée. L'étape 9 (archivage du vault) reste à Marwane.

Chaque étape a sa section : ce qui change, les preuves, les exclusions, les gestes de Marwane.

## Étape 1 — sources, manifeste et générateur dans le monorepo (PR #2112)

### Ce qui change

| Fichier | Rôle | Qui le pose |
|---|---|---|
| `scripts/canon/compute-canon-hashes.py` | générateur du manifeste et des copies (`--check`, `--write`, `--print`), gate de statut fail-closed | agent (PR) |
| `scripts/canon/test_compute_canon_hashes.py` | 32 tests pytest | agent (PR) |
| `.spec/00-canon/canon-distribution/rules-agent-exit-contract.md` | source de l'AEC 1.3.0 | Marwane, patch 01 |
| `.spec/00-canon/canon-distribution/rules-marketing-voice.md` | source de la voix de marque 1.0.1 | Marwane, patch 01 |
| `.spec/00-canon/canon-distribution/canon-hashes.json` | manifeste généré | Marwane, patch 01 |
| `.github/workflows/canon-distribution.yml` | CI : `--check` et pytest, sur `main` et sur les PR qui touchent les 6 chemins | Marwane, patch 02 |
| `.spec/00-canon/repository-registry/ownership.yaml` | 3 entrées (extrait `ownership-snippet-etape1.yaml`) | Marwane, par `resync-pr.sh --ownership` |

Empreintes des pièces remises :

| Pièce | sha256 |
|---|---|
| `patches/01-canon-distribution-sources.patch` | `47b6cc9c5ad1ca4f5ec4d5ebea90e3dba27094c20c990b5a4f73653ab3d9b05f` |
| `patches/02-canon-distribution-workflow.patch` | `60e5e22f37b0099c659374331ce2e8349a8b9b0e6d0e4f09a3fda6c35278f1fe` |
| `ownership-snippet-etape1.yaml` | `6ce7b2308c97a676bec1ec2de4b8916ebc96c4b81b0e7f2f09979cd63ee2218b` |

### Preuves (2026-11-16, machine DEV)

Sources prises sur `main` du vault `b2e712791bee17c192acc5d04ed2ee1bd88488f1`, octet pour octet.

| Constat | Résultat |
|---|---|
| `sha256sum` de la source AEC | `f813c8ff5a7c2696ff0c1451880650f68cef9241d12bdae3b40d009283579c22` |
| `sha256sum` de la source voix | `066dd515d98fb888e70f341ef456a870f2aad0934783c7bc6a4b9be92f9c57c2` |
| Texte distribué AEC, et les 3 copies du monorepo | `ed479960ec5be8ff525238bd5583ae3256a3fd6d641a51f832d93cc6b785931f` |
| Texte distribué voix, et les 2 copies du monorepo | `c5a7bfd096e00608b240c8f7ba4cb7c7e1a14090a3faf8f7c78b99d79a1a2b4e` |
| Manifeste généré comparé au manifeste publié du vault (`99-meta/canon-hashes.json`) | identique, hors `$comment` et `canon_path` |
| `python3 scripts/canon/compute-canon-hashes.py --check` | code 0 |
| Un octet ajouté à une copie, puis `--check` | code 1, « copie différente de sa source » |
| `pytest scripts/canon/test_compute_canon_hashes.py` | 32 réussis |

**Essai à blanc de l'état final** (worktree jetable, rien de poussé) : tête `9c3f79707` + patches 01
et 02 + extrait d'ownership, puis les étapes de `resync-pr.sh` rejouées.

| Étape | Résultat |
|---|---|
| `git apply --check` puis `apply` des patches 01 et 02 | 4 fichiers, 456 insertions |
| `audit:inventory`, deux passes | déterministe |
| `registry:heal`, `audit:cleanup-candidates` | 5 projections régénérées (`REPO_MAP.md`, `canonical.json`, `runtime-entrypoints.json`, 2 fichiers `pr-8`) |
| `audit:cleanup-candidates:check`, `registry:validate-invariants`, `audit:inventory:check` | verts (6 invariants) |
| Arbre après régénération | propre |
| `check-new-files.js --base origin/main` | 9 nouveaux fichiers, aucun refus |
| `merge-circuit.mjs` | circuit **élevé** : générateur et tests en `RISK_HIGH`, `.spec/00-canon/` et `.github/` en zone CODEOWNERS |
| `--check` et pytest sur l'arbre final | code 0 ; 32 réussis |

Sans l'extrait d'ownership, les 3 fichiers de `.spec/00-canon/canon-distribution/` sont
`missing_both` (porte Block-new rouge), et le générateur reste en circuit faible sous `scripts/**`.

**Chaîne du 09, relevé avant l'étape** (UTC, 2026-11-16) : `agent-exit-contract-hash` du monorepo
vert à 21:33:39 (run 43961310632) ; `marketing-voice-hash` et `canon-sync` verts à 20:52:27 ; wiki
vert à 21:05:15 (run 43956435734) ; raw vert à 21:05:18 (run 43956447477) ; `jcs-parity` vert à
03:48:07 ; `knowledge-jobs.service` code 0, prochain passage le 2026-11-17 à 08:00 CET.

### Ce que l'étape ne fait pas

- **Aucun consommateur n'est repointé.** Les workflows du monorepo, du wiki et de raw lisent encore le
  manifeste du vault. Les deux manifestes donnent les mêmes empreintes : la chaîne du 09 ne change pas.
  Le repointage est l'objet des étapes 2 à 5.
- Le mode `json_jcs` et son vecteur de parité ne sont pas portés (étape 7). Aucun canon enregistré ne
  l'utilise ; le générateur refuse tout `hash_mode` autre que `text_sha256`.
- `cron-sync-canon-mirrors.sh` du vault n'est pas porté : `--write` écrit les copies du monorepo, et
  celles du wiki et de raw se mettent à jour par une PR dans leur dépôt.
- Le texte de l'AEC et de la voix de marque est inchangé. Deux écarts relevés, non corrigés ici car
  toute retouche changerait `canon_sha256` : le frontmatter de la voix dit `version: 1.0.0` quand le
  registre dit 1.0.1 ; sa section « Distribution canonique » nomme encore le vault. À traiter à
  l'étape 8, par une PR de source.
- Aucun check requis n'est ajouté à la protection de `main` : décision de Marwane.

### État

| État | Où en est l'étape 1 |
|---|---|
| Implémenté | oui : générateur, tests, patches, extrait |
| Intégré | non : PR #2112 en brouillon, les fichiers réservés ne sont pas sur la branche |
| Vérifié | en local et à blanc seulement ; la CI de l'état final n'a pas tourné |
| Opérationnel | non : rien ne lit encore ces sources |
| Bloqué | par les gestes de Marwane ci-dessous |

La PR reste en brouillon jusque-là : telle que poussée par l'agent, elle ne contient que des
fichiers de circuit faible et serait fusionnée sans ses sources.

### Gestes de Marwane — un seul bloc (poste, PowerShell 32 bits)

**Ce bloc n'a pas été exécuté par l'agent** : le DEV n'a pas de PowerShell. Ses étapes Git et Node
ont été rejouées à blanc sur le DEV (tableau ci-dessus).

Ordre : (1) patches 01 et 02 poussés depuis le poste, dans un clone neuf ; (2) extrait d'ownership et
régénération par `resync-pr.sh` sur le DEV ; (3) sortie du brouillon ; (4) attente des checks ;
(5) approbation et fusion épinglée sur la tête lue, après confirmation au clavier.

Seule valeur à saisir : `$DEV`, le compte de déploiement de la machine DEV. Son adresse n'est pas
écrite dans ce dépôt public.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc-etape1-canon-distribution-20261116"
  $P1 = "docs/audit/mandat-bc-20261116/patches/01-canon-distribution-sources.patch"
  $P2 = "docs/audit/mandat-bc-20261116/patches/02-canon-distribution-workflow.patch"
  $S1 = "47b6cc9c5ad1ca4f5ec4d5ebea90e3dba27094c20c990b5a4f73653ab3d9b05f"
  $S2 = "60e5e22f37b0099c659374331ce2e8349a8b9b0e6d0e4f09a3fda6c35278f1fe"
  $T = Join-Path $env:TEMP ("bc-etape1-" + (Get-Date -Format "yyyyMMddHHmmss"))

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2112 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }

  gh repo clone $REPO $T -- --depth 1 --branch $BR
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone refuse"; return }
  $H1 = (Get-FileHash -Algorithm SHA256 (Join-Path $T $P1)).Hash.ToLower()
  $H2 = (Get-FileHash -Algorithm SHA256 (Join-Path $T $P2)).Hash.ToLower()
  if ($H1 -ne $S1) { Write-Host ("ARRET : sha256 du patch 01 inattendu : " + $H1); return }
  if ($H2 -ne $S2) { Write-Host ("ARRET : sha256 du patch 02 inattendu : " + $H2); return }
  git -C $T apply --check $P1
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : le patch 01 ne s'applique pas"; return }
  git -C $T apply $P1
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : echec du patch 01"; return }
  git -C $T apply --check $P2
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : le patch 02 ne s'applique pas"; return }
  git -C $T apply $P2
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : echec du patch 02"; return }
  git -C $T add -- .spec/00-canon/canon-distribution .github/workflows/canon-distribution.yml
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add refuse"; return }
  git -C $T commit -m "feat(canon): sources et workflow des canons distribues (mandat BC, etape 1, patches 01 et 02)"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit refuse"; return }
  git -C $T push origin ("HEAD:refs/heads/" + $BR)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }

  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2112 --ownership /home/deploy/resync/ownership-snippet-2112.yaml"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh en echec, rien n'est fusionne"; return }

  gh pr ready 2112 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon refusee"; return }
  $HEAD = (gh pr view 2112 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : tete illisible"; return }
  Write-Host ("Tete a fusionner : " + $HEAD)
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2112 --repo $REPO --json name,state)
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
  $NOW = (gh pr view 2112 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }

  $GO = Read-Host ("Approuver et fusionner la PR 2112 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "Arret demande : rien n'est fusionne"; return }
  gh pr review 2112 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2112 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2112 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
  Start-Sleep -Seconds 60
  gh run list --repo $REPO --workflow canon-distribution.yml --limit 3
  Remove-Item -Recurse -Force $T
}
```

Points d'attention :

- En circuit élevé, le check « 🚦 Circuit de fusion » reste rouge tant que l'approbation de
  l'owner manque sur la tête (relevé sur #2113, run 43976631766, 16 nov. 23:11 UTC). Le bloc
  attend donc les autres checks, demande l'accord, approuve, attend que ce check passe au vert,
  puis fusionne. Il lit les checks par `gh pr checks --json` : `gh` 2.50 ou plus récent.
- `resync-pr.sh` pousse depuis le DEV, dont le jeton ne pousse pas de fichier de workflow. Ses commits
  (ownership, projections) n'en touchent aucun. Mais si `main` reçoit entre-temps un changement de
  `.github/workflows/`, la fusion de `main` dans la branche le porte, et le push du DEV est refusé.
  Dans ce cas : fusionner `main` dans la branche depuis le poste, puis relancer la ligne `resync-pr.sh`.
- Le premier run de `canon-distribution.yml` est celui de la PR elle-même, après le push du poste :
  c'est la preuve de CI de l'état final. La dernière ligne du bloc montre le run sur `main`.
- Retour arrière : `git revert` du commit de fusion. Rien ne lit encore ces fichiers.

Après la fusion, l'agent vérifie la chaîne du 09 sur ses runs réels et ouvre l'étape 2.
