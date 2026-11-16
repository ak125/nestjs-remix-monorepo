# Mandat BC — étape 6 : la politique de fusion quitte le vault

Plan : `docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`, étape 6.
PR : #2113, branche `governance/mandat-bc-etape6-merge-perimeter-policy-20261116`.
Relevés du 16 novembre 2026, heures UTC.

## Ce que fait l'étape

La porte de périmètre de fusion (`scripts/ci/merge-perimeter-gate.mjs`) lisait sa
politique dans `ledger/policies/merge-perimeter.v1.json`, sur `main` du vault. Une fois
le vault archivé, cette politique `active` ne pourrait plus être modifiée ni suspendue.

La politique vit désormais dans le monorepo, à
`.spec/00-canon/repository-registry/merge-perimeter.v1.json`. La porte la lit sur la
tête de `main`, jamais sur la tête de la PR évaluée.

| Fichier | Changement | Qui le pose |
|---|---|---|
| `scripts/ci/merge-perimeter-gate.mjs` | `readPolicy` lit le monorepo ; `validatePolicy` refuse une politique dont `deny_paths` ne couvre pas son propre chemin | l'agent |
| `scripts/ci/merge-perimeter-gate.test.mjs` | 3 tests ajoutés, 34 au total | l'agent |
| `patches/03-merge-perimeter-policy.patch` | fichier de politique et commentaire d'`audit.yml` | Marwane |
| projections générées | `audit/module-boundaries.json`, `audit/registry/{canonical,files}.json`, `REPO_MAP.md`, 2 fichiers `pr-8` | `resync-pr.sh` |

Le plan demandait aussi une entrée owner-only d'`ownership.yaml` et une ligne CODEOWNERS.
L'emplacement choisi les rend inutiles : il est déjà couvert par
`.spec/00-canon/repository-registry/**` (D15, `@ak125`, `risk: high`) et par
`/.spec/00-canon/ @ak125`. `deny_paths` contenait déjà `.spec/**` ; le chemin exact y
est ajouté en clair, et `validatePolicy` rend cette couverture obligatoire.

## Empreintes

| Objet | sha256 |
|---|---|
| politique du vault, `main` `b2e712791bee17c192acc5d04ed2ee1bd88488f1` | `5ea3089f743606ea50d38f8aefdace8ee38c10f62eaf6319c1b9a61834924bdc` |
| `patches/03-merge-perimeter-policy.patch` | `b76d2407880d704a116fafabce5a9076e4b1dd69371507995d82026ffe7697a7` |
| `/home/deploy/resync/merge-perimeter.sh.bc6` (hors dépôt) | `067b9e06a7bfbfc982baa9e35b8a584b830639bdb162e09eeed426576601e219` |

La politique du monorepo est celle du vault, plus une ligne en tête de `deny_paths` :
`".spec/00-canon/repository-registry/merge-perimeter.v1.json",`.

## Preuves

- **Tests** : `node --test scripts/ci/merge-perimeter-gate.test.mjs`, 34 réussis avec le
  patch 03. Sans lui, 1 échec (`ENOENT` sur le fichier de politique) : la PR reste en
  brouillon jusqu'au push de Marwane.
- **PR documentaire** (23:00) : `--dry-run --policy-file` sur #1938, aucun refus de
  fichier. Les refus restants tiennent à l'état de la PR : `DRAFT`, `NO_HUMAN_ASSIGNEE`,
  `MERGE_STATE_NOT_CLEAN`, `REVIEW_MISSING`.
- **PR hors périmètre** (23:00) : #2112 refusée `DENY_PATH` sur `scripts/canon/**`.
- **PR qui modifie la politique** : refusée `DENY_PATH`, renommage compris. Preuve par
  test sur le fichier réel ; aucune PR ouverte ne modifie ce fichier avant le patch 03.
  Après le push du patch, la PR #2113 est elle-même ce cas.
- **État final à blanc** (23:06, worktree jetable, rien de poussé) : patch 03 appliqué,
  étapes de `resync-pr.sh` rejouées. Inventaire déterministe ;
  `audit:cleanup-candidates:check`, `registry:validate-invariants` (6 invariants,
  avertissement I3 déjà présent sur `main`) et `audit:inventory:check` verts ; arbre
  propre ; `check-new-files.js` : 2 nouveaux fichiers, aucun refus.
- **Comptage rejoué** : fichiers de `.github`, `scripts`, `.husky`, `backend/src`,
  `packages` et `frontend/app` qui nomment `governance-vault` ou `ledger/policies` :
  45 sur `main`, 44 sur la branche.

## Limites

- Aucune PR ouverte n'est admise par la porte à ce jour : les PR documentaires ouvertes
  sont en brouillon et sans revue. « PR documentaire admise » se limite donc au
  périmètre de fichiers de #1938.
- La lecture sur `main` ne se prouve qu'après la fusion, par
  `merge-perimeter.sh 1938 --dry-run` (dernière ligne du bloc).
- Le texte de la politique n'est pas réécrit : `source_adr` et les notes `evaluation`
  citent encore ADR-124.
- La PR #2079 (ouverte) modifie les deux mêmes fichiers : la seconde fusionnée devra se
  rebaser. Son sort relève du tri du complément BC-2.
- Le journal (P20) n'est pas modifié ici.
- Chaîne du 09 : cette étape ne touche aucun de ses fichiers.

## État

| État | Constat |
|---|---|
| Implémenté | oui : porte, tests et patch 03 sur la branche |
| Intégré | non : PR #2113 en brouillon |
| Vérifié | en local et à blanc ; la CI de l'état final n'a pas tourné |
| Opérationnel | non : la porte de `main` lit encore le vault |
| Bloqué | par les gestes de Marwane ci-dessous |

## Gestes de Marwane

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV
n'a pas de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit
pas dans ce dépôt public.

Le bloc pousse le patch 03 depuis le poste (le jeton du DEV ne pousse pas un fichier de
`.github/workflows/`), régénère les projections sur le DEV, attend les checks, demande
l'accord, fusionne sur la tête relevée, puis installe le commentaire corrigé du lanceur
et joue la porte à blanc depuis `main`.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"
  $BR = "governance/mandat-bc-etape6-merge-perimeter-policy-20261116"
  $P3 = "docs/audit/mandat-bc-20261116/patches/03-merge-perimeter-policy.patch"
  $S3 = "b76d2407880d704a116fafabce5a9076e4b1dd69371507995d82026ffe7697a7"
  $T = Join-Path $env:TEMP ("bc-etape6-" + (Get-Date -Format "yyyyMMddHHmmss"))

  gh repo clone $REPO $T -- --depth 1 --branch $BR
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : clone refuse"; return }
  $H3 = (Get-FileHash -Algorithm SHA256 (Join-Path $T $P3)).Hash.ToLower()
  if ($H3 -ne $S3) { Write-Host ("ARRET : empreinte du patch 03 = " + $H3); return }
  git -C $T apply --check $P3
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : le patch 03 ne s'applique pas"; return }
  git -C $T apply $P3
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : application du patch 03"; return }
  git -C $T add -- .spec/00-canon/repository-registry/merge-perimeter.v1.json .github/workflows/audit.yml
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : git add"; return }
  git -C $T commit -m "feat(ci): politique de la porte de fusion dans le monorepo (mandat BC, etape 6, patch 03)"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commit"; return }
  git -C $T push origin ("HEAD:refs/heads/" + $BR)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : push refuse"; return }

  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2113"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }

  gh pr ready 2113 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2113 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  gh pr checks 2113 --repo $REPO --watch --interval 30
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : un check est en echec"; return }
  $NOW = (gh pr view 2113 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }

  $GO = Read-Host ("Approuver et fusionner la PR 2113 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2113 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  gh pr merge 2113 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }

  Start-Sleep -Seconds 30
  & $SSH $DEV "cp /home/deploy/resync/merge-perimeter.sh.bc6 /home/deploy/resync/merge-perimeter.sh"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : commentaire du lanceur non installe"; return }
  Write-Host "Essai a blanc de la porte depuis main. Attendu : DRAFT, NO_HUMAN_ASSIGNEE,"
  Write-Host "MERGE_STATE_NOT_CLEAN, REVIEW_MISSING ; aucun refus de politique ni de fichier."
  & $SSH $DEV "bash /home/deploy/resync/merge-perimeter.sh 1938 --dry-run"
  Remove-Item -Recurse -Force $T
}
```

## Points d'attention

- `resync-pr.sh` pousse depuis le DEV. Si `main` a reçu entre-temps un changement de
  `.github/workflows/`, la fusion de `main` le porte et ce push est refusé. Alors :
  fusionner `main` dans la branche depuis le poste, puis relancer `resync-pr.sh 2113`.
- La dernière commande sort avec le code 1 : c'est le code d'un refus, attendu pour une
  PR en brouillon. Un refus `POLICY_NOT_ACTIVE`, une erreur de lecture ou un refus
  `DENY_PATH` serait une anomalie.
- `merge-perimeter.sh.bc6` ne change que deux lignes de commentaire du lanceur.
- Retour arrière : `git revert` du commit de fusion. La politique du vault reste lisible
  tant que le vault n'est pas archivé.
