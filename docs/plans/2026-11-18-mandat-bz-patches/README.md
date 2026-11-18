# Correctifs préparés, non appliqués (mandat BZ, 2026-11-18)

Ces correctifs ne sont **pas appliqués** dans cette PR. Les fichiers `.github/**` sont réservés à
l'owner (garde de fichiers de l'agent, ADR-130 D3.4). **Leur application revient à Marwane.**
Le passage du mode `dry-run` au mode `write` est une décision distincte (un « oui » à part).

La PR contient la partie hors `.github/**`, inerte tant que ces correctifs ne sont pas appliqués :

- `scripts/governance/registry-thresholds.py` : évaluation pure (lignes de département, état de
  chaque seuil, corps d'issue) ;
- `scripts/governance/registry-thresholds.sh` : lecture des indicateurs, section du rapport,
  issues selon `THRESHOLD_ISSUES_MODE` (réutilise `.github/scripts/report-issue-publish.sh`) ;
- `scripts/governance/registry-threshold-read.ts` : lecture de l'indicateur chez son producteur
  déclaré (`CommandCenterKpiService.computeLiveKpis('full')`, verdict de `toPaymentsKeptKpi`) ;
- `scripts/governance/registry-thresholds.test.sh` : 39 vérifications, faux `gh`, sans réseau ;
- schéma, validateur et registre : champ `threshold.eval`, règle `threshold`, règle évaluable de
  `sales.payments-kept` (encore `wired: false`).

## 01 — rapport du matin et passage `wired: true`

`01-rapport-du-matin-seuils-et-wired.patch`

SHA-256 : `da704fe80acad8cf3a9a4aa9caba14812be0d497ca6f3c5d58e02e36c3088000`

- `.github/scripts/morning-health-digest.sh` : dans le passage du rapport du jour seulement (après
  la porte quotidienne ; les passages d'urgence de 15 min ne changent pas), appelle
  `scripts/governance/registry-thresholds.sh`, puis ajoute la section
  « ## Fonctions du registre et seuils » après « ## Départements », sans retirer de ligne
  existante. `PUBLISH=1` seulement si le rapport tourne avec `--publish`. Une sortie vide est écrite
  « Section indisponible », jamais un succès.
- `.spec/00-canon/ai-registry/agent-operating-map.yaml` : `sales.payments-kept`,
  `threshold.wired: false → true` et manque mis à jour. Les deux vont ensemble : `wired` ne passe à
  `true` que lorsque le rapport évalue réellement la règle (point (d) du mandat).

## 02 — dépendances du producteur dans le job, test en CI

`02-workflow-dependances-et-test-ci.patch`

SHA-256 : `56d10d62abc2dec213444c2482d85feacaedee23361adc47c746e8a69fbf5b0a`

- `.github/workflows/morning-health-digest.yml` :
  - `THRESHOLD_ISSUES_MODE: ${{ vars.THRESHOLD_ISSUES_MODE || 'dry-run' }}` : variable de dépôt
    absente ⇒ à blanc ;
  - `setup-node` + `npm ci --ignore-scripts` (ADR-030) seulement dans la fenêtre 7 h-10 h de Paris
    ou sur `workflow_dispatch`, et pas en mode `off` ; `continue-on-error` : une installation en
    échec donne « non mesuré », pas un rapport en échec ;
  - `timeout-minutes: 10 → 20` pour l'installation.
- `.github/workflows/ci.yml` : étape `bash scripts/governance/registry-thresholds.test.sh` dans le
  job « 🛡️ ADR-010 Governance », après les contrats de département.

Sans 02, 01 fonctionne quand même : le lecteur constate l'absence de `tsx` et de `node_modules` et
écrit « non mesuré : dépendances du producteur absentes du job ». Rien n'est compté zéro.

Limite connue : si l'heure du rapport est configurée hors de 7 h-10 h (`REPORT_CONFIG`), le passage
quotidien n'a pas les dépendances et l'indicateur est « non mesuré ». La fenêtre se règle dans
l'étape `window` de 02.

## Appliquer, vérifier, revenir en arrière

```bash
git apply docs/plans/2026-11-18-mandat-bz-patches/01-rapport-du-matin-seuils-et-wired.patch
git apply docs/plans/2026-11-18-mandat-bz-patches/02-workflow-dependances-et-test-ci.patch
node scripts/governance/validate-agent-operating-map.js --contracts
bash scripts/governance/registry-thresholds.test.sh
```

Après fusion : un `workflow_dispatch` de « 🌅 Morning health digest » montre la section dans l'issue
du rapport ; en `dry-run`, la liste « ferait — … » et aucune issue de seuil.
Passage en écriture (« oui » distinct) : variable de dépôt `THRESHOLD_ISSUES_MODE=write`. Retour à
blanc : supprimer la variable ou la mettre à `dry-run` ; arrêt : `off`. Retrait complet :
`git apply -R` des deux correctifs.

Vérifié dans le mandat : `git apply --check` des deux correctifs sur `f0081e635` + cette PR ; YAML
des workflows corrigés relu par `yaml.safe_load` ; rapport corrigé exécuté depuis une copie hors
`.github/` (faux `gh`, aucune écriture) ; registre corrigé validé par `--contracts`.
Non vérifié : `actionlint` et `shellcheck` absents de l'hôte DEV ; exécution dans GitHub Actions.
