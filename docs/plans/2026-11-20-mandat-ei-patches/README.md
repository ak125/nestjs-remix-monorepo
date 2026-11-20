# Mandat EI — patchs réservés (NON appliqués)

Base : `main` 7f4dded37d068286e467ff69f0c4b2fcdacb0232 + la branche
`feat/mandat-ei-garde-prix-producteur-20261120` (producteur garde-prix).
Ces fichiers touchent des chemins réservés (`.github/**`, `.spec/00-canon/**`,
`scripts/monitoring/**`) : commit signé par Marwane uniquement. Aucun n'est
appliqué par cette PR.

Les patchs AU 01–03 et AM 01 du 2026-11-16 (`docs/plans/2026-11-16-mandat-au-patches/`,
`docs/plans/2026-11-16-mandat-am-patches/`) sont remplacés par 01–04 ci-dessous,
régénérés contre HEAD. Le contenu est le même, à une exception près : le patch 02
ajoute `--branch main` à la recherche du dernier run de la sonde. Sans ce filtre, un
run lancé à la main sur une autre branche pouvait répondre à la place de la sonde
et masquer une alerte. `purchase-path-probe.sh` filtre déjà ses propres runs sur la
branche (revue de sécurité automatique du 2026-11-20).

## Ordre d'application

| # | Fichier | Touche | Effet une fois fusionné |
|---|---------|--------|-------------------------|
| 01 | `01-au-purchase-path-probe-workflow.patch` | `.github/workflows/purchase-path-probe.yml` (nouveau) | Sonde du parcours d'achat simulé toutes les 15 min contre la PROD, robot marqué, alerte après 2 échecs de suite (décision 52). **Active une sonde sur la PROD.** |
| 02 | `02-au-morning-digest-purchase-signal.patch` | `.github/scripts/morning-health-digest.sh` | Le rapport du matin lit le dernier run de la sonde sur `main` |
| 03 | `03-au-automation-reality-entry.patch` | `.spec/00-canon/repository-registry/automation-reality.yaml` | Entrée `purchase-path-probe` (exigée par check-automation-coverage). `last_verified_at` reste « 2026-11-17 », date de la vérification AU |
| 04 | `04-am-check-payment-tunnel-check-only.patch` | `scripts/monitoring/check-payment-tunnel.sh` | Mode `CHECK_ONLY=1` lu par le rapport. **La fusion déclenche `deploy-monitoring-scripts.yml`, qui installe le script sur l'hôte PROD** |
| 05 | `05-ei-garde-prix-digest-wiring.patch` | `.github/workflows/morning-health-digest.yml`, `.github/scripts/morning-health-digest.sh` | Lance `scripts/ops/garde-prix-read.ts` à chaque passage de la fenêtre quotidienne (7–10 h Paris, environ 12 passages) et sur `workflow_dispatch`. Le fichier reste dans le job : ni cache ni artefact (voir plus bas). Hors fenêtre, ou si la lecture échoue, le rapport écrit « indisponible » et garde les incidents ouverts, sans mail répété |
| 06 | `06-ei-automation-reality-entry.patch` | `.spec/00-canon/repository-registry/automation-reality.yaml` | Entrée `garde-prix-read` (D11, `actual_mode: SCRIPT_ONLY`) |

Le patch 05 dépend de la fusion de la PR du producteur : sans
`scripts/ops/garde-prix-read.ts`, l'étape échoue (continue-on-error) et le
signal reste « indisponible ».

Le patch 05 s'applique après 02 ; le patch 06 s'applique après 03.

Pourquoi pas de cache Actions : une PR venue d'un fork peut restaurer les caches
de la branche de base, et le dépôt est public. Les clés nomment un fournisseur ou
une marque (incident en cours, vente à perte) : elles restent dans le job. En
contrepartie, la lecture est refaite à chaque passage de la fenêtre, comme `npm ci`
et le build de cette même fenêtre. Si `rapport.heure_paris` (REPORT_CONFIG) sort de
la plage 7–10 h, le rapport du jour lira « indisponible » : il faut alors élargir la
fenêtre.

```bash
for p in docs/plans/2026-11-20-mandat-ei-patches/0*.patch; do git apply --check "$p" && git apply "$p"; done
```

## Empreintes (sha256)

```
504e5f2bfe990f202806883a610c4fdf9a6b8a7a974a67cdf4ea82b9e56dd662  01-au-purchase-path-probe-workflow.patch
e1f8e8a40b49bd07fb7913d13ed5764b3169d4c3b3f3efd8fbd8c52099ba7c4d  02-au-morning-digest-purchase-signal.patch
7f4de7f7f3db93732f15cbb1e8fae456127d2613e2d0f9336c5a40064394de15  03-au-automation-reality-entry.patch
6796c683714435f911eb51f296cb3b9d67d1f1b6d37fd1a90ccfcf35ff92a084  04-am-check-payment-tunnel-check-only.patch
16350951e9b555f7d8a65b43eac1767626e0c0352cd6df578491ff41aa49b6cc  05-ei-garde-prix-digest-wiring.patch
b00b547c67f3bb2cca74472ca0626d34b0a1a1c867bbac563304cad6397a312a  06-ei-automation-reality-entry.patch
```

## Essais sur copie de HEAD (2026-11-20, 0db9e2366)

- Les 6 patchs, rejoués dans l'ordre sur une copie vierge (`git apply --check`), donnent des fichiers identiques octet pour octet à la copie d'essai. Les modes 775 sont conservés.
- `bash -n` : `morning-health-digest.sh` et `check-payment-tunnel.sh` OK. Les trois YAML se chargent.
- `scripts/ops/morning-health-digest.test.sh` : 44/44.
- `scripts/ops/purchase-path-probe.test.sh` : tous les cas passent.
- `check-automation-coverage.js --added-file .github/workflows/purchase-path-probe.yml` : OK.
- `validate-automation-overlay.ts` : 18/18 entrées valides.
- Bloc `run:` d'entrée du patch 05, extrait du YAML et joué en local :
  - une lecture réussie donne son fichier ;
  - une lecture ratée dans la fenêtre, ou un fichier vide, donne un chemin `.absent` avec un avertissement ;
  - hors fenêtre, le chemin `.absent` vient sans avertissement ;
  - la variable de surcharge l'emporte.
- Le patch 05 ne contient aucun `actions/cache` (0 occurrence).
- Non essayé : actionlint et shellcheck, absents de l'hôte.

## Propriété (extraits)

`.github/CODEOWNERS` :

```
/.github/workflows/                               @ak125
/scripts/monitoring/                              @ak125
/.spec/00-canon/                                     @ak125
/backend/src/modules/pricing/                                 @ak125
```

`.spec/00-canon/repository-registry/ownership.yaml` (l. 848) :

```yaml
  - glob: backend/src/modules/pricing/**
    domain: D11
    owner: '@ak125'
    sourceConfidence: high
    risk: high
```

## Secrets et variables (noms seulement)

- **Déjà en place**, lus par le workflow du digest :
  - environnement `report-mail` : `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`, `ALERT_EMAIL_TO`, `EMAIL_FROM` ;
  - secrets `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, déjà passés à l'étape de collecte et réutilisés par l'étape du producteur (patch 05).
- **Variables** :
  - `THRESHOLD_ISSUES_MODE` ne doit pas valoir `off`, sinon l'étape `deps` ne tourne jamais et le producteur non plus ;
  - `GARDE_PRIX_JSON_PATH` est facultative après le patch 05 ; si elle est posée, elle remplace le fichier produit ;
  - `REPORT_CONFIG_PATH` reste inchangée.
- **AU 01** : `GITHUB_TOKEN` seulement.
- **AM 04** : l'environnement existant de `check-payment-tunnel` sur l'hôte PROD, sans nouveau nom.
