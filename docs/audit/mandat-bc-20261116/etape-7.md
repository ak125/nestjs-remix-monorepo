# Mandat BC — étape 7 : les artefacts que l'on lisait dans le vault

Étape 7 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`,
décisions 72 et 73 de l'owner). Constats relevés les 16 et 17 novembre 2026 sur
`main` du monorepo (`3832abfc2`), de l'archive `ak125/governance-vault` (`b2e712791bee`)
et de `ak125/automecanik-raw` (`b097ca48`). Deux PR : monorepo #2120, RAW #81.

## Ce que fait l'étape

| Lecteur du vault | Avant | Après |
|---|---|---|
| Défaut de `R2_OPA_BUNDLE_PATH` (`r2-opa-evaluator.service.ts`) | `/opt/automecanik/governance-vault/dist/policies` | `policies/dist` du dépôt ; politiques, bundles et script relogés |
| Workflow `opa-policy-build.yml` du vault | teste et reconstruit les bundles dans le vault | patch 04 : même contrôle dans le monorepo |
| Workflow `vault-supabase-cost-check.yml` du vault | relève chaque lundi la surface de coût Supabase | patch 05 : repris dans le monorepo, si l'owner le garde (question D14) |
| Workflow `vault-canon-exists.yml` du monorepo | clone le vault et y cherche chaque ADR citée | patch 06 : cherche l'ADR dans le journal des principes et les contrats ; ne lit plus le vault |
| `check-jcs-parity.py` de RAW | lit le vecteur sur `main` du vault | RAW #81 : vecteur gelé en copie locale ; patch 07 pour son workflow |

Les fichiers de `.github/workflows/` sont livrés en patches : le jeton du DEV ne les
pousse pas. Le bloc en fin de document les applique depuis le poste de l'owner.

## Constats avant d'agir

- **OPA.** `r2-opa-evaluator.service.ts` est le seul lecteur d'un bundle (`r2-content-write.wasm`).
  `evaluateContentWrite()` n'a aucun appelant ; `@open-policy-agent/opa-wasm` n'est dans
  aucun `package.json` ; les images ne contiennent pas `policies/`. L'évaluateur refuse
  tout, avant comme après. Derniers runs de `opa-policy-build.yml` dans le vault : 16 mai 2026.
- **Coût Supabase.** En service : run 43828729889 du vault (16 nov. 08:07 UTC), « No drift
  (hash match: e383bd7eab50…) », plan pro, 5 projets, 4 add-ons. Le contrôle a ouvert des
  issues P1 « addon-added » dans le vault (#342, #343, #352, encore ouvertes).
- **Contrôle canon.** Job non requis (`continue-on-error`), absent des 14 checks requis de
  `main`. Il clonait le vault à chaque PR. Le journal cite 40 numéros d'ADR distincts.
- **JCS.** Le contrat `source-score-weights` n'a jamais été enregistré dans `CANONS` du
  vault (entrée commentée) et le générateur de l'étape 1 (#2112) ne porte pas le mode
  `json_jcs`. `source_score.py` de RAW n'est appelé par aucun workflow. Le plan donne deux
  voies : reloger avec le contrat, « sinon le geler explicitement ». Le vecteur est gelé
  (question D13).

## Écarts au plan, assumés

1. **Contrôle canon : l'archive n'est plus lue.** Le plan disait de chercher l'ADR « dans
   le nouveau registre de décisions du monorepo et dans l'archive ». Le patch 06 ne lit que
   le monorepo et change la question : non plus « l'ADR existe-t-elle ? » mais « sa règle
   est-elle en vigueur ? » (reprise par le journal ou par un contrat). Une ADR de l'archive
   citée comme canon sans être reprise donne un avertissement qui propose trois issues :
   citer le principe, reformuler en référence historique, ajouter le principe au journal.
   Le faux « manquant » que craignait le plan disparaît sans lecture du vault. Le nom du
   fichier est conservé (`vault-canon-exists.yml`) : un renommage changerait une projection
   (`audit/runtime-entrypoints.json`) sans rien apporter au contrôle.
2. **Recherche du relevé précédent réécrite (patch 05).** Le workflow du vault lisait les
   100 derniers artefacts du dépôt. Le monorepo en produit 5546 ; les 100 derniers couvrent
   6 heures. La copie telle quelle n'aurait jamais retrouvé le relevé de la semaine
   précédente : chaque run aurait été une « base », sans comparaison. La recherche passe
   par les runs du workflow lui-même. L'étape n'a plus de `continue-on-error` : une API en
   échec arrête le run au lieu de le faire passer pour un premier relevé.
3. **`r2-runtime-read` en rapport seul (patch 04).** Le workflow du vault ne comparait que
   trois politiques ; la quatrième n'a jamais été reconstruite en CI. Sa comparaison émet
   un avertissement, sans bloquer, jusqu'à ce qu'un run montre deux empreintes égales.

## Empreintes

Fichiers relogés, identiques à l'archive (commit `b2e712791bee`) :

| Fichier | sha256 |
|---|---|
| `policies/seo-content/h1-write.rego` | `d726e11dce863fa9f1a1ede4a5cca2039cde3e46b90dbb741780ad7cc0717a29` |
| `policies/seo-content/h1-write_test.rego` | `5f09229617d4e85bf07092fd27bb38b6e7aa776b6baa416872af777c4cafe409` |
| `policies/seo-content/r2-cluster-health.rego` | `d2dba51df123037b59570030a6f29a3697b361195185fef4fe96301d2d526f27` |
| `policies/seo-content/r2-cluster-health_test.rego` | `cb493ce53e3b1c4e8df8720e11d2b935ae37b0e80fb6ad18ffc2a08ad502f8e6` |
| `policies/seo-content/r2-content-write.rego` | `21948f255f69c54eb8183219bac9347d4d54dc949c38ad7bd39f9f1ff69e36af` |
| `policies/seo-content/r2-content-write_test.rego` | `292566ec887eef3e1ed0f265f79de4c23db46e8938936bd00596495127222c66` |
| `policies/seo-content/r2-runtime-read.rego` | `7aaf282341ec38ad0b656c2388ee87bf3d8f09b59fa7d001791b04acea90709a` |
| `policies/seo-content/r2-runtime-read_test.rego` | `6e0e55304cf02267a1553fa058bc1ff500a7c78f1262241f039f1f76ddb8a60f` |
| `policies/dist/h1-write.bundle.tar.gz` | `ec35f678cd43eb54db9a6ab98e092cb6fccca329495f8adead089bdc723474af` |
| `policies/dist/h1-write.wasm` | `ce9ba9f2466f1cce404532dd11fb9cca2fddbaee0087e489e77e4285c8cc91c6` |
| `policies/dist/r2-cluster-health.bundle.tar.gz` | `10bd670a7a2f3dbf6a35d661a682bcc76e26b1af900804ef91bdcea5570fb92c` |
| `policies/dist/r2-cluster-health.wasm` | `e66f857493e2a08b2f77e8a85c9fc8c750ad30dcd3825a0b198b0839d8e759d0` |
| `policies/dist/r2-content-write.bundle.tar.gz` | `802ff726b928242b0c4cb3c0d5bc5f530703cf8b822d5f1b5529dfad4ef7ad5e` |
| `policies/dist/r2-content-write.wasm` | `ecb7c5183e20d65a1a24c4feb35d3329cfa3041ba24ebb7150293e973f128063` |
| `policies/dist/r2-runtime-read.bundle.tar.gz` | `7ee9a0d6ebccd55e001daa3bd0e103971ff4a9380c28ede1890b1d91a127b0eb` |
| `policies/dist/r2-runtime-read.wasm` | `ecc626fd2aac5d4f5ec2e8d6967c8104daf5fe0cd35fa93dc3770474946dbd6a` |
| `policies/build-opa-bundles.sh` (relogé, `DIST_DIR` adapté : diffère de l'archive) | `5f6df6d25851a0c39286baa1729590f81c4e2a628ad2fbeaed671d1fed4f1438` |

Dans l'archive, les politiques sont sous `policies/seo-content/` (même chemin) et les
bundles sous `dist/policies/`. Comparaison rejouée le 17 nov. sur les blobs committés :
16 sur 16 identiques.

Patches :

| Patch | Cible | sha256 |
|---|---|---|
| `patches/04-opa-policy-build-workflow.patch` | monorepo, nouveau `.github/workflows/opa-policy-build.yml` | `da6dbd65728794fc8551e6001955e561c9e3efaa633e26bd75a17a9a99ebf406` |
| `patches/05-supabase-cost-surface-drift-workflow.patch` | monorepo, nouveau `.github/workflows/supabase-cost-surface-drift.yml` | `5144d2f824b23cb1740765f1e196896d4460f1e99480383f37ae517ffedc829e` |
| `patches/06-adr-canon-in-force-workflow.patch` | monorepo, `.github/workflows/vault-canon-exists.yml` | `647dff391b71e31d4191ff38d60f1b635fa051a69c4ec2e1e38f7270c60827fb` |
| `patches/07-raw-jcs-parity-frozen-workflow.patch` | RAW, `.github/workflows/jcs-parity.yml` | `3c81f1aae6a7e18ddb0fdae6333bcf377eccb9d23293c84cff09d0e26ab17ec6` |

Vecteur JCS gelé dans RAW (`_scripts/jcs-parity-vector.json`) : sha256
`be12b0c676e1d8bd055abe6f9d9de3e166c57959edc12ac84781911097120dc4`, identique à
`99-meta/jcs-parity-vector.json` de l'archive.

## Preuves

- **Défaut de l'évaluateur** : `jest r2-opa-evaluator.test.ts`, 3 tests verts en local (le
  défaut se résout vers `policies/dist`, `r2-content-write.wasm` y est, la variable
  d'environnement reste prioritaire).
- **Patches 04, 05, 06** : `git apply --check` sur un export de `origin/main` ; YAML relu par
  un parseur. **Patch 07** : `git apply --check` sur un export de `origin/main` de RAW.
- **Patch 05, recherche du relevé précédent** : jouée sur le DEV contre les runs réels du
  workflow du vault. À partir du run 43828729889, elle retrouve le run 42582980292
  (9 nov. 08:01 UTC) et son artefact ; l'empreinte recalculée commence par `e383bd7eab50`,
  celle du journal du run. Sans relevé : avertissement et rc=0. API en échec : rc=1.
- **Patch 06** : logique jouée contre le journal réel. ADR-031 et ADR-138 : en vigueur.
  ADR-096 : relevée. Un « ADR-13 » fictif n'est pas satisfait par ADR-138. Fichier de
  référence absent ou vide : rc=1. Une ligne qui dit « historique » est exclue.
- **Patch 04** : étape de comparaison jouée à blanc, sans reconstruction. 4 empreintes
  égales ; dérive d'une politique bloquante : rc=1 ; dérive de `r2-runtime-read` : rc=0 et
  un avertissement.
- **JCS** : run 43984017374 de RAW (PR #81, tête `9cfaf8e8`, 17 nov. 00:00:29 UTC), vert.
  Son journal : « OK — parite JCS prouvee contre vecteur gele jcs-parity-vector.json »,
  `expected_sha256 4f20bb60…d818b1`. Suite de tests de RAW : 761 verts en local. C'est la
  preuve de fin du plan pour ce lecteur : un run vert qui montre la nouvelle source.

## Limites

- **`opa test` et la reconstruction des bundles ne sont pas joués.** Le téléchargement du
  binaire opa sur le DEV a été refusé par le contrôle des permissions de la session ; il
  n'a pas été contourné. La preuve sera le run du workflow sur la PR, une fois le patch 04
  poussé. Le bloc refuse de fusionner si ce check n'est pas vert sur la tête.
- **Rien n'est servi.** L'évaluateur n'a pas d'appelant. Reloger les bundles retire une
  lecture du vault ; cela n'active aucune garde d'écriture SEO.
- **Contrôle de coût** : le secret `SUPABASE_ACCESS_TOKEN` du monorepo n'est pas lisible
  depuis le DEV (403) ; le bloc le vérifie et le demande s'il manque. Les labels `ops`,
  `cost-surface-drift`, `P1`, `P2` n'existent pas dans le monorepo ; le bloc les crée. Le
  premier run y sera une base, sans comparaison ; la continuité avec le vault se lit sur
  son empreinte (`e383bd7eab50…` si rien n'a changé). L'identifiant de l'organisation
  Supabase reste en clair dans le workflow, comme dans le vault (public). Les artefacts
  d'un dépôt public sont téléchargeables : le relevé publié est la version expurgée, la
  même que dans le vault.
- **Double exécution** : tant que le vault n'est pas archivé, son workflow de coût tourne
  aussi le lundi. Sans dommage ; une dérive ouvrirait une issue dans chaque dépôt.
- **Patch 07** : il décrit le workflow d'un dépôt privé dans un dépôt public. Il ne contient
  ni secret ni donnée : des commentaires, des chemins déclencheurs et des noms d'étapes.
- **Lecteurs du vault qui restent** après cette étape, hors de son périmètre :
  `check-aec-hash.sh`, `check-marketing-voice-hash.sh`, `sync-canon-from-vault.sh` et leurs
  workflows (étapes 2 à 5, qui attendent #2112) ; `merge-perimeter-gate.mjs` (étape 6,
  #2113) ; `.husky/pre-commit` (étapes 2 et 8, #2118). Dans RAW : `check-aec-hash.sh`
  (étape 3). Les autres mentions du vault dans le code sont des commentaires de provenance.
- **Comptage rejoué** (17 nov. 00:15 UTC), preuve de fin du plan :
  `git grep -n "/opt/automecanik/governance-vault" -- scripts .husky backend/src tools` rend
  8 lignes sur `main` (`aff214ebb`) et 6 sur cette branche. Les 6 qui restent :
  `.husky/pre-commit:32,73`, `scripts/governance/check-verdict-expirations.sh:5,25` et
  `tools/security/attack-simulations/simulate-escalation-hijack.sh:35,136`. Les deux lignes
  retirées sont celles de l'évaluateur OPA.

## Questions à l'owner

- **D13 — Le score des sources d'ADR-096 §D3 sera-t-il activé ?** Réponse proposée : pas
  maintenant. Le vecteur JCS reste gelé dans RAW. S'il est activé, le contrat de poids, le
  mode `json_jcs` du générateur et le vecteur entrent dans le monorepo dans une même PR,
  puis RAW est repointé.
- **D14 — Le contrôle hebdomadaire de la surface de coût Supabase est-il gardé ?** Réponse
  proposée : oui. Il est en service et a signalé trois ajouts d'add-ons. Le bloc pose la
  question ; « non » laisse le patch 05 de côté, et le contrôle s'éteint avec l'archivage.

## État

| État | Constat |
|---|---|
| Implémenté | oui : politiques, bundles, script, défaut de l'évaluateur, test, patches 04 à 07 ; vecteur gelé dans RAW |
| Intégré | non : monorepo #2120 et RAW #81 en brouillon |
| Vérifié | JCS : run réel vert. OPA : comparaison à blanc seulement, `opa test` non joué. Coût et canon : logique jouée à blanc, aucun run dans le monorepo |
| Opérationnel | non : `main` lit encore le vault pour ces quatre lecteurs |
| Bloqué | par les gestes de l'owner ci-dessous |

## Gestes de Marwane

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV
n'a pas de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit
pas dans ce dépôt public.

Le bloc demande si le contrôle de coût est gardé (D14) ; si oui, il vérifie le secret et
crée les labels. Il vérifie l'empreinte des quatre patches, pousse les patches 04 à 06
depuis le poste, régénère les projections sur le DEV, attend les checks, exige que le
check OPA soit vert, demande l'accord, approuve, fusionne sur la tête relevée, puis lance
le contrôle de coût. Il applique ensuite le patch 07 à RAW, attend ses checks, demande
l'accord et fusionne. Il est rejouable : il saute un patch déjà appliqué et une PR déjà
fusionnée.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $RAWREPO = "ak125/automecanik-raw"
  $BR = "governance/mandat-bc-etape7-artefacts-vault-20261116"
  $RAWBR = "governance/mandat-bc-etape7-jcs-gel-20261116"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $P4 = @("04-opa-policy-build-workflow.patch", "da6dbd65728794fc8551e6001955e561c9e3efaa633e26bd75a17a9a99ebf406")
  $P5 = @("05-supabase-cost-surface-drift-workflow.patch", "5144d2f824b23cb1740765f1e196896d4460f1e99480383f37ae517ffedc829e")
  $P6 = @("06-adr-canon-in-force-workflow.patch", "647dff391b71e31d4191ff38d60f1b635fa051a69c4ec2e1e38f7270c60827fb")
  $P7 = @("07-raw-jcs-parity-frozen-workflow.patch", "3c81f1aae6a7e18ddb0fdae6333bcf377eccb9d23293c84cff09d0e26ab17ec6")
  $WF = "supabase-cost-surface-drift.yml"
  $STAMP = (Get-Date -Format "yyyyMMddHHmmss")
  $T = Join-Path $env:TEMP ("bc-etape7-" + $STAMP)
  $TR = Join-Path $env:TEMP ("bc-etape7-raw-" + $STAMP)

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2120 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $ST = (gh pr view 2120 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2120 illisible, rien n'est modifie"; return }
  if ($ST -eq "CLOSED") { Write-Host "ARRET : la PR 2120 est fermee sans fusion, rien n'est modifie"; return }
  $SRC = $BR
  if ($ST -eq "MERGED") { $SRC = "main"; Write-Host "PR 2120 deja fusionnee : partie monorepo sautee" }

  $COUT = Read-Host "Reprendre le controle de cout Supabase dans le monorepo ? (oui/non)"
  $LISTE = @($P4, $P6)
  if ($COUT -eq "oui") {
    $LISTE = @($P4, $P5, $P6)
    $SEC = @(gh secret list --repo $REPO --json name --jq '.[].name')
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : secrets illisibles, rien n'est modifie"; return }
    if ($SEC -notcontains "SUPABASE_ACCESS_TOKEN") {
      Write-Host "Le secret SUPABASE_ACCESS_TOKEN manque dans le monorepo."
      Write-Host "Coller un jeton Supabase en lecture seule (organisations et projets)."
      gh secret set SUPABASE_ACCESS_TOKEN --repo $REPO
      if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : secret non cree, rien d'autre n'est modifie"; return }
    }
    gh label create ops --repo $REPO --color 5319e7 --description "Exploitation" --force
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : label ops"; return }
    gh label create cost-surface-drift --repo $REPO --color d93f0b --description "Derive de la surface de cout Supabase" --force
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : label cost-surface-drift"; return }
    gh label create P1 --repo $REPO --color b60205 --description "Priorite 1" --force
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : label P1"; return }
    gh label create P2 --repo $REPO --color fbca04 --description "Priorite 2" --force
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : label P2"; return }
  }

  gh repo clone $REPO $T -- --depth 1 --branch $SRC -c core.autocrlf=false
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone refuse"; return }
  foreach ($P in @($P4, $P5, $P6, $P7)) {
    $H = (Get-FileHash -Algorithm SHA256 (Join-Path $T ($PD + $P[0]))).Hash.ToLower()
    if ($H -ne $P[1]) { Write-Host ("ARRET : empreinte de " + $P[0] + " = " + $H); return }
  }

  if ($ST -eq "OPEN") {
    foreach ($P in $LISTE) {
      git -C $T apply --reverse --check ($PD + $P[0]) 2>$null
      if ($LASTEXITCODE -eq 0) { Write-Host ("Deja applique : " + $P[0]); continue }
      git -C $T apply --check ($PD + $P[0])
      if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : ne s'applique pas : " + $P[0]); return }
      git -C $T apply ($PD + $P[0])
      if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : application de " + $P[0]); return }
    }
    git -C $T add -- .github/workflows
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add"; return }
    git -C $T diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      git -C $T commit -m "ci: workflows de l'etape 7 de la sortie du vault (mandat BC, patches 04 a 06)"
      if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
      git -C $T push origin ("HEAD:refs/heads/" + $BR)
      if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }
    }

    & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2120"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }

    gh pr ready 2120 --repo $REPO
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
    $HEAD = (gh pr view 2120 --repo $REPO --json headRefOid --jq .headRefOid)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
    Start-Sleep -Seconds 120
    $VERT = $false
    for ($i = 0; $i -lt 90; $i++) {
      $RAW = (gh pr checks 2120 --repo $REPO --json name,state)
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
    $NOW = (gh pr view 2120 --repo $REPO --json headRefOid --jq .headRefOid)
    if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }
    $OPA = @($J | Where-Object { ($_.name -like "*OPA Policy*") -and ($_.state -eq "SUCCESS") })
    if ($OPA.Count -eq 0) { Write-Host "ARRET : le check OPA Policy n'est pas vert sur la tete, rien n'est fusionne"; return }

    $GO = Read-Host ("Approuver et fusionner la PR 2120 sur la tete " + $HEAD + " ? (oui/non)")
    if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
    gh pr review 2120 --repo $REPO --approve
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
    $CIRCOK = $false
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Seconds 15
      $RAW = (gh pr checks 2120 --repo $REPO --json name,state)
      if (-not $RAW) { continue }
      $J = (($RAW -join "") | ConvertFrom-Json)
      $C = @($J | Where-Object { $_.name -like $CIRC })
      $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
      if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
    }
    if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
    gh pr merge 2120 --repo $REPO --squash --match-head-commit $HEAD
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
    Start-Sleep -Seconds 45
  }

  if ($COUT -eq "oui") {
    gh workflow run $WF --repo $REPO
    if ($LASTEXITCODE -ne 0) {
      Write-Host "A REFAIRE : lancement du controle de cout refuse (la suite continue)"
    } else {
      Start-Sleep -Seconds 90
      Write-Host "Dernier run du controle de cout (attendu : completed success ; premier releve = base) :"
      gh run list --workflow $WF --repo $REPO --limit 1
    }
  }

  $RST = (gh pr view 81 --repo $RAWREPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 81 de RAW illisible"; return }
  if ($RST -ne "OPEN") { Write-Host ("PR 81 de RAW : " + $RST + ", rien a faire dans RAW"); Remove-Item -Recurse -Force $T; return }
  $env:GIT_LFS_SKIP_SMUDGE = "1"
  gh repo clone $RAWREPO $TR -- --depth 1 --branch $RAWBR -c core.autocrlf=false
  $RC = $LASTEXITCODE
  Remove-Item Env:GIT_LFS_SKIP_SMUDGE
  if ($RC -ne 0) { Write-Host "ARRET : clone de RAW refuse"; return }
  $F7 = (Join-Path $T ($PD + $P7[0]))
  git -C $TR apply --reverse --check $F7 2>$null
  if ($LASTEXITCODE -ne 0) {
    git -C $TR apply --check $F7
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : le patch 07 ne s'applique pas a RAW"; return }
    git -C $TR apply $F7
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : application du patch 07"; return }
    git -C $TR add -- .github/workflows/jcs-parity.yml
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add (RAW)"; return }
    git -C $TR commit -m "ci(jcs): workflow de parite sur le vecteur gele, sans cron ni jeton du vault (mandat BC, etape 7, patch 07)"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit (RAW)"; return }
    git -C $TR push origin ("HEAD:refs/heads/" + $RAWBR)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse (RAW)"; return }
  }
  gh pr ready 81 --repo $RAWREPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon (RAW)"; return }
  $RHEAD = (gh pr view 81 --repo $RAWREPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete (RAW)"; return }
  Start-Sleep -Seconds 60
  $RVERT = $false
  for ($i = 0; $i -lt 40; $i++) {
    $RAW = (gh pr checks 81 --repo $RAWREPO --json name,state)
    if (-not $RAW) { Write-Host "ARRET : checks de RAW illisibles, rien n'est fusionne dans RAW"; return }
    $J = @((($RAW -join "") | ConvertFrom-Json))
    $BAD = @($J | Where-Object { ($OKS -notcontains $_.state) -and ($WAITS -notcontains $_.state) })
    $PEND = @($J | Where-Object { $WAITS -contains $_.state })
    $PAR = @($J | Where-Object { ($_.name -eq "parity") -and ($_.state -eq "SUCCESS") })
    if ($BAD.Count -gt 0) {
      $BAD | ForEach-Object { Write-Host ("  " + $_.state + " : " + $_.name) }
      Write-Host "ARRET : un check de RAW est en echec, rien n'est fusionne dans RAW"; return
    }
    if (($PEND.Count -eq 0) -and ($PAR.Count -gt 0) -and ($J.Count -ge 3)) { $RVERT = $true; break }
    Write-Host ("Checks de RAW en cours : " + $PEND.Count)
    Start-Sleep -Seconds 30
  }
  if (-not $RVERT) { Write-Host "ARRET : checks de RAW non termines apres 20 minutes"; return }
  $RNOW = (gh pr view 81 --repo $RAWREPO --json headRefOid --jq .headRefOid)
  if ($RNOW -ne $RHEAD) { Write-Host ("ARRET : la tete de RAW a change : " + $RNOW); return }
  $GO = Read-Host ("Fusionner la PR 81 de RAW sur la tete " + $RHEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne pour RAW"; return }
  gh pr merge 81 --repo $RAWREPO --squash --match-head-commit $RHEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion de RAW refusee"; return }
  Remove-Item -Recurse -Force $T
  Remove-Item -Recurse -Force $TR
  Write-Host "Etape 7 fusionnee dans le monorepo et dans RAW."
}
```

## Points d'attention

- En circuit élevé, le check « 🚦 Circuit de fusion » reste rouge tant que l'approbation de
  l'owner manque sur la tête. Le bloc attend les autres checks, demande l'accord, approuve,
  attend que ce check passe au vert, puis fusionne. Il lit les checks par
  `gh pr checks --json` : `gh` 2.50 ou plus récent.
- Si le check « OPA Policy: test + build » échoue, rien n'est fusionné. Deux causes
  possibles : un test Rego rouge, ou un bundle reconstruit qui diffère du bundle committé.
  Dans les deux cas, la correction se fait sur la branche avant de rejouer le bloc.
- `gh secret set` demande la valeur au clavier : elle n'entre ni dans le bloc ni dans
  l'historique. Le jeton attendu est un jeton personnel Supabase en lecture seule.
- Preuve de fin après le bloc : un run vert de `opa-policy-build.yml` et de
  `vault-canon-exists.yml` sur la PR, un run vert de `supabase-cost-surface-drift.yml`
  lancé depuis `main`, et le run `jcs-parity` de RAW. L'agent les relève ensuite.
