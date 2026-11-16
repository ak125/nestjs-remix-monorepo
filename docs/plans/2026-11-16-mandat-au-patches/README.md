# Mandat AU — parcours d'achat simulé en PROD toutes les 15 minutes

Décisions citées (feuille « Contrats de département et indicateurs AutoMecanik »,
onglet « Décisions du 15 nov. ») : **52** (parcours d'achat simulé), **36** (robot
déclaré et exclu des mesures), **67** (alerte e-mail une fois par incident, après
2 échecs). Le résultat alimente le rapport unique (mandat AM).

## Ce que fait la sonde

Toutes les 15 minutes, un navigateur sans tête parcourt `https://www.automecanik.com`
depuis un runner GitHub, donc depuis l'extérieur, comme un client :

| Étape (`step`) | Contrôle |
|---|---|
| `accueil` | `/` répond 200, sélecteur de véhicule visible |
| `vehicule` | marque, année, modèle, motorisation → page `/constructeurs/…-type.html` |
| `gamme` | lien de la gamme plaquettes de frein → liste de pièces |
| `produit` | fiche d'une pièce disponible (bouton d'ajout actif, 5 pièces essayées au plus) |
| `ajout_panier` | `POST /api/cart/items` < 300 |
| `panier` | `/cart` non vide, lien « Continuer vers la livraison » |
| `commande` | `/checkout`, champ e-mail |
| `paiement` | coordonnées fictives, section « Methode de paiement » et bouton « Payer » visibles, **jamais cliqués** |
| `nettoyage` | `DELETE /api/cart`, panier relu à 0 article, `POST /auth/logout` |

Garde-fous, dans `frontend/tests/purchase-probe/purchase-path.probe.ts` :

- **Robot déclaré (décision 36).** L'UA est `… HeadlessChrome/<version> … AutoMecanik-PurchaseProbe-bot/1.0`.
  - `HeadlessChrome` le classe `bot_other` dans `@repo/cwv-taxonomy`.
  - `bot` l'écarte de GA4 (`BOT_UA_PATTERN` de `frontend/app/root.tsx`).
  - Les beacons de mesure (CWV, attribution, funnel, runtime-event) sont de toute façon refusés par le navigateur. Le résultat les compte (`blocked_writes`).
- **Aucune écriture hors liste blanche.** Toute requête autre que GET, HEAD ou OPTIONS est refusée dans le navigateur, sauf deux :
  - `POST /api/cart/items` : le panier vit dans Redis, sous la session anonyme du robot ;
  - `POST /auth/check-email` : une lecture.
- **Jamais de paiement ni de commande.** `POST /checkout` n'est jamais envoyé, et le bouton « Payer » n'est jamais cliqué. Aucune ligne de commande ni de panier ne reste en base.
- **Nettoyage systématique, même après un échec.** Le robot vide son panier puis ferme sa session.
- **Aucune donnée client.** Le robot n'utilise qu'un e-mail en `.invalid` et une adresse fictive. Le résultat ne contient que des étapes, des durées et des statuts.

## Pourquoi un runner GitHub planifié (exécuteur)

| Option | Retenue | Raison |
|---|---|---|
| Workflow planifié sur `ubuntu-latest` | **oui** | Il passe par Internet, Cloudflare et Caddy comme un client. Aucune charge sur l'hôte PROD. Le canal d'alerte existe déjà (issue assignée, comme `morning-health-digest.yml`) et le rapport unique lit ses runs avec le même `GITHUB_TOKEN`. |
| `prod-smoke-tests.yml` étendu | non | Il est lancé au déploiement, pas toutes les 15 min, et ne teste pas le parcours d'achat. |
| `check-payment-tunnel.sh`, `check-error-logs-5xx.sh` | non | Ils lisent des journaux. Ils ne rejouent pas un parcours. |
| Cron sur la machine DEV | non | Aucun transport e-mail. GitHub ne peut pas lire ses résultats. Panne de DEV = sonde muette. |
| `scripts/monitoring/` sur l'hôte PROD | non | `deploy-monitoring-scripts.yml` l'installerait sur l'hôte PROD, donc une action PROD. Ce serait aussi une sonde interne, pas externe. |

## Livré dans la PR du mandat (code, sans effet tant que le workflow n'existe pas)

- `frontend/tests/purchase-probe/purchase-path.probe.ts` et `playwright.config.ts` : la sonde. Elle n'est pas lancée par la CI existante, car `frontend/playwright.config.ts` ne lit pas ce dossier.
- `scripts/ops/purchase-path-probe.sh` :
  - `alert` : issue d'incident au 2e échec consécutif, une seule par incident, fermée au premier succès ;
  - `summary` : synthèse sur 24 h.
- `scripts/ops/purchase-path-probe.test.sh` : 40 cas sur fixtures, avec un faux `gh` et sans réseau.
- Ce dossier : trois patches réservés à l'owner.

## Patches réservés à l'owner (non appliqués)

| Patch | Fichier | Contenu |
|---|---|---|
| `01-purchase-path-probe-workflow.patch` | `.github/workflows/purchase-path-probe.yml` (nouveau) | Cron `7,22,37,52 * * * *` et `workflow_dispatch`. Playwright installé à la version de `frontend/package.json`, dans `$RUNNER_TEMP`, sans toucher au dépôt. Artefact `purchase-path-probe-result` (3 jours). Étape d'alerte. Permissions : `contents: read`, `issues: write`, `actions: read`. Aucun secret ajouté (seul `GITHUB_TOKEN`). |
| `02-morning-digest-purchase-signal.patch` | `.github/scripts/morning-health-digest.sh` | Signal 9 : disponibilité sur 24 h, échecs et durées médiane/p95/max par étape, incident ouvert. Le niveau (✅/⚠️/⛔) remonte dans le titre du digest. |
| `03-automation-reality-entry.patch` | `.spec/00-canon/repository-registry/automation-reality.yaml` | Entrée `purchase-path-probe` en `SCRIPT_ONLY` (intention `ACTIVE`). Exigée par `automation-registry-coverage.yml` pour un nouveau workflow planifié. |

Les patches 01 à 03 vont ensemble, dans une même PR. Ils s'appliquent sur `main` **après** la
fusion de la PR du mandat : l'entrée 03 cite des fichiers que seule cette PR ajoute, et le
validateur du registre refuse un chemin absent de l'arbre.

## Actions de Marwane (machine : son poste, avec son propre compte `gh`)

1. **Fusionner la PR du mandat AU.** Le numéro et le SHA de tête sont donnés dans la PR :
   ```bash
   gh pr merge <n° PR AU> --repo ak125/nestjs-remix-monorepo --squash --match-head-commit <SHA40>
   ```
2. **Appliquer les patches dans une PR à lui** :
   ```bash
   git fetch origin && git switch -c ops/au-purchase-path-probe origin/main
   P=docs/plans/2026-11-16-mandat-au-patches
   git apply --check $P/01-*.patch $P/02-*.patch $P/03-*.patch
   git apply $P/01-*.patch $P/02-*.patch $P/03-*.patch
   npx tsx scripts/registry/validate-automation-overlay.ts
   bash scripts/ops/purchase-path-probe.test.sh
   git add .github/workflows/purchase-path-probe.yml .github/scripts/morning-health-digest.sh \
           .spec/00-canon/repository-registry/automation-reality.yaml
   git commit -m "ci(ops): sonde du parcours d'achat PROD toutes les 15 min (mandat AU)"
   git push -u origin ops/au-purchase-path-probe
   gh pr create --repo ak125/nestjs-remix-monorepo --fill
   gh pr merge <n°> --repo ak125/nestjs-remix-monorepo --squash --match-head-commit <SHA40>
   ```
   Si le mandat AM (#2089) a été fusionné avant, il restructure `morning-health-digest.sh` :
   `git apply --check` refusera alors le patch 02. Reporter le bloc « Signal 9 » à la main, à
   l'endroit où AM range ses signaux. Le bloc est autonome : un appel à `summary` et son code de
   sortie.
3. **Premier passage, à la main** (activation) :
   ```bash
   gh workflow run purchase-path-probe.yml --repo ak125/nestjs-remix-monorepo --ref main
   gh run list --repo ak125/nestjs-remix-monorepo --workflow purchase-path-probe.yml --limit 1
   gh run watch <id> --repo ak125/nestjs-remix-monorepo
   ```
   Le jeton `gh` de la machine DEV n'a pas `actions:write`. Ce lancement se fait depuis son compte.
4. **E-mail.** L'alerte est une issue assignée à `ak125`. L'e-mail dépend des réglages GitHub du
   compte : Settings → Notifications → « Participating, @mentions and custom », case **Email**
   cochée. C'est le même canal que le digest du matin.
5. **Arrêt d'urgence, si la sonde gêne** : `gh workflow disable purchase-path-probe.yml --repo ak125/nestjs-remix-monorepo` (son compte).

Aucune action PROD, aucun secret, aucune variable de dépôt, aucune migration.

## Lecture du résultat

- **Alerte.** Titre : `🔴 Parcours d'achat PROD en échec — étape « … »`. Le corps contient l'erreur, le lien des deux runs et le tableau des étapes. L'issue se ferme seule au premier passage réussi, avec un commentaire « Rétabli ».
- **Rapport unique.** C'est le Signal 9 du digest, ou directement `GH_TOKEN=… REPO=ak125/nestjs-remix-monorepo bash scripts/ops/purchase-path-probe.sh summary`. Code de sortie : 0 ✅, 1 ⚠️, 2 ⛔.
- **Seuils proposés, à valider** :
  - ⛔ si un incident est ouvert ou si la disponibilité est sous 95 % ;
  - ⚠️ dès un échec, ou si moins de 72 passages sur les 96 attendus ont abouti (planification GitHub en retard).

## Limites connues

- **Aucun passage en PROD n'a été fait.** La preuve porte sur DEV:3000 : 2 parcours complets le 2026-11-16, panier relu vide après le nettoyage.
- **Les IP des runners GitHub sont des IP de datacenter.** Cloudflare, `BotGuard` ou le blocage géographique peuvent refuser la sonde. Le premier run le dira : l'étape `accueil` échouera en 403 ou sur un challenge. Le contournement par `PROD_SEO_CP_SYNTHETIC_PROBE_SECRET` n'est **pas** utilisé. Il réclamerait une décision de l'owner.
- **GitHub ne garantit pas l'heure des crons.** Un passage peut être retardé ou sauté aux heures chargées. Le seuil des 72 passages en tient compte.
- **Si `POST /auth/logout` échoue**, la session anonyme du robot expire seule. Son panier Redis est vidé avant.
- **L'e-mail dépend des réglages de notification du compte** (point 4).
- **Le sélecteur de véhicule et la gamme sont fixes**, réglables par `PURCHASE_PROBE_VEHICLE` et `PURCHASE_PROBE_GAMME_PREFIX`. Si la motorisation ou la gamme disparaît du catalogue, la sonde échoue à `vehicule` ou `gamme` : c'est un vrai signal, pas un faux positif à masquer.
- **`actionlint` et `shellcheck` ne sont pas installés sur la machine DEV.** Le workflow a été contrôlé par analyse YAML et `git apply --check`, pas par `actionlint`.
