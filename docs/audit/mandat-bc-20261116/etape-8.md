# Mandat BC — étape 8 : les textes lus par les agents ne renvoient plus au vault comme source

Plan : `docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`, étape 8.
PR : #2118, branche `governance/mandat-bc-etape8-textes-agents-20261116`.
Relevés du 16 novembre 2026, heures UTC. `main` du monorepo : `0e2d0e7ed`. `main` du vault :
`b2e712791bee17c192acc5d04ed2ee1bd88488f1`.

Cette PR fait la partie de l'étape 8 qui ne dépend ni de l'étape 2 (générateur local des
miroirs) ni de l'étape 7 (bundles OPA). L'étape 8 n'est donc pas terminée : voir « État ».

## Ce que fait la PR

Textes, commentaires et messages seulement. Aucun code exécuté ne change de comportement.

| Fichier | Changement |
|---|---|
| `.claude/skills/governance-vault-ops/SKILL.md` | réécrit en « archive en lecture seule » : lire une ADR, la citer par chemin et SHA, dire si sa règle est encore en vigueur. La préparation de PR vault est retirée. Une section « Miroirs canon (transitoire) » reste jusqu'à l'étape 2. |
| `.spec/00-canon/ai-registry/skills.registry.json` | sortie de `scripts/governance/build-skills-registry.js` : empreinte et métadonnées du skill réécrit. Aucune édition à la main ; même geste que #2069. `resync-pr.sh` ne régénère pas ce fichier. |
| `.husky/pre-commit` (l.54-79) | messages du blocage de `governance-vault/` : le vault est une archive, un principe nouveau va au journal. Le blocage est inchangé. |
| `.claude/governance/guard-hierarchy.yaml` | L4 et ajout d'une garde L3/L4 : « un principe écrit au journal, par PR » à la place de « une ADR dans le vault ». Clés renommées (`requires_journal_principle`, `review_label`) ; aucun code ne les lit. |
| `.claude/skills/README.md:110`, `backend/.eslintrc.js` (commentaire) | même remplacement |
| `workspaces/marketing/.claude/skills/fafa-persona-canon/SKILL.md:8,81`, `fafa-media-factory/personas/fafa.md:58` | une évolution du persona passe par une PR dédiée du monorepo, sur décision de l'owner |
| `agents/{ceo,cmo,cto,rag-lead,seo-content,seo-qa}/AGENTS.md`, `agents/cpo/AGENTS.md:21,41`, `agents/seo-content/AGENTS.md:25` | source = journal des principes et contrats de département ; le vault est une archive |
| `.claude/knowledge/README.md:35,128-130`, `.claude/rules/agent-doc-search.md:9` | même renvoi |
| `workspaces/seo-batch` : `seo-content-loop/SKILL.md`, `rules/seo-batch.md`, 5 agents | P10 et P11 du journal comme règle, ADR citées comme origine |
| `workspaces/marketing` : `rules/marketing-batch.md:8,12,64-65,68`, `AGENTS.md:37`, `README.md:1552,1554` | recettes et runbook nommés comme archive ; l'interdit d'écrire dans le vault reste |
| `workspaces/wiki` : `CLAUDE.md:34-36`, `AGENTS.md:32`, `README.md:53-55`, `rules/wiki-batch.md:9,11,126-128`, `wiki-proposal-writer/SKILL.md` | ADR-031/032/033 citées comme origine, dans l'archive |

### Les 20 lignes de `textes-agents-vault.md`

15 sont corrigées ici. 5 restent, parce qu'elles sont encore exactes tant que l'étape 1 ou 2
n'est pas fusionnée, ou qu'elles attendent une réponse de Marwane :

| Ligne | Pourquoi elle reste |
|---|---|
| `.husky/pre-commit:19-51` | étape 2 : les miroirs se comparent encore au clone du vault |
| `.claude/rules/security-hooks.md:15` | la Definition of Done vit encore dans le vault (question D8 de `verdicts-vault.md`, #2116) |
| `workspaces/marketing/CLAUDE.md:23`, `rules/marketing-batch.md:7` | la voix de marque vient encore du vault (étapes 1 et 2) |
| `workspaces/marketing/.claude/agents/local-business-agent.md:59` | idem |
| `workspaces/marketing/AGENTS.md:46-48,58-61` | idem |

Les 5 agents de `workspaces/seo-batch` (tableau des mentions historiques) sont corrigés en plus.

### Les 4 textes qui exigeaient une ADR

`CLAUDE.md` est corrigé depuis #2107. Les trois autres le sont ici : `guard-hierarchy.yaml`,
`.claude/skills/README.md:110`, `fafa-persona-canon/SKILL.md:81`. Le remplacement choisi est
« un principe au journal, par PR, approbation de l'owner ». Approuver cette PR vaut accord sur
ce remplacement : c'est la décision que `textes-agents-vault.md` laissait à l'owner.

## Preuves

- `bash scripts/agents/validate-agents-md.sh --diff origin/main` : 10 fichiers lus, 0 blocage,
  3 avertissements.
- `--all` : 15 fichiers, 0 blocage, 3 avertissements, comme sur `main`.
- `--file agents/<rôle>/AGENTS.md --type agents-md` sur les 7 rôles : sorties identiques entre
  `main` et la branche. 5 rôles (ceo, cmo, cto, rag-lead, seo-qa) sont en blocage dans ce mode,
  sur `main` comme sur la branche : adresses IPv4 et URL d'infra déjà présentes. Hors périmètre.
- `node scripts/governance/build-skills-registry.js --check` : à jour, 17 skills.
  `validate-skills-frontmatter.js` : 17 valides.
- `bash -n .husky/pre-commit` ; `guard-hierarchy.yaml` relu par un parseur YAML.
- `git diff --check` : rien.

### Preuve de fin du plan, rejouée

`rg -n "/opt/automecanik/governance-vault" scripts .husky backend/src tools` : 8 lignes sur
`main`, 7 sur la branche (23:35). Elle n'est pas vide. Ce qui reste :

| Ligne | Attend |
|---|---|
| `.husky/pre-commit:32` | étape 2 |
| `backend/src/modules/seo/r2/services/r2-opa-evaluator.service.ts:9,77` | étape 7 (bundles OPA) |
| `scripts/governance/check-verdict-expirations.sh:5,25` | question D10 |
| `tools/security/attack-simulations/simulate-escalation-hijack.sh:35,136` | question D11 |

Comptage large : 37 fichiers de `scripts`, `.husky`, `backend/src`, `tools` et `.github` nomment
`governance-vault`, sur `main` comme sur la branche. Cette PR n'en retire aucun : ce sont les
étapes 2 à 7.

Second critère du plan, « le hook SessionStart ne signale plus `vault-sync` muet » : non
rejouable avant l'arrêt du cron par Marwane.

## Questions pour Marwane

| N° | Question | Réponse proposée |
|---|---|---|
| D10 | `check-verdict-expirations.sh` lit `ledger/verdicts/*.md` du vault. Il n'est branché nulle part (`governance-checks.yml:11`), sort toujours 0, et le seul verdict (`VERDICT-2026-001`) est expiré depuis le 12 août sans effet. P28 (« toute dérogation porte une clause d'expiration ») est en vigueur. Le retire-t-on ? | Oui : retirer le script et son entrée d'`ownership.yaml:239` (patch owner). Un contrôle jamais branché ne porte pas P28. Sinon : reloger le verdict dans le monorepo et brancher le script. |
| D11 | `simulate-escalation-hijack.sh` sort en erreur dès son premier test (fichier `05-agents/registry/REG-001-agents.md`, arborescence v1 du vault, disparue). Rien ne lance `run-all.sh`. Le retire-t-on ? | Oui : supprimer le script et déplacer « Escalation Hijacking » dans « Vectors Not Yet Tested » de `run-all.sh`. L'agent ne l'a pas fait : retirer un test de sécurité en échec fait passer le lanceur au vert. |
| D12 | Le runbook de rollback du pilote marketing (`ledger/knowledge/runbook-marketing-pilot-rollback.md`) n'existe que dans le vault, et son étape 5 écrit dans le vault. Le reloge-t-on ? | Oui, dans `workspaces/marketing/`, avec l'étape 5 réécrite (une ligne au journal, par PR). D'ici là, `README.md:1554` prévient qu'il est à remplacer avant usage. |

## Limites

- La copie `workspaces/wiki/.claude/canon-mirrors/agent-exit-contract.md` n'est pas déclarée :
  étape 2.
- `seo-content-loop/SKILL.md:151` cite ADR-131 : question D2 de `verdicts-vault.md`.
- `workspaces/marketing/README.md:132,354` nomme une « ADR vault des handoffs » à produire
  (décision D6 de ce workspace) : laissé, c'est un constat daté du workspace.
- `personas/fafa.md:3,6` (« Pointer vault », « figée jusqu'à PR vault A ») : laissés, texte figé
  V1 ; la ligne 58, seule à prescrire un geste, est corrigée.
- Le `CLAUDE.md` du dépôt `ak125/automecanik-wiki` (l.113-119) est dans un autre dépôt : PR
  séparée.
- Chaîne du 09 : cette PR ne touche aucun de ses fichiers. Le cron de 03:30Z du 17 novembre est
  à relever.

## Gestes de Marwane sur le DEV, après les étapes 2 et 7

À ne pas faire avant : tant qu'un lecteur local existe, ces gestes cassent le pre-commit ou R2.

| Geste | Relevé du 16 novembre |
|---|---|
| arrêter le cron `vault-sync.sh` | crontab de `deploy`, ligne 26 : `*/5 * * * * /home/deploy/bin/vault-sync.sh` |
| retirer `github-vault` et `vps-vault` des sources de knowledge-jobs | `/home/deploy/.local/lib/knowledge-jobs/collection/sources.json`, lignes 7 et 15 (service sans dépôt git : patch) |
| retirer `governance-vault` de la portée du jeton de l'App | `scripts/ops/gh-app-token/automecanik-gh-app-token:17` ; la copie installée (`/usr/local/libexec/`) est identique au dépôt : PR du monorepo, puis réinstallation |

## État

| État | Constat |
|---|---|
| Implémenté | oui pour les textes ; non pour les scripts (D10, D11) et les gestes du DEV |
| Intégré | non : PR #2118 en brouillon, circuit élevé |
| Vérifié | validateurs locaux ; preuve de fin rejouée : 7 lignes restantes, non vide |
| Opérationnel | non |
| Bloqué | approbation de Marwane pour #2118 ; étapes 2 et 7 ; réponses D10 à D12 |

## Gestes de Marwane pour cette PR

Un seul bloc, Windows PowerShell 32 bits. Il n'a pas été exécuté par l'agent : le DEV n'a pas de
PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit pas dans ce dépôt
public. Le bloc régénère les projections sur le DEV, attend les checks, demande l'accord,
approuve, attend le circuit, puis fusionne sur la tête relevée.

```powershell
& {
  $SSH = "C:\WINDOWS\Sysnative\OpenSSH\ssh.exe"
  $DEV = "deploy@<hote DEV>"
  $REPO = "ak125/nestjs-remix-monorepo"

  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2118 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }

  & $SSH $DEV "bash /home/deploy/resync/resync-pr.sh 2118"
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : resync-pr.sh a echoue sur le DEV"; return }

  gh pr ready 2118 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : sortie du brouillon"; return }
  $HEAD = (gh pr view 2118 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : lecture de la tete"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2118 --repo $REPO --json name,state)
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
  $NOW = (gh pr view 2118 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }

  $GO = Read-Host ("Approuver et fusionner la PR 2118 sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "ARRET : pas d'accord donne"; return }
  gh pr review 2118 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2118 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2118 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee"; return }
  Write-Host "PR 2118 fusionnee."
}
```
