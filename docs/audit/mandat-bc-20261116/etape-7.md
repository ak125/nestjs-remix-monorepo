# Mandat BC — étape 7 : les artefacts que l'on lisait dans le vault

Étape 7 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`,
décisions 72 et 73 de l'owner). Constats relevés les 16 et 17 novembre 2026 sur
`main` du monorepo (`3832abfc2`), de l'archive `ak125/governance-vault` (`b2e712791bee`)
et de `ak125/automecanik-raw` (`b097ca48`). Deux PR : monorepo #2120, RAW #81.
Mis à jour le 17 novembre après les décisions 129 et 132 de l'owner (D10 à D14, D9), puis
après le complément BC-6 : le patch 04 contrôle l'empreinte du binaire opa, et le patch 05
passe dans une PR à part, #2136.

## Ce que fait l'étape

| Lecteur du vault | Avant | Après |
|---|---|---|
| Défaut de `R2_OPA_BUNDLE_PATH` (`r2-opa-evaluator.service.ts`) | `/opt/automecanik/governance-vault/dist/policies` | `policies/dist` du dépôt ; politiques, bundles et script relogés |
| Workflow `opa-policy-build.yml` du vault | teste et reconstruit les bundles dans le vault | patch 04 : même contrôle dans le monorepo |
| Workflow `vault-supabase-cost-check.yml` du vault | relève chaque lundi la surface de coût Supabase | patch 05, sorti dans la PR #2136 (D14 : oui, décision 129) : il attend un secret |
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
2. **Recherche du relevé précédent réécrite (patch 05).** Décrit dans
   `etape-7-cout-supabase.md`, avec le patch (PR #2136).
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
| `patches/04-opa-policy-build-workflow.patch` | monorepo, nouveau `.github/workflows/opa-policy-build.yml` | `721ad1e5f156efb1470370b930032ab8b76063a8a9b58192d63b0eeb14bf7602` |
| `patches/06-adr-canon-in-force-workflow.patch` | monorepo, `.github/workflows/vault-canon-exists.yml` | `647dff391b71e31d4191ff38d60f1b635fa051a69c4ec2e1e38f7270c60827fb` |
| `patches/07-raw-jcs-parity-frozen-workflow.patch` | RAW, `.github/workflows/jcs-parity.yml` | `3c81f1aae6a7e18ddb0fdae6333bcf377eccb9d23293c84cff09d0e26ab17ec6` |

Le patch 05 n'est plus dans cette PR : il est dans #2136, aux mêmes octets (sha256
`5144d2f824b23cb1740765f1e196896d4460f1e99480383f37ae517ffedc829e`).

**Binaire opa (patch 04).** Le workflow télécharge `opa_linux_amd64_static` en version
0.69.0 et contrôle son sha256 avant de le rendre exécutable ; un écart arrête le job.
L'empreinte attendue, `c81aa9c1da779d0a8646c837a96d52e1a7040ff562318d9743b8ef51c93b49d6`,
est celle que publie le projet : fichier `opa_linux_amd64_static.sha256` de la release
`v0.69.0` du dépôt `open-policy-agent/opa`
(`https://github.com/open-policy-agent/opa/releases/download/v0.69.0/opa_linux_amd64_static.sha256`),
même valeur sur `https://openpolicyagent.org/downloads/v0.69.0/opa_linux_amd64_static.sha256`.
Les deux ont été lues le 17 novembre. Elle se change avec `OPA_VERSION`, jamais seule.
C'est la seule modification du patch 04 depuis l'empreinte `da6dbd65…` : 7 lignes ajoutées,
aucune retirée.

Vecteur JCS gelé dans RAW (`_scripts/jcs-parity-vector.json`) : sha256
`be12b0c676e1d8bd055abe6f9d9de3e166c57959edc12ac84781911097120dc4`, identique à
`99-meta/jcs-parity-vector.json` de l'archive.

## Preuves

- **Défaut de l'évaluateur** : `jest r2-opa-evaluator.test.ts`, 3 tests verts en local (le
  défaut se résout vers `policies/dist`, `r2-content-write.wasm` y est, la variable
  d'environnement reste prioritaire).
- **Patches 04 et 06** : `git apply --check` sur un export de `origin/main` ; YAML relu par
  un parseur. **Patch 07** : `git apply --check` sur un export de `origin/main` de RAW.
- **Patch 06** : logique jouée contre le journal réel. ADR-031 et ADR-138 : en vigueur.
  ADR-096 : relevée. Un « ADR-13 » fictif n'est pas satisfait par ADR-138. Fichier de
  référence absent ou vide : rc=1. Une ligne qui dit « historique » est exclue.
- **Patch 04** : étape de comparaison jouée à blanc, sans reconstruction. 4 empreintes
  égales ; dérive d'une politique bloquante : rc=1 ; dérive de `r2-runtime-read` : rc=0 et
  un avertissement. Contrôle d'empreinte du binaire : la commande `sha256sum --check
  --strict` jouée sur un fichier factice rend 0 avec la bonne empreinte et 1 avec une
  autre. Le binaire n'a pas été téléchargé sur le DEV : que l'empreinte publiée soit celle
  du fichier servi se prouve au premier run du workflow.
- **JCS** : run 43984017374 de RAW (PR #81, tête `9cfaf8e8`, 17 nov. 00:00:29 UTC), vert.
  Son journal : « OK — parite JCS prouvee contre vecteur gele jcs-parity-vector.json »,
  `expected_sha256 4f20bb60…d818b1`. Suite de tests de RAW : 761 verts en local. C'est la
  preuve de fin du plan pour ce lecteur : un run vert qui montre la nouvelle source.

## Limites

- **`opa test` et la reconstruction des bundles ne sont pas joués sur le DEV.** Le
  téléchargement du binaire opa a été refusé par le contrôle des permissions de la session ;
  il n'a pas été contourné. Ce qui prouve OPA sans le binaire local :
  1. les 16 fichiers relogés (4 politiques, 4 tests, 4 `.wasm`, 4 bundles) ont le même
     blob git que dans l'archive (`b2e712791bee`), relevé rejoué le 17 nov. : 16 sur 16 ;
  2. le dernier commit de l'archive qui les touche est `8ad4bf8` (16 mai 2026) ; sur ce
     commit, le run 25961925593 de « OPA Policy Build & Test » (`push`, `main`,
     12:28:20 UTC) est vert, toutes étapes comprises : `opa test`, reconstruction, et
     comparaison des empreintes entre bundles commités et bundles reconstruits. Ces octets
     ont donc passé les tests et la reconstruction ;
  3. ce que cette preuve ne couvre pas : `policies/build-opa-bundles.sh` (son `DIST_DIR`
     change) et le workflow du patch 04. Leur preuve est le run du workflow sur la PR, une
     fois le patch 04 poussé. Le bloc refuse de fusionner si ce check n'est pas vert.
- **Rien n'est servi.** L'évaluateur n'a pas d'appelant. Reloger les bundles retire une
  lecture du vault ; cela n'active aucune garde d'écriture SEO.
- **Contrôle de coût** : sorti de cette PR. Limites et preuves dans
  `etape-7-cout-supabase.md` (#2136).
- **Patch 07** : il décrit le workflow d'un dépôt privé dans un dépôt public. Il ne contient
  ni secret ni donnée : des commentaires, des chemins déclencheurs et des noms d'étapes.
- **Lecteurs du vault qui restent** après cette étape : aucun dans le code du monorepo (voir le
  comptage) ; #2132 est fusionnée (17 nov. 13:08:30 UTC). Les contrôles AEC et voix de marque sont locaux
  depuis #2125 ; le script de la porte ADR-124 est retiré par #2131 (décision 132). Dans
  RAW et WIKI : le contrôle AEC, que traitent les étapes 3 et 4 (#2126, #2127). Les autres
  mentions du vault dans le code sont des commentaires de provenance.
- **Comptage rejoué** (17 nov., `main` `fc470e41a`, après #2132), preuve de fin du plan :
  `git grep -n "/opt/automecanik/governance-vault" -- scripts .husky backend/src tools` rend
  2 lignes sur `main`, toutes deux de l'évaluateur OPA, que cette PR retire. Après sa
  fusion : 0.

## Questions à l'owner : tranchées (décision 129, 17 nov.)

- **D13 — score des sources d'ADR-096 §D3** : pas maintenant. Le vecteur JCS reste gelé
  dans RAW (#81). S'il est activé un jour, le contrat de poids, le mode `json_jcs` du
  générateur et le vecteur entrent dans le monorepo dans une même PR, puis RAW est repointé.
- **D14 — contrôle hebdomadaire de la surface de coût Supabase** : gardé. Le patch 05 sort à
  part, dans #2136 : il attend un secret que le monorepo n'a pas (BC-6).
- **D10, D11, D12** (posées dans `etape-8.md`) : oui aux trois. Elles sortent dans une PR à
  part, #2132, parce que cette branche est antérieure à #2118 et #2122, qui ont réécrit les
  lignes concernées. #2132 porte son patch réservé 13 (`ownership.yaml`, un commentaire de
  `governance-checks.yml`).

## État

| État | Constat |
|---|---|
| Implémenté | oui : politiques, bundles, script, défaut de l'évaluateur, test, patches 04, 06 et 07 (05 dans #2136) ; vecteur gelé dans RAW |
| Intégré | non : monorepo #2120 et RAW #81 en brouillon |
| Vérifié | JCS : run réel vert. OPA : octets identiques à l'archive, verts dans son dernier run ; script et workflow relogés non joués. Canon : logique jouée à blanc, aucun run dans le monorepo |
| Opérationnel | non : `main` lit encore le vault pour ces lecteurs |
| Bloqué | par les gestes de l'owner ci-dessous |

## Gestes de Marwane

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV
n'a pas de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit
pas dans ce dépôt public.

À lancer depuis le clone `am-patches` du poste. Le bloc vérifie l'empreinte des trois
patches, pousse les patches 04 et 06 dans le monorepo, régénère les projections sur le DEV,
sort la PR du brouillon, attend les checks, exige que le check OPA soit vert, demande
l'accord et enregistre l'approbation. La fusion du monorepo est faite par l'App (circuit
élevé, P20) : le bloc l'attend et ne fusionne pas lui-même. Il applique ensuite le patch 07
à RAW, dans un commit signé avec l'identité et la clé du clone `am-patches`, vérifie que
GitHub reconnaît la signature, attend les checks, demande l'accord et fusionne RAW. Il est
rejouable : il saute un patch déjà appliqué et une PR déjà fusionnée. Il ne touche ni au
secret Supabase ni aux labels du contrôle de coût : c'est le bloc de #2136.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $AM = (git rev-parse --show-toplevel)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lancer ce bloc depuis le clone am-patches du poste"; return }
  $ORI = (git -C $AM remote get-url origin)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : remote origin illisible"; return }
  if ($ORI -notmatch "nestjs-remix-monorepo") { Write-Host "ARRET : ce dossier n'est pas le clone du monorepo qui signe"; return }
  $REPO = "ak125/nestjs-remix-monorepo"
  $RAWREPO = "ak125/automecanik-raw"
  $BR = "governance/mandat-bc-etape7-artefacts-vault-20261116"
  $RAWBR = "governance/mandat-bc-etape7-jcs-gel-20261116"
  $PD = "docs/audit/mandat-bc-20261116/patches/"
  $P4 = @("04-opa-policy-build-workflow.patch", "721ad1e5f156efb1470370b930032ab8b76063a8a9b58192d63b0eeb14bf7602")
  $P6 = @("06-adr-canon-in-force-workflow.patch", "647dff391b71e31d4191ff38d60f1b635fa051a69c4ec2e1e38f7270c60827fb")
  $P7 = @("07-raw-jcs-parity-frozen-workflow.patch", "3c81f1aae6a7e18ddb0fdae6333bcf377eccb9d23293c84cff09d0e26ab17ec6")
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

  $LISTE = @($P4, $P6)

  gh repo clone $REPO $T -- --depth 1 --branch $SRC -c core.autocrlf=false
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone refuse"; return }
  foreach ($P in @($P4, $P6, $P7)) {
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
      git -C $T commit -m "ci: workflows de l'etape 7 de la sortie du vault (mandat BC, patches 04 et 06)"
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

    $GO = Read-Host ("Approuver la PR 2120 sur la tete " + $HEAD + " ? L'App fusionne ensuite. (oui/non)")
    if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
    gh pr review 2120 --repo $REPO --approve
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
    $FUS = $false
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 20
      $STN = (gh pr view 2120 --repo $REPO --json state --jq .state)
      if ($LASTEXITCODE -ne 0) { continue }
      if ($STN -eq "MERGED") { $FUS = $true; break }
      if ($STN -eq "CLOSED") { Write-Host "ARRET : la PR 2120 a ete fermee sans fusion"; return }
    }
    if (-not $FUS) { Write-Host "ARRET : l'App n'a pas fusionne la PR 2120 en 20 minutes ; lire le run du workflow Circuit de fusion"; return }
    Start-Sleep -Seconds 45
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
  $UN = (git -C $AM config --get user.name)
  $UE = (git -C $AM config --get user.email)
  $SK = (git -C $AM config --get user.signingkey)
  if ((-not $UN) -or (-not $UE) -or (-not $SK)) { Write-Host "ARRET : identite ou cle de signature absente du clone am-patches, rien n'est pousse dans RAW"; return }
  $CFG = @("-c", ("user.name=" + $UN), "-c", ("user.email=" + $UE), "-c", ("user.signingkey=" + $SK))
  foreach ($KEY in @("gpg.format", "gpg.program", "gpg.ssh.program")) {
    $VAL = (git -C $AM config --get $KEY)
    if ($VAL) { $CFG += @("-c", ($KEY + "=" + $VAL)) }
  }
  git -C $TR apply --reverse --check $F7 2>$null
  if ($LASTEXITCODE -ne 0) {
    git -C $TR apply --check $F7
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : le patch 07 ne s'applique pas a RAW"; return }
    git -C $TR apply $F7
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : application du patch 07"; return }
    git -C $TR add -- .github/workflows/jcs-parity.yml
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add (RAW)"; return }
    git -C $TR @CFG commit -S -m "ci(jcs): workflow de parite sur le vecteur gele, sans cron ni jeton du vault (mandat BC, etape 7, patch 07)"
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit signe refuse (RAW), rien n'est pousse"; return }
    git -C $TR push origin ("HEAD:refs/heads/" + $RAWBR)
    if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse (RAW)"; return }
  }
  gh pr ready 81 --repo $RAWREPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon (RAW)"; return }
  $RHEAD = (gh pr view 81 --repo $RAWREPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete (RAW)"; return }
  $SIG = (gh api ("repos/" + $RAWREPO + "/commits/" + $RHEAD) --jq .commit.verification.verified)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : signature de la tete de RAW illisible"; return }
  if ($SIG -ne "true") { Write-Host ("ARRET : la tete " + $RHEAD + " de RAW n'est pas verifiee par GitHub, rien n'est fusionne"); return }
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

- En circuit élevé, l'App fusionne après la revue approuvante de l'owner (P20, correctifs
  des circuits sur `main` depuis le 17 nov. 11:47 UTC). Le bloc attend les checks, demande
  l'accord, enregistre l'approbation, puis attend vingt minutes au plus que la PR soit
  fusionnée. Il lit les checks par `gh pr checks --json` : `gh` 2.50 ou plus récent.
- Si le check « OPA Policy: test + build » échoue, rien n'est fusionné. Trois causes
  possibles : un test Rego rouge, un bundle reconstruit qui diffère du bundle committé, ou
  une empreinte du binaire opa qui ne correspond pas. Dans tous les cas, la correction se
  fait sur la branche avant de rejouer le bloc.
- Preuve de fin après le bloc : un run vert de `opa-policy-build.yml` et de
  `vault-canon-exists.yml` sur la PR, et le run `jcs-parity` de RAW. L'agent les relève ensuite.
