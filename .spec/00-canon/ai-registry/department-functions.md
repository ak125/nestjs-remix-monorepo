# Fonctions des départements — carte et modèle (mandat BX, complément BX-2)

Établi le 2026-11-18 (mandat BX, puis complément BX-2). Ce texte décrit le bloc
`functions` du registre existant. Il ne crée ni registre ni tableau de bord : les
données vivent dans `agent-operating-map.yaml`, la forme dans
`agent-operating-map.schema.json`, les règles dans
`scripts/governance/validate-agent-operating-map.js`.

Décision de Marwane (complément BX-2) : la carte couvre les 24 départements en
largeur, dans la même PR, avant toute fusion. Elle remplace l'ordre « 13 d'abord »
et « une fonction par décision » du mandat BX.

## La carte des 24 départements

Relevé du 2026-11-18 sur main `6800cf093`. « op » = `operational`, « non-op » =
`non_operational`, « manq. » = `missing`. Le niveau suit chaque fonction (L0 à
L4) ; une fonction manquante n'a pas de niveau au-delà de L0.

| N°  | Département                                   | op  | non-op | manq. | Fonctions (niveau)                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------- | --- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Direction générale (`direction`)              | 0   | 1      | 0     | `command-center` L1                                                                                                                                                                                                                                                        |
| 02  | Gouvernance (`governance`)                    | 0   | 3      | 0     | `canon` L1, `merge-circuits` L1, `repository-registry` L1                                                                                                                                                                                                                  |
| 03  | Stratégie & Scoring (`strategy`)              | 0   | 2      | 0     | `improvement-check` L1, `gamme-score` L1                                                                                                                                                                                                                                   |
| 04  | Marketing & Acquisition (`marketing`)         | 0   | 3      | 2     | `backlinks-briefs` L1, `merchant-feed` L1, `trend-signals` L1, `newsletter` manquante, `shopping-ads` manquante                                                                                                                                                            |
| 05  | Brand & Communication (`brand`)               | 0   | 3      | 0     | `compliance-gate` L1, `safety-review` L1, `design-system` L1                                                                                                                                                                                                               |
| 06  | Contenu éditorial (`content`)                 | 0   | 2      | 0     | `blog` L1, `ai-content` L1                                                                                                                                                                                                                                                 |
| 07  | Production Pages & SEO (`seo`)                | 3   | 7      | 0     | `pages` L1, `projection` L2, `roles-contracts` L1, `url-status` L2, `sitemap` L1, `internal-linking` L1, `gamme-audit` L1, `keyword-briefs` L1, `monitoring` L1, `substitution` L2                                                                                         |
| 08  | Media & Fafa (`media`)                        | 0   | 2      | 0     | `video-factory` L1, `script-generator` L1                                                                                                                                                                                                                                  |
| 09  | Knowledge RAW & WIKI (`wiki`)                 | 0   | 3      | 0     | `raw-to-wiki` L1, `exports` L1, `rag-ingest` L1                                                                                                                                                                                                                            |
| 10  | Catalogue & Compatibilité (`catalog`)         | 0   | 5      | 0     | `core` L1, `vehicles-compatibility` L1, `search` L1, `integrity` L1, `stock` L1                                                                                                                                                                                            |
| 11  | Expertise technique automobile (`diagnostic`) | 1   | 1      | 0     | `engine` L2, `knowledge-graph` L0                                                                                                                                                                                                                                          |
| 12  | Achats & Fournisseurs (`supplier`)            | 0   | 3      | 1     | `suppliers-admin` L1, `supplier-truth` L1, `price-load` L1, `service-rate` manquante                                                                                                                                                                                       |
| 13  | Commercial & Ventes (`sales`)                 | 5   | 8      | 0     | `payments-kept` L2, `unpaid-watch` L1, `unpaid-relaunch` L1, `order-provenance` L2, `payment-methods` L0, `shipping-fees` L2, `invoice` L0, `cart-to-order` L2, `order-admin-actions` L2, `order-substitution` L1, `promo` L1, `commercial-archives` L1, `leads-quotes` L1 |
| 14  | Service Client & Fidélisation (`support`)     | 1   | 4      | 1     | `requests` L1, `reviews` L1, `messages` L1, `customer-account` L1, `ai-chat` L2, `satisfaction-survey` manquante                                                                                                                                                           |
| 15  | Logistique & Opérations (`logistics`)         | 0   | 1      | 1     | `shipping` L1, `carrier-labels` manquante                                                                                                                                                                                                                                  |
| 16  | Pricing (`pricing`)                           | 1   | 0      | 1     | `tariff-import-invariants` L2, `market-price` manquante                                                                                                                                                                                                                    |
| 17  | Finance & Facturation (`finance`)             | 0   | 1      | 2     | `invoices` L1, `payment-reconciliation` manquante, `accounting-export` manquante                                                                                                                                                                                           |
| 18  | Juridique & Assurances (`legal`)              | 0   | 2      | 0     | `legal-pages` L1, `account-deletion` L1                                                                                                                                                                                                                                    |
| 19  | Risk & Audit (`risk-audit`)                   | 1   | 2      | 1     | `security-scans` L1, `route-authz` L2, `incidents` L1, `order-fraud` manquante                                                                                                                                                                                             |
| 20  | Produit & Expérience Client (`product`)       | 0   | 3      | 0     | `storefront-shell` L1, `quality-gates` L1, `diagnostic-to-product` L1                                                                                                                                                                                                      |
| 21  | Runtime & Observability (`runtime`)           | 1   | 7      | 1     | `health-observability` L1, `rpc-alerts` L1, `bot-guard` L2, `platform` L1, `deploy-chain` L1, `prod-smoke` L1, `dependencies` L1, `dev-host` L1, `restore-test` manquante                                                                                                  |
| 22  | Data & Analytics (`data`)                     | 2   | 3      | 0     | `landing-attribution` L2, `cwv-beacon` L2, `reporting` L1, `db-governance` L1, `source-freshness` L1                                                                                                                                                                       |
| 23  | IA, Agents & Automatisation (`ia-agents`)     | 1   | 2      | 1     | `operating-map` L2, `skills-registry` L1, `mandate-queue` L1, `quota-alert` manquante                                                                                                                                                                                      |
| 24  | People, Formation & Doc (`people`)            | 1   | 1      | 1     | `staff` L2, `documentation` L1, `contradictions` manquante                                                                                                                                                                                                                 |

Total : 98 fonctions, dont 17 `operational` (toutes L2), 69 `non_operational` et
12 `missing`. Aucune fonction n'est déclarée L3 ou L4 : aucune n'a été observée
en service par ce relevé.

### Fonctions manquantes : des propositions, pas des décisions

Une fonction `missing` n'existe pas dans le dépôt. Si elle porte des `decisions`,
elle est **décidée mais absente** ; sinon c'est une **proposition** : ce qu'un
vendeur de pièces auto en ligne a normalement, rattaché à un besoin réel du
département. Marwane accepte ou écarte chaque proposition ; aucune n'est un
engagement.

| Fonction                         | Intitulé                                                                  | Nature                | Justification                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `marketing.newsletter`           | Envoi de lettres d'information aux clients inscrits                       | proposition           | Le dépôt garde l'inscription des clients mais n'envoie rien ; le contrat compte les ouvertures et clics des envois.                                                |
| `marketing.shopping-ads`         | Pilotage des campagnes Shopping payantes                                  | proposition           | Le contrat suit clics, commandes et coût par commande Shopping ; seul le flux produit existe, aucune donnée de campagne n'est lue.                                 |
| `supplier.service-rate`          | Taux de service et délai par fournisseur                                  | proposition           | Les ruptures après commande et les commandes payées annulées faute de disponibilité demandent de mesurer, par fournisseur, la part des lignes servies et le délai. |
| `support.satisfaction-survey`    | Enquête de satisfaction après livraison                                   | proposition           | Le contrat suit les avis négatifs ; aucune enquête n'est envoyée après livraison pour les obtenir de façon systématique.                                           |
| `logistics.carrier-labels`       | Étiquettes transporteur générées depuis la commande                       | proposition           | Le contrat mesure le délai paiement → expédition ; aucune étiquette ni échange avec un transporteur n'existe dans le dépôt.                                        |
| `pricing.market-price`           | Écart au prix du marché par pièce                                         | décidée (décision 86) | Décidée (décision 86) : aucune source de prix de marché n'est désignée ni lue dans le dépôt.                                                                       |
| `finance.payment-reconciliation` | Rapprochement paiement, commande, facture                                 | proposition           | C'est la surveillance du contrat finance ; aucun rapprochement entre encaissement, commande et facture n'est calculé.                                              |
| `finance.accounting-export`      | Export comptable (fichier des écritures)                                  | proposition           | Un vendeur en ligne remet ses écritures au comptable ; aucun export comptable n'existe.                                                                            |
| `risk-audit.order-fraud`         | Filtrage des commandes à risque de fraude                                 | proposition           | Proposition : seul le contrôle de la passerelle de paiement existe ; aucune règle côté commande (zone STOP, aucune action sans accord nominatif).                  |
| `runtime.restore-test`           | Test périodique de restauration des sauvegardes                           | décidée (décision 79) | Décidée (décision 79) : la dernière restauration réussie doit être connue ; aucun test de restauration n'existe.                                                   |
| `ia-agents.quota-alert`          | Alerte de quota des agents                                                | décidée (décision 14) | Décidée (décision 14) : alerte au-dessus de 80 % du quota ; aucune lecture de quota d'agent n'existe.                                                              |
| `people.contradictions`          | Relevé des contradictions entre ce que lisent les agents et les décisions | décidée (décision 40) | Décidée (décision 40) : le contrat compte les contradictions ouvertes et leur âge ; aucun producteur ne les relève.                                                |

### Éléments « à attribuer »

Listés à la racine du registre (`function_coverage_unassigned`), chacun avec son
motif. Ils ne sont rattachés à aucune fonction.

| Élément                 | Motif                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| module `maintenance`    | importé par aucun module (aucun import trouvé le 2026-11-18) : code mort à retirer ou à rebrancher, décision owner |
| module `agentic-engine` | archivé le 2026-04-02 et commenté dans `app.module.ts` (ligne 194)                                                 |
| routes `_assets`        | répertoire d'images sous `frontend/app/routes`, pas une route servie                                               |

### Frontières à trancher par Marwane

Le registre applique un propriétaire proposé ; rien n'est tranché.

| Cas                                                                                                                  | Propriétaire appliqué                                                         | Alternative                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Skill `vehicle-ops` (était déclaré par catalog et diagnostic)                                                        | catalog ; diagnostic le consomme par `uses`                                   | diagnostic                                                                       |
| Module `substitution` (URL 200/404/410)                                                                              | seo                                                                           | sales pour la substitution d'un produit en commande (`sales.order-substitution`) |
| Actions de ligne fournisseur dans `order-actions.controller.ts` (proposition, confirmation, commande au fournisseur) | sales                                                                         | supplier                                                                         |
| `support/controllers/legal.controller.ts` (pages légales)                                                            | legal                                                                         | support, qui porte le code                                                       |
| Devis et mini-CRM (`quote.controller.ts`, `leads-admin.controller.ts`)                                               | sales                                                                         | support, qui porte le code                                                       |
| RAG : ingestion et chatbot                                                                                           | wiki pour l'ingestion, support pour le chatbot                                | un seul propriétaire                                                             |
| Module `trend-signals`                                                                                               | marketing                                                                     | strategy                                                                         |
| Module `admin` (39 contrôleurs de plusieurs départements)                                                            | direction pour le module ; chaque contrôleur cité par la fonction qui le sert | découpage par contrôleur                                                         |
| Module `merchant-center`                                                                                             | marketing                                                                     | sales                                                                            |
| Stock affiché (`stock.controller.ts`)                                                                                | catalog                                                                       | logistics ; prix et stock runtime restent zone STOP                              |
| Module `payments`                                                                                                    | sales, cité seulement (zone STOP)                                             | finance                                                                          |
| Module `errors` (404, 410, page d'erreur)                                                                            | seo                                                                           | runtime                                                                          |
| Guides R3 et R6 sous `blog-pieces-auto`                                                                              | content                                                                       | seo                                                                              |

## Le modèle

- Un département rend des **fonctions** : des capacités cohérentes, pas une
  fonction par fichier.
- **Un seul propriétaire** par capacité : le département qui la déclare dans
  `capabilities` (ou dans `declared_capabilities`). Les autres départements la
  consomment par contrat (`uses: {capability, from}`), sans la redéclarer.
- Un **owner** par fonction : le rôle ADR-128 du département (`<id>-lead`) ou un
  sous-agent présent dans le dépôt. Marwane reste le responsable humain.
- Trois **statuts** :
  - `operational` : owner, **déclencheur réel** branché sur main
    (`trigger.wired: true`) et **contrôle automatique** (`check`) ; niveau L2 au
    moins ;
  - `non_operational` : la fonction existe dans le dépôt mais il lui manque l'un
    des trois ; niveau L0 ou L1, manques écrits dans `gaps` ;
  - `missing` : la fonction n'existe pas ; L0, une `justification`, aucune
    couverture, preuve `absent`.
- **Niveau prouvé** L0 à L4 (journal des principes,
  `.claude/governance/journal-des-principes.md`, lignes 42-43) : code branché =
  L1, testé en CI = L2, observé en service = L3, observé en PROD = L4. Le niveau
  ne dépasse jamais la preuve.
- **Couverture** (`covers`) : chaque élément existant du dépôt est rattaché à au
  moins une fonction, ou listé « à attribuer » avec un motif.

## Les champs

| Champ                                            | Obligatoire                       | Contenu                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                             | oui                               | `<département>.<nom>`, unique dans tout le registre                                                                                                         |
| `name`                                           | oui                               | intitulé en français                                                                                                                                        |
| `owner`                                          | oui                               | rôle `<id>-lead` ou sous-agent du dépôt                                                                                                                     |
| `status`                                         | oui                               | `operational`, `non_operational` ou `missing`                                                                                                               |
| `level`                                          | oui                               | `L0` à `L4` ; `L0` si `missing`                                                                                                                             |
| `evidence`                                       | oui                               | `path` (+ `lines`), `pr` (+ `state`), `run` (+ `workflow`, `conclusion`, `at`), ou `absent` (ce qui a été cherché)                                          |
| `justification`                                  | si `missing`                      | une phrase : le besoin réel                                                                                                                                 |
| `covers`                                         | non (interdit si `missing`)       | éléments du dépôt : `module`, `routes` (préfixe), `route` (exacte), `workflow`, `cron` (fichier qui contient `@Cron(`), `crontab` + `script` ; `note` libre |
| `uses`                                           | si pertinent                      | `capability`, `from` (département propriétaire)                                                                                                             |
| `decisions`                                      | si pertinent                      | numéros des décisions de Marwane                                                                                                                            |
| `trigger`                                        | pour être opérationnelle          | `kind` (workflow, cron, event, issue, mandate, request), `ref`, `wired`, `detail`                                                                           |
| `check`                                          | pour être opérationnelle          | `kind` (test, ci_gate, workflow), `ref`, `detail`                                                                                                           |
| `kpi_input`, `threshold`                         | seulement si lisibles directement | `kpi_input` : `present` avec producteur, ou `absent` avec note ; `threshold` : `rule`, `issue_label` (`dept:NN-<id>`), `wired`                              |
| `inputs`, `outputs`, `reads`, `writes`, `rights` | non                               | contrat de données et droits au moindre privilège                                                                                                           |
| `agents`, `skills`                               | non                               | sous-agents et skills cités ; leur enregistrement relève du mandat AB-2                                                                                     |
| `gaps`                                           | non                               | ce qui manque, une phrase par manque                                                                                                                        |

Rien n'est inventé : un champ non lisible directement dans le dépôt est omis.

### Correspondance des routes

Une clé de route est le chemin du fichier sous `frontend/app/routes`, sans
extension, segments séparés par des points, suffixes `_` retirés
(`checkout_.resume.tsx` → `checkout.resume`). `routes: X` couvre `X` et toute clé
qui commence par `X.` ou `X/` ; `route: X` exige l'égalité. Un préfixe qui ne
correspond à aucune clé est refusé.

### Crontab du DEV

Les lignes de la crontab `deploy` sont citées par numéro (`crontab: N`) avec leur
script, sans modification. La crontab n'est pas versionnée : la CI ne peut pas les
vérifier, le rapport liste seulement les lignes citées.

## Règles du contrôle (bloquant en CI)

`node scripts/governance/validate-agent-operating-map.js --contracts` (job requis
« 🛡️ ADR-010 Governance » de `ci.yml`) refuse :

1. **empty** : un département sans fonction ;
2. **capability** : une capacité possédée par deux départements ;
3. **operability** : une fonction sans owner, déclencheur branché et contrôle
   qui est `operational` ou au-dessus de L1 ;
4. **missing** : une fonction `missing` qui cite une preuve du dépôt, couvre un
   élément ou a un déclencheur branché (le schéma exige déjà L0 et une
   justification) ; une fonction présente sans aucune preuve (chemin, PR ou
   run) ;
5. **covers** : un module, un workflow, un fichier cron ou une route couverts mais
   absents du dépôt ;
6. **path** : un chemin cité par `trigger`, `check` ou `evidence` absent, ou une
   plage de lignes au-delà de la fin du fichier ;
7. **kpi** : un `kpi_input` `present` dont le producteur n'existe pas ou ne
   contient pas la `rule` citée ;
8. **id** : un identifiant en double, ou non préfixé par son département ;
9. **reference** : un owner, un sous-agent, un skill ou une capacité consommée
   qui n'existe pas, ou consommée depuis un département qui ne la possède pas.

### Rapport de couverture (non bloquant)

`--contracts` imprime aussi un rapport, repris dans le JSON
(`functions_by_department`, `coverage`) :

- `[DEPARTMENT]` : fonctions par statut, par département ;
- `[UNATTACHED]` : module de `backend/src/modules`, groupe de routes de
  `frontend/app/routes`, workflow de `.github/workflows` ou fichier `@Cron` du
  backend rattaché à aucune fonction ni listé « à attribuer » ;
- `[À ATTRIBUER]` : la liste ci-dessus ; `[STALE]` : une entrée qui ne désigne
  plus rien du dépôt ou qu'une fonction couvre déjà ;
- `[UNCITED]` : sous-agent ou skill cité par aucune fonction ;
- les numéros de lignes de crontab cités.

`--self-test` vérifie un cas valide
(`scripts/governance/__fixtures__/agent-operating-map.functions.valid.yaml`), au
moins un cas refusé par règle, les refus de forme du schéma et le rapport de
couverture.

## Compléter ou corriger la carte

1. Grouper par capacité : rattacher l'élément à la fonction qui le sert déjà
   avant d'en créer une.
2. Pour chaque champ, citer la preuve ou écrire « absent ». Ne rien déduire : un
   `@Cron` sous un `ScheduleModule` inactif (`backend/src/app.module.ts`,
   ligne 114) ou un événement que personne n'émet donne `wired: false`.
3. Fixer le niveau sur la preuve la plus faible.
4. Lancer `--contracts` puis `--self-test` ; corriger jusqu'à zéro erreur et zéro
   élément `[UNATTACHED]`. Si une capacité change de département, régénérer
   `audit/registry/command-center-snapshot.json` avec
   `node scripts/governance/build-command-center-snapshot.js`, jamais à la main.
