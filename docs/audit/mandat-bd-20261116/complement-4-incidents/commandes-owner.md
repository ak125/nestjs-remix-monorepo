# Mandat BD, complément n° 4 — geste de l'owner

Bloc pour le poste (`C:\Users\Marwane\am-patches`, Windows PowerShell 5.1). Il est en ASCII, sans
`&&`, s'arrête au premier échec et se colle d'un seul tenant. **Il n'a pas été exécuté sur le
DEV** : PowerShell n'y est pas installé. Les lectures de vérification sont en `gh` et peuvent être
faites par un agent.

## 1. Pousser le gabarit, le workflow et le test

Préalable : la PR du complément n° 4 est fusionnée. Le `.patch` et le script
`scripts/ci/incident-issue-gate.mjs` sont alors dans `main`. Sans le script, le test du patch
échoue (`ERR_MODULE_NOT_FOUND`).

```powershell
& {
  $R = 'C:\Users\Marwane\am-patches'
  $D = Join-Path $R 'docs\audit\mandat-bd-20261116\complement-4-incidents\patches'
  $B = 'feat/fiche-incident-gabarit-workflow-bd4'
  $M = 'feat(ci): fiche d incident, gabarit, workflow de fermeture controlee et test (mandat BD, complement 4)'
  $L = @(
    @('01-fiche-incident-gabarit-workflow-test.patch', 'aa43dfa4c402984e698824dc0923957e8b34d76dfbc0d59f74a590ffa67f5a94')
  )
  git -C $R fetch origin
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : fetch'; return }
  git -C $R switch -c $B origin/main
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : switch'; return }
  if (-not (Test-Path -LiteralPath (Join-Path $R 'scripts\ci\incident-issue-gate.mjs'))) { Write-Host 'ARRET : script absent de main : la PR du complement 4 n est pas fusionnee'; return }
  foreach ($e in $L) {
    $P = Join-Path $D $e[0]
    if (-not (Test-Path -LiteralPath $P)) { Write-Host ('ARRET : absent : ' + $e[0]); return }
    $h = (Get-FileHash -Algorithm SHA256 -LiteralPath $P).Hash.ToLower()
    if ($h -ne $e[1]) { Write-Host ('ARRET : sha256 different : ' + $e[0]); return }
    git -C $R apply --index --check $P
    if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : apply --check : ' + $e[0]); return }
    git -C $R apply --index $P
    if ($LASTEXITCODE -ne 0) { Write-Host ('ARRET : apply : ' + $e[0]); return }
  }
  git -C $R commit -m $M -- .github/ISSUE_TEMPLATE/incident.yml .github/workflows/incident-issue-gate.yml .github/workflows/audit.yml scripts/ci/incident-issue-gate.test.mjs
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : commit'; return }
  git -C $R push -u origin $B
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : push'; return }
  Write-Host ('OK : branche poussee : ' + $B)
}
```

Si le bloc s'arrête sur `apply --check`, `audit.yml` a changé depuis la base du patch
(`a9bd755d6`) : le patch est à refaire par une session, avec une nouvelle empreinte.

Ouverture de la PR, au choix :

- **par une session agent** (recommandé) : l'auteur est alors le compte des agents, et l'owner peut
  approuver la tête ;
- **du poste**, par le bloc ci-dessous, puis un agent pose la section DoD. L'auteur est `ak125`,
  qui ne peut pas approuver sa propre PR.

```powershell
& {
  gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/fiche-incident-gabarit-workflow-bd4 --title 'feat(ci): fiche d incident, gabarit, workflow de fermeture controlee et test (mandat BD, complement 4)' --body 'Patch du dossier docs/audit/mandat-bd-20261116/complement-4-incidents.'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : gh pr create'; return }
  Write-Host 'OK : PR ouverte'
}
```

La PR est en circuit élevé (`.github/workflows/**`). La fusion reste un geste de l'owner.

## 2. Vérifications

Sur la PR du patch, le job « 🛡️ Deterministic gates » de `audit.yml` doit lancer l'étape
« 🧯 Incident issue gate » : 64 cas verts.

Après la fusion, un essai à blanc, qui ne rouvre et ne commente rien. Le lancement demande un
compte autorisé à lancer un workflow ; le jeton du DEV ne l'est pas.

```bash
gh workflow run incident-issue-gate.yml -R ak125/nestjs-remix-monorepo -f dry_run=true
gh run list -R ak125/nestjs-remix-monorepo --workflow incident-issue-gate.yml --limit 3
gh run view <id> -R ak125/nestjs-remix-monorepo --log | grep "fiche(s) lue(s)"
```

Résultat attendu au 17 novembre 2026 : `0 fiche(s) lue(s), 0 à rouvrir (essai à blanc, rien n'est
écrit).` Aucune issue fermée ne porte le label `incident`.

Le gabarit se lit à l'adresse `https://github.com/ak125/nestjs-remix-monorepo/issues/new/choose`.
Son rendu n'a pas été vu : le fichier n'existe pas encore sur `main`.

La règle atteint L3 à la première fiche réelle fermée sans sa troisième rubrique et rouverte par
le workflow, ou fermée avec un lien admis et laissée fermée.

## 3. Retour arrière

Une PR de revert du commit du patch retire le gabarit, le workflow, le test et son étape. Le
script reste dans le dépôt, sans déclencheur. Une issue rouverte par le workflow se referme à la
main ; son commentaire reste.
