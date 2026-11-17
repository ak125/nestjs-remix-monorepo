# Mandat BH — gestes de l'owner

Blocs pour le poste (`C:\Users\Marwane\am-patches`, Windows PowerShell 5.1). Chaque bloc est en
ASCII, sans `&&`, s'arrête au premier échec et se colle d'un seul tenant. **Aucun n'a été exécuté
sur le DEV** : PowerShell n'y est pas installé. Les lectures de vérification sont en `gh` et
peuvent être faites par un agent.

Ordre : §1, puis la PR d'essai (`plan-preuve-circuit-moyen.md`), puis §3 sur un nouveau oui, puis §2.

## 1. Pousser le correctif 01

Préalable : la PR de documents du mandat BH est fusionnée (les `.patch` sont alors dans `main`).

```powershell
& {
  $R = 'C:\Users\Marwane\am-patches'
  $D = Join-Path $R 'docs\audit\mandat-bh-20261117\patches'
  $B = 'fix/merge-circuits-bh-01-job-jamais-saute'
  $M = 'fix(ci): circuit de fusion jamais saute, desarmement relu (mandat BH, correctif 01)'
  $L = @(
    @('01-job-jamais-saute-desarmement-verifie.patch', 'bbbc06c1701f91ac4f1305551f019f990150d22d5db71853ae36e65bf23589e5')
  )
  git -C $R fetch origin
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : fetch'; return }
  git -C $R switch -c $B origin/main
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : switch'; return }
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
  git -C $R commit -m $M -- .github/workflows/merge-circuits.yml scripts/ci/merge-circuit.test.mjs
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : commit'; return }
  git -C $R push -u origin $B
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : push'; return }
  Write-Host ('OK : branche poussee : ' + $B)
}
```

Ouverture de la PR, au choix :

- **par une session agent** (recommandé) : l'auteur est alors le compte des agents, et l'owner peut
  approuver la tête. Le check `🚦 Circuit de fusion` passe au vert après l'approbation. Que le compte
  des agents puisse ouvrir une PR sur une branche qui modifie un workflow reste à constater ;
- **du poste**, par le bloc ci-dessous, puis un agent pose la section DoD. L'auteur est `ak125`,
  qui ne peut pas approuver sa propre PR : le check du circuit reste rouge. Ce chemin ne tient que
  tant que le contrôle n'est pas requis.

```powershell
& {
  gh pr create --repo ak125/nestjs-remix-monorepo --base main --head fix/merge-circuits-bh-01-job-jamais-saute --title 'fix(ci): circuit de fusion jamais saute, desarmement relu (mandat BH, correctif 01)' --body 'Correctif 01 du dossier docs/audit/mandat-bh-20261117.'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : gh pr create'; return }
  Write-Host 'OK : PR ouverte'
}
```

La PR est en circuit élevé (`.github/workflows/**`). La fusion reste un geste de l'owner.

Vérification après la fusion, sur la première PR qui suit :

```bash
gh run list -R ak125/nestjs-remix-monorepo --workflow merge-circuits.yml --limit 5
gh run view <id> -R ak125/nestjs-remix-monorepo --json jobs --jq '.jobs[] | {name, conclusion}'
```

Le job `🚦 Circuit de fusion` doit avoir une conclusion `success` ou `failure`, jamais `skipped`.

## 2. Pousser les correctifs 02 et 03 (option A)

Même bloc que le §1, avec ces valeurs. Le reste est identique, sauf la ligne `commit`, qui prend
un fichier de plus.

```powershell
& {
  $R = 'C:\Users\Marwane\am-patches'
  $D = Join-Path $R 'docs\audit\mandat-bh-20261117\patches'
  $B = 'fix/merge-circuits-bh-02-03-circuit-eleve'
  $M = 'feat(ci): circuit eleve, fusion par l App apres approbation de la tete (mandat BH, correctifs 02 et 03)'
  $L = @(
    @('02-circuit-eleve-fusion-par-app.patch', '2e434d554917e8f8d2be7ead5da5604b454c52b269ea43f2f10c5f30f934df36'),
    @('03-relais-armement-apres-revue.patch', 'fb49263c70a0753ba28d9976c56104f8c07dc58d8ce0fd8fd32dc10f49f063e3')
  )
  git -C $R fetch origin
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : fetch'; return }
  git -C $R switch -c $B origin/main
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : switch'; return }
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
  git -C $R commit -m $M -- .github/workflows/merge-circuits.yml .github/workflows/merge-circuits-relais.yml scripts/ci/merge-circuit.test.mjs
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : commit'; return }
  git -C $R push -u origin $B
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : push'; return }
  Write-Host ('OK : branche poussee : ' + $B)
}
```

Pour l'option B (correctif 02 seul) : retirer du tableau `$L` la ligne du correctif 03, et de la
ligne `commit` le fichier `merge-circuits-relais.yml`.

Après la fusion de 03, une session agent régénère `audit/runtime-entrypoints.json`
(`npm run audit:inventory`) dans une PR à part.

Preuve en service, sur la première PR du circuit élevé approuvée par l'owner :

```bash
gh run list -R ak125/nestjs-remix-monorepo --workflow merge-circuits-relais.yml --limit 5
gh api repos/ak125/nestjs-remix-monorepo/pulls/<N> --jq '{auto_merge: (.auto_merge | if . then .enabled_by.login else null end), merged, par: (.merged_by.login // null)}'
```

À constater : le relais part (politique 15133), il trouve la PR par le SHA de tête, le job
`🔐 Relais — fusion automatique (App)` arme, l'App fusionne quand les contrôles requis sont verts.
Puis, sur une PR armée, pousser une tête nouvelle : le check échoue et `auto_merge` revient à `null`.

## 3. Rendre `🚦 Circuit de fusion` requis — préparé, non exécuté

Acte réservé à l'owner, sur un nouveau oui. La commande est celle du §6 d'AR (ajout d'un contexte,
sans toucher au reste de la protection).

### Conditions préalables

- [ ] Correctif 01 fusionné sur `main` ; un run postérieur montre le job `🚦 Circuit de fusion` exécuté.
- [ ] Preuve du circuit moyen faite (`plan-preuve-circuit-moyen.md`, étapes 2 à 6 et 8 conformes).
- [ ] Check présent sur la tête pour les deux événements, et choix de GitHub entre deux checks de
      même nom constaté (étape 7 du plan).
- [ ] Un run du circuit déclenché par une PR Dependabot constaté : étiquette posée, check présent.
- [ ] Conduite arrêtée pour les PR du circuit élevé dont l'auteur est `ak125`, et pour les PR
      ouvertes par un workflow (tableau ci-dessous).
- [ ] Nouveau oui de l'owner.

### Effets, mesurés le 17 novembre 2026 (52 PR ouvertes)

| Population | Effet | Conduite |
|---|---|---|
| PR ouvertes dont la tête n'a pas le check (45 sur 52 à la dernière mesure) | Le contrôle reste « Expected » : fusion bloquée. | Rien à faire en masse. Le check se pose au prochain événement `pull_request_target` : nouvelle tête, mise à jour de branche (le mode strict l'exige de toute façon), prête pour revue, ou fermée puis rouverte. |
| Brouillons (36) | Faible : check vert, rien d'armé. Moyen : rouge, la revue Claude ne tourne pas sur un brouillon. Élevé : rouge jusqu'à l'approbation. | Aucune. Le passage à « prête » relance le circuit. |
| Forks (0 ouverte) | Moyen : rouge, la revue Claude ne tourne pas sur un fork. | Reprendre les commits dans une branche du dépôt, quel que soit le circuit. |
| Dependabot (5 : #1817, #1577, #1576, #1253, #897) | Toutes en circuit élevé : `package-lock.json` et les `package.json` ne sont pas classés, donc élevés. Rouge jusqu'à l'approbation de l'owner sur la tête ; un rebase de Dependabot crée une tête nouvelle et l'approbation est à refaire. | Approuver la tête au moment de fusionner. Classer ces chemins dans `ownership.yaml` serait une décision de l'owner, hors de ce mandat. |
| `dependabot-auto-merge.yml` | Il arme la fusion avec le jeton du run ; le circuit désarme une PR non admise. Les deux workflows agissent sur le même réglage en sens opposés, dans un ordre non garanti. Une fois le contrôle requis, l'ordre ne compte plus : rien ne fusionne sans le check vert. | Workflow non modifié (hors périmètre). Effet signalé. |
| PR du circuit élevé dont l'auteur est `ak125` (15 PR de cet auteur, dont 13 brouillons) | GitHub refuse qu'un compte approuve sa propre PR : le check ne peut pas passer au vert, et la protection s'applique aussi aux administrateurs. | L'owner pousse la branche, la PR est ouverte par le compte des agents, l'owner approuve la tête. Pour une PR existante : la fermer et en rouvrir une du même contenu par le compte des agents. |
| PR ouvertes par un workflow avec le jeton par défaut (`dependency-family-bump.yml` ; 0 ouverte ; `canon-sync.yml` a été retiré par #2125) | Aucun run du circuit n'est créé (constat AR §16 sur #2108, une PR de `canon-sync`) : le contrôle reste « Expected ». | Fermer puis rouvrir la PR depuis un compte humain ou celui des agents crée l'événement ; à constater. Les faire ouvrir par une App est une décision de l'owner. |

Les 14 contrôles requis actuels sont tous épinglés à la source GitHub Actions (`app_id` 15368).
Le bloc vérifie que le quinzième l'est aussi.

### Commande

```powershell
& {
  $Api = 'repos/ak125/nestjs-remix-monorepo/branches/main/protection'
  $Rsc = $Api + '/required_status_checks'
  $T = Join-Path $env:TEMP 'bh-controle-requis'
  New-Item -ItemType Directory -Force -Path $T | Out-Null
  $Avant = Join-Path $T 'protection-main-avant.json'
  $Corps = Join-Path $T 'contexte-circuit.json'
  cmd /c ('gh api ' + $Api + ' > ' + $Avant)
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : lecture de la protection'; return }
  $n1 = gh api $Rsc --jq '.checks | length'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : lecture des controles requis'; return }
  Set-Content -LiteralPath $Corps -Encoding ASCII -Value '{"contexts":["\ud83d\udea6 Circuit de fusion"]}'
  gh api -X POST ($Rsc + '/contexts') --input $Corps
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : ajout refuse, protection inchangee'; return }
  $n2 = gh api $Rsc --jq '.checks | length'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : relecture'; return }
  $s = gh api $Rsc --jq '[.checks[].app_id] | unique | length'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : relecture des sources'; return }
  $a = gh api $Rsc --jq '.checks[0].app_id'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : relecture des sources'; return }
  Write-Host ('Controles requis : ' + $n1 + ' avant, ' + $n2 + ' apres. Sauvegarde : ' + $Avant)
  if ([int]$n2 -ne ([int]$n1 + 1)) { Write-Host 'ATTENTION : le nombre de controles n a pas augmente de 1 : relire la protection'; return }
  if (($s -ne '1') -or ($a -ne '15368')) { Write-Host 'ATTENTION : source du nouveau controle differente de GitHub Actions (15368) : lancer le retour arriere et signaler'; return }
  Write-Host 'OK : controle requis ajoute, source GitHub Actions'
}
```

Le corps de la requête est un fichier JSON en ASCII ; `\ud83d\udea6` y code l'emoji du nom. Vérifié
sur le DEV : ce JSON se décode exactement en le nom du job de `merge-circuits.yml`. La sauvegarde
passe par `cmd /c` pour que la redirection n'altère pas les caractères.

### Retour arrière

```powershell
& {
  $Rsc = 'repos/ak125/nestjs-remix-monorepo/branches/main/protection/required_status_checks'
  $T = Join-Path $env:TEMP 'bh-controle-requis'
  New-Item -ItemType Directory -Force -Path $T | Out-Null
  $Corps = Join-Path $T 'contexte-circuit.json'
  Set-Content -LiteralPath $Corps -Encoding ASCII -Value '{"contexts":["\ud83d\udea6 Circuit de fusion"]}'
  if (-not (Test-Path -LiteralPath $Corps)) { Write-Host 'ARRET : fichier du corps absent'; return }
  gh api -X DELETE ($Rsc + '/contexts') --input $Corps
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : retrait refuse'; return }
  $n = gh api $Rsc --jq '.checks | length'
  if ($LASTEXITCODE -ne 0) { Write-Host 'ARRET : relecture'; return }
  Write-Host ('Controles requis apres retrait : ' + $n)
}
```

Le retrait ne touche que ce contexte. Si l'état d'origine doit être restauré en entier, la voie
est celle du §6 d'AR : `gh api -X PUT` sur la protection, avec un fichier reconstruit de
`protection-main-avant.json`.

Après l'ajout, deux lectures : une PR du circuit faible récente garde son check vert et fusionne
comme avant ; une PR sans check sur sa tête affiche le contrôle en attente.
