# AutoMecanik — Tableau de pilotage (24 départements)

> Doc d'analyse/pilotage (pas un registre, pas du canon). Pointe vers l'existant — ne
> duplique pas `canonical.json`. Maj : 2026-06-02 ; corrections de cohérence 2026-10-04 (bilan, ligne 12 / Vue 6 / fiche Achats sur l'état réel de `supplier-truth`, fiche Catalogue alignée sur la ligne 10, [réconciliation 24 ↔ 20](#réconciliation-24-départements--20-slugs-yaml), [état opérationnel](#état-opérationnel-au-2026-10-04-recette-départementale)). Voir le tunnel : [sales-funnel-scorecard.md](./sales-funnel-scorecard.md) (sous-funnel `/pieces`) + le funnel site GA4/GSC : [data-top-of-funnel-report.md](./data-top-of-funnel-report.md).
> **Règle d'or : existant d'abord → mesurer → améliorer → créer seulement si le scoring prouve le manque → pause sinon.**

> **Ce document ne crée aucun agent, aucun registre, aucun module et aucune infrastructure de reporting.
> Il route les capacités existantes vers les départements, clarifie leur mode de maturité, et définit le
> rapport attendu pour permettre le pilotage par scoring.**

> **Projection machine-readable (warn-only, PR #787).** Introduite pour un sous-ensemble *commerce-loop*
> (Achats & Fournisseurs → `supplier`, Commercial & Ventes → `sales`, Pricing → `pricing`) + leurs handoffs
> métier (`supplier→sales` dispo, `pricing→sales` marge), elle porte aujourd'hui **20 slugs** pour ces 24 lignes
> (correspondance exhaustive : [réconciliation 24 ↔ 20](#réconciliation-24-départements--20-slugs-yaml)). Formalisée, en **slugs**, dans
> [`agent-operating-map.yaml`](../.spec/00-canon/ai-registry/agent-operating-map.yaml) (blocs `departments:` /
> `department_handoffs:`, ai-registry). Pont vers les domaines techniques D1-D16 via `repo_domains`.
> **Autorité par champ** : ce markdown reste la **SoT narrative** (Vue 1/5/6 + format rapport) ; le yaml est la
> **SoT machine** des champs structurés (`id`, `lead`, `repo_domains`, `state`, handoffs). Linker, pas recopier
> — ne pas dupliquer le contenu entre les deux (cf. règle d'or ci-dessus).

## Doctrine opérationnelle — 6 règles concrètes
1. **Toyota Gate** — stop sur défaut, corrige à la source. 8 gates : RAW→WIKI · WIKI→PAGE · PAGE→PUBLISH · FAFA→PUBLISH · DEMANDE→DEVIS · DEVIS→PAIEMENT · **PRODUIT→PANIER (dispo !)** · AGENT→OUTPUT.
2. **Amazon Owner** — chaque département possède **un résultat (KPI)**, pas une activité.
3. **Apple Trust** — chaque page porte : pièce · véhicule · compatibilité · doute · moyen de vérifier · délai · prix · action suivante.
4. **Google Measure** — aucune décision sans mesure/preuve.
5. **Netflix Accountability** — chaque agent/skill : périmètre · entrée · sortie · KPI · gate · owner · pause. Les agents **exécutent**, ne décident pas.
6. **Team Topologies Flow** — départements séparés, flux transversaux. Jamais fusionner : Marketing≠Brand · Catalogue≠Achats · Pricing≠Finance · Produit≠IT · Gouvernance≠IA.

---

## Vue 1 — Carte des 24 départements
*Mode : LIVE (vraiment utilisé) / WORKTREE (non mergé) / MANUAL (skill on-demand) / NO-CODE (hors-logiciel) / DORMANT-SUPPORT (existe, peu utilisé) · Score : Fort/Moyen/Faible/Critique · Décision : REUSE/IMPROVE/NO-CODE · Reporting = doc on-demand read-only (auto = parké). « Capacités » car certains sont modules/signaux/engines, pas des agents.*

| # | Département | KPI possédé | Agents / skills / capacités assignés | Mode | Reporting attendu | Score | Next evidence | Décision |
|---|---|---|---|---|---|---|---|---|
| 1 | Direction générale | priorité semaine claire | IA-CEO (Paperclip) | DORMANT | board digest hebdo | Moyen | 1 décision/sem tracée | REUSE |
| 2 | Gouvernance | limites respectées | governance-vault + `governance-vault-ops` | LIVE | vault audit | Fort | gates sans bypass | REUSE |
| 3 | Stratégie & Scoring | verdicts reuse/improve/create | `continuous-improvement-global` | LIVE | weekly improvement verdict | Fort | gap-score/département | REUSE |
| 4 | Marketing & Acquisition | demandes qualifiées | module `marketing` + 3 agents G1 | SUPPORT | acquisition report | Moyen | mesuré 06-01 : GA4 **10 475 sessions/30 j** ; **direct 75 %** avec bounce ~100 % (signal bot/qualité suspect à vérifier), organic 22 % ; levier = fiabiliser direct + routage home/blog→produit | REUSE |
| 5 | Brand & Communication | confiance / avis | brand-compliance-gate + `fafa-brand-safety-reviewer` | LIVE | brand compliance report | Moyen | avis & cohérence | REUSE |
| 6 | Contenu éditorial | contenu validé réutilisable | `blog`/`ai-content` + `content-audit` | LIVE | content coverage report | Moyen | contenu→page→ATC | REUSE |
| 7 | Production Pages & SEO | pages générant ATC | module `seo` + R-agents SEO + `seo-gamme-audit` | LIVE | page report | Faible/Moyen | pages vues sans ATC (452→18) | IMPROVE |
| 8 | Media & Fafa | demandes issues vidéo | Fafa factory + `fafa-*` skills | MANUAL | media performance report | Moyen/Fort | source_code→demande (0) | IMPROVE |
| 9 | Knowledge RAW & WIKI | fiches WIKI validées | `rag-*` + `wiki-proposal-writer` + `rag-check` | SUPPORT | wiki readiness report | Fort | readiness chain ADR-033 | IMPROVE |
| 10 | Catalogue & Compatibilité | erreurs compat ↓ + dispo affichée vs réelle | `catalog`/`vehicles` + `vehicle-ops` + catalog-integrity | LIVE | catalog integrity report | **Moyen** | mesuré 06-01 : **~11,7k pièces embrayage affichées vendables** (épicentre rupture). Quarantaine **reportée → APRÈS sentinelle dispo (cf #12)**, jamais hide aveugle | **IMPROVE** |
| 11 | Diagnostic & Assistance | demandes issues diagnostic | `diagnostic-engine` + `vehicle-ops` | LIVE | diagnostic report | Moyen | diag→produit (5/196) | REUSE |
| 12 | **Achats & Fournisseurs** | dispo réelle / remb. rupture | tarif `price-import`(LIVE) + `suppliers.service`+`___xtr_supplier`(LIVE) + connecteur `reconcile`(contrat) + module `supplier-truth` (fusionné, inerte par flag) + `pri_dispo`/`pri_marge_n` | LIVE + DORMANT | supplier availability report | **Critique** | **ORDRE = tarif→config tous fournisseurs→sentinelle dispo→quarantaine**. `supplier-truth` (connecteurs inoshop→DistriCash **spl_id 71** « DCA » — réconciliation 06-01, pas 26 — + CAL spl_id 19, truth-engine, sync = sentinelle). **Niveaux de preuve au 2026-10-04 (`main` 27da20f66)** : code présent **oui** · branché **oui** (`AppModule` : `GET api/admin/supplier-truth/status`, admin, lecture seule ; `WorkerModule` : runner + scheduler Bull 4 h + job processor) · activé **seulement si** `SUPPLIER_TRUTH_SYNC_ENABLED` vaut exactement `true` (DEV : absent ; `.env.example` : `false` ; PREPROD/PROD : non vérifié) · exécution observée **non vérifiable** (lecture base PROD non autorisée) · dispo fournisseur vérifiée **non**. Désactivation désormais totale : le flag à `false` désarme le repeatable persistant dans Redis et le job processor refuse tout job résiduel (recette #9, 2026-10-04). `OrderAvailabilityService` n'a **aucun** consommateur panier/commande et lit les tables de consensus H3 qu'aucune migration ne déclare. Chantier = activation owner-gated + H3 + câblage panier/commande, PAS construire. Quarantaine en dernier | IMPROVE |
| 13 | **Commercial & Ventes** | paiement **gardé** | `orders`/`cart` + funnel `__seo_event_log` | LIVE | sales funnel report | **Critique** | panier→checkout→payé | IMPROVE |
| 14 | Service Client & Fidélisation | relances / satisfaction | `support` + retention agent + abandoned-cart | DORMANT | retention report | Faible | 0 panier abandonné capturé | IMPROVE |
| 15 | Logistique & Opérations | délais / retours | `shipping`/`orders` (physique externe) | SUPPORT / NO-CODE | délais/retours report | Moyen | délai réel expédition | IMPROVE / NO-CODE |
| 16 | Pricing | marge nette protégée | `pricing` + `PricingInvariantsService` | LIVE | margin risk report | Fort | marge sur paniers réels | REUSE |
| 17 | Finance & Comptabilité | cash / paiements reçus | `invoices` + compta externe | NO-CODE | cash digest (manuel) | Support | cash net après annulations | NO-CODE |
| 18 | Juridique & Assurances | conformité | — | NO-CODE | — | Dormant | — | NO-CODE |
| 19 | Risk & Audit | risques suivis | `audit/` + ratchets CI + `runtime-truth-audit` | LIVE | risk/drift report | Moyen | risques ouverts/fermés | REUSE |
| 20 | Produit & Expérience Client | conversion / abandon | `frontend-design`/`responsive-audit`/`web-vitals-audit` + design-tokens | MANUAL | UX/CWV audit report | Faible/Moyen | mesuré 06-01 : **page NON coupable (98,6% vendables)** ; 96% non-ajout = **mix-trafic/intention** (gammes cheap browse = 0 panier) + **INP mobile 712ms (poor)** | IMPROVE |
| 21 | IT & Runtime | site fiable & mesuré | NestJS/Remix/Supabase + CTO + `runtime-truth-audit` | LIVE | runtime health report | Fort | segment panier→paiement aveugle | REUSE |
| 22 | **Data & Analytics** | tracking fiable (vérité) | RCOP (`seo-monitoring`) + `web-vitals-audit` | LIVE | tracking integrity report | Moyen | mesuré 06-01 : tracking site-wide **EXISTE déjà** (`__seo_ga4_daily` 10 488 l. + `__seo_gsc_daily` 47 899 l.) ; reste aveugle = **segment panier→paiement** + **attribution 0 %** (≠ « haut non mesuré ») | IMPROVE |
| 23 | IA, Agents & Automatisation | capacités utiles ≠ complexité | `canonical.json` + skills registry + `continuous-improvement-global` | LIVE | capability report | Moyen | agents non reliés/inutilisés | REUSE (PAUSE création) |
| 24 | People, Formation & Doc | système compréhensible | `.claude/knowledge` + REPO_MAP + `.claude/rules` | LIVE | doc coverage report | Faible | modules « rôle à rédiger » | REUSE |

**Types Team Topologies** — Stream : Marketing · Pages&SEO · Commercial · Service Client · Fafa · Produit · | Platform : IT · Data · IA/Agents · | Enabling : Gouvernance · Stratégie&Scoring · Risk&Audit · People/Doc · Brand · | Complicated-subsystem : Catalogue · Pricing · Diagnostic · Knowledge · Achats.

**Bilan : 12 REUSE (dont #23 « PAUSE création ») · 9 IMPROVE · 2 NO-CODE · 1 mixte IMPROVE / NO-CODE (#15) = 24**, chaque ligne comptée une seule fois (REUSE : 1-6, 11, 16, 19, 21, 23, 24 · IMPROVE : 7-10, 12-14, 20, 22 · NO-CODE : 17, 18). Rien à construire — voir le backlog parké dans le scorecard tunnel.

### Réconciliation 24 départements ↔ 20 slugs YAML

Les **24 lignes** ci-dessus sont la carte narrative ; `agent-operating-map.yaml` (`departments:`) porte **20 slugs**.
Correspondance exhaustive (aucun id inventé). Le numéro de ligne n'est **pas** un domaine technique : la ligne #16
« Pricing » n'a rien à voir avec le domaine D16 « Maintenance » de `domains.yaml`.

| # | Département (narratif) | Slug YAML | Écart |
|---|---|---|---|
| 1 | Direction générale | — | aucun slug |
| 2 | Gouvernance | `governance` | — |
| 3 | Stratégie & Scoring | `strategy` | — |
| 4 | Marketing & Acquisition | `marketing` | — |
| 5 | Brand & Communication | `brand` | — |
| 6 | Contenu éditorial | `content` | — |
| 7 | Production Pages & SEO | `seo` | — |
| 8 | Media & Fafa | `media` | — |
| 9 | Knowledge RAW & WIKI | `wiki` | — |
| 10 | Catalogue & Compatibilité | `catalog` | — |
| 11 | Diagnostic & Assistance | `diagnostic` | — |
| 12 | Achats & Fournisseurs | `supplier` | état/preuve YAML périmés (citent la branche `feat/supplier-truth-runtime-wiring` « not merged ») |
| 13 | Commercial & Ventes | `sales` | — |
| 14 | Service Client & Fidélisation | `support` | — |
| 15 | Logistique & Opérations | `logistics` | — |
| 16 | Pricing | `pricing` | — |
| 17 | Finance & Comptabilité | `finance` | libellé YAML « Finance & Facturation » |
| 18 | Juridique & Assurances | — | aucun slug |
| 19 | Risk & Audit | — | aucun slug |
| 20 | Produit & Expérience Client | — | aucun slug |
| 21 | IT & Runtime | `runtime` | libellé YAML « Runtime & Observability » |
| 22 | Data & Analytics | `data` | — |
| 23 | IA, Agents & Automatisation | `ia-agents` | — |
| 24 | People, Formation & Doc | `people` | **homonymie seule** : le slug est « People & Staff » (capacité `staff`, `repo_domains` D11+D13), alors que la ligne #24 désigne la doc et la connaissance (`.claude/knowledge`, REPO_MAP, `.claude/rules`). Le module `backend/src/modules/staff/` (gestion admin du personnel) est classé **D8** dans `canonical.json`. Périmètres disjoints. |

**20 slugs = 24 − 4 lignes sans slug (#1, #18, #19, #20)** ; aucun slug sans ligne. Conséquence : le Command
Center (`scripts/governance/build-command-center-snapshot.js` → `audit/registry/command-center-snapshot.json` →
`/admin/command-center`) affiche ces **20** slugs, pas les 4 autres. Le YAML n'est **pas** étendu ici. Il faudrait
créer 4 ids nouveaux et leur attribuer des `repo_domains` (le schéma en exige au moins un, et un `state` parmi
`live/partial/dormant/broken/duplicate`). Or Juridique est NO-CODE et Direction générale est hors repo : ce serait
inventer, dans `.spec/00-canon/**`, qui est owner-only. **Décision owner.** D'ici là, ces 4 lignes ne sont suivies
que dans ce document. Les écarts de la ligne 12 et de `people` relèvent du même fichier : correctif proposé à
l'owner, non appliqué ici.

### État opérationnel au 2026-10-04 (recette départementale)

**Base** : `main` f1c601170 + branche `worktree-departments-operational`, non fusionnée.

**Environnement** : DEV uniquement. Les tests tournent sous jest. Les destinations base, Redis, stockage objet et
recherche pointent vers `127.0.0.1:1`, une adresse injoignable. Aucune application n'a été démarrée, faute d'isolation
prouvée des destinations du `.env` DEV. Aucune transaction, publication, campagne ni écriture distante.

**Lecture des colonnes**

- **Owner déclaré** : le `lead` du YAML. C'est un **rôle**, aucune personne n'est nommée.
- **Résultat observé** : ce que la recette a constaté en DEV. Rien n'a été observé en PREPROD ou en PROD : la lecture
  de la base PROD n'est pas autorisée.
- **Certification** du Command Center : `CERTIFIED` est **structurel** (cartographie et preuves déclarées). Ce n'est
  pas une certification métier.
- **Suites marquées (r)** : rejouées sur la base f1c601170. Les autres ont tourné sur la base 27da20f66. Le delta
  27da20f66→f1c601170 ne touche pas leur code (images frontend, annulation de commande, migration SQL associée), et
  la partie commande a été rejouée.

**KPI** : aucun des 20 `kpi_primary` n'a de producteur. Le KPI de chaque ligne est donc **indisponible**, ce qui ne
veut pas dire zéro. Unité, fenêtre et fraîcheur sont sans objet tant qu'aucun producteur n'existe.

**Proxys existants, non promus KPI**

- Pricing : contrôle `VENTE_BELOW_ACHAT` à l'import.
- Wiki : `scripts/wiki/wiki-readiness-check.py`, non lancé dans cette recette.
- Ventes : la définition de « paiement gardé » existe dans [sales-funnel-scorecard.md](./sales-funnel-scorecard.md)
  (payée et non annulée), sans producteur automatique.

| # | Département | Périmètre validé | Mode | Env. | Owner déclaré | Résultat observé | Preuve | Difficulté restante | Prochaine action |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Direction générale | aucun | DORMANT | hors dépôt | aucun (pas de slug) | non exercé | — | ni slug ni KPI | owner : slug ou suivi narratif seul |
| 2 | Gouvernance | validateur de la carte opérationnelle + auto-tests | LIVE | DEV | `governance-lead` | 0 erreur, 0 avertissement ; auto-tests schéma et handoffs PASS ; snapshot à jour | `validate-agent-operating-map.js --self-test` + `governance:command-center:check` (r) | section 7 warn-only (durcir exige une ADR vault) | owner : patch 03 (déclencheur CI de la fixture) |
| 3 | Stratégie & Scoring | aucun exercice | LIVE (déclaré) | — | `strategy-lead` | non exercé | certification structurelle seule | KPI indisponible | lancer le skill sur demande owner |
| 4 | Marketing & Acquisition | module `marketing` | SUPPORT | DEV | `marketing-lead` | 1 suite / 12 tests verts | jest isolé | handoff vers Ventes ASPIRATIONAL ; KPI indisponible | owner : contrat du handoff, ou statut documenté |
| 5 | Brand & Communication | aucun exercice | LIVE (déclaré) | — | `brand-lead` | non exercé | — | KPI indisponible | gate brand à la prochaine publication (humain) |
| 6 | Contenu éditorial | module `blog` | LIVE | DEV | `content-lead` | 6 suites / 84 tests verts | jest isolé | handoff vers SEO PARTIAL ; KPI indisponible | chantier contenu existant (hors mission) |
| 7 | Production Pages & SEO | `seo`, `seo-control-plane`, `seo-monitoring`, `seo-projection`, robots | LIVE | DEV | `seo-lead` | 39/379, 7/61, 14/165 (+7/73), 7/76, 73 verts | jest isolé | SEO indexé = zone STOP ; KPI indisponible | aucune dans cette mission |
| 8 | Media & Fafa | tests `video-*`, flag media-factory | MANUAL | DEV | `media-lead` | environ 9 suites + 10 tests de flag, verts | jest isolé | aucune publication (hors mandat) ; KPI indisponible | owner |
| 9 | Knowledge RAW & WIKI | proxy et webhook RAG | SUPPORT | DEV | `wiki-lead` | 2 suites / 14 tests + 10 verts | jest isolé | proxy readiness non branché en KPI | lancer `wiki-readiness-check.py` (lecture seule) |
| 10 | Catalogue & Compatibilité | `catalog`, `gamme-rest`, RPC véhicule, validation véhicule | LIVE | DEV | `catalog-lead` | 6/81, 2/19, 16, 16 verts | jest isolé | dispo affichée dépend de #12 (inactif) | après activation owner de #12 |
| 11 | Diagnostic & Assistance | `diagnostic-engine` | LIVE | DEV | `diagnostic-lead` | 15 suites / 459 tests verts | jest isolé | chantier en pause (doctrine) ; KPI indisponible | aucune |
| 12 | Achats & Fournisseurs | désactivation totale de `supplier-truth` (recette #9) | LIVE + DORMANT (inerte par flag) | DEV | `supplier-lead` | **corrigé** : flag ≠ `true` désarme le repeatable et refuse les jobs résiduels | jest 22/224 (r) + preuve Bull sur Redis local | activation = décision owner ; aucun consommateur panier/commande ; YAML périmé | owner : patch 02, puis décision d'activation |
| 13 | Commercial & Ventes | panier, commande, callbacks (recette #1-#10) | LIVE, critique | DEV | `sales-lead` | Zone STOP owner — résultat de recette tenu hors dépôt public | suites parcours argent 25/278 vertes (r) | Zone STOP owner | revue owner de la note remise hors dépôt |
| 14 | Service Client & Fidélisation | `support`, autorisation des routes support | DORMANT | DEV | `support-lead` | 2/22 + 300 verts | jest isolé | certification UNKNOWN ; KPI indisponible | owner |
| 15 | Logistique & Opérations | autorisation des expéditions, poids de livraison | SUPPORT / NO-CODE | DEV | `logistics-lead` | 11 verts + suite poids (r) | jest isolé | opérations physiques externes | aucune (manuel) |
| 16 | Pricing | `pricing` | LIVE | DEV | `pricing-lead` | Zone STOP owner — résultat de recette tenu hors dépôt public | 12 suites vertes (r) | Zone STOP owner | revue owner de la note remise hors dépôt |
| 17 | Finance & Comptabilité | aucun exercice (compta externe) | NO-CODE | hors dépôt | `finance-lead` | non exercé | — | vérité paiement = #13 | owner |
| 18 | Juridique & Assurances | aucun | NO-CODE | hors dépôt | aucun (pas de slug) | non exercé | — | — | aucune |
| 19 | Risk & Audit | invariants registry, projections, candidats PR-8 | LIVE | DEV | aucun (pas de slug) | invariants 6/6 ; deux régénérations identiques (hors horodatage par conception) ; `--check` rc=0 | `registry:validate-invariants` (r), `audit:cleanup-candidates --check` | avertissement I3 préexistant (cycle cross-selling) | owner : slug ou suivi narratif seul |
| 20 | Produit & Expérience Client | aucun | MANUAL | — | aucun (pas de slug) | non exercé | — | — | owner |
| 21 | IT & Runtime | `observability`, `src/config`, `src/auth`, santé des jobs admin | LIVE | DEV | `runtime-lead` | 2/12, 13/227, 9/230, 10 verts | jest isolé | démarrage applicatif non lancé : isolation des destinations non prouvée | owner : environnement DEV isolé pour une recette de bout en bout |
| 22 | Data & Analytics | module `analytics` | LIVE | DEV | `data-lead` | 3 suites / 31 tests verts | jest isolé | segment panier→paiement aveugle ; KPI indisponible | owner |
| 23 | IA, Agents & Automatisation | carte opérationnelle, snapshot Command Center, lecteur registry, MCP | LIVE (PAUSE création) | DEV | `ia-agents-lead` | doublons et orphelins de handoff désormais signalés (warn) ; snapshot environ 120, lecteur 23, MCP 54 verts | auto-test handoffs (r) | 10/10 handoffs `planned` ; aucun chemin d'exécution ne consomme `department_handoffs`, ni refus ni reprise | owner : contrat d'un premier handoff avant tout câblage |
| 24 | People, Formation & Doc | REPO_MAP (D16 rendu), staff | LIVE | DEV | `people-lead` (homonyme) | test REPO_MAP 7/7 (r) ; staff 1/3 | `tsx --test tests/registry/llm-repo-map.test.ts` | test non câblé en CI ; homonymie de slug | owner : patch 01, et décider d'un second slug |

**Usage du Command Center** (réutilisé ; aucun cron, aucun coût, pas de « run all »)

- `npm run governance:command-center` : régénère le snapshot depuis le YAML.
- `npm run governance:command-center:check` : vérifie la fraîcheur du snapshot (pre-commit).
- `npm run governance:test:command-center` : lance les tests du builder.
- `node scripts/governance/validate-agent-operating-map.js [--self-test|--strict|--json]` : valide la carte.
- Route admin `/admin/command-center`, exposition réglée par `COMMAND_CENTER_MODE` :
  - par défaut, `full` hors production et `disabled` en production ;
  - `light` retire les départements.

**Ce que le Command Center affiche et n'affiche pas**

- Il affiche les **20 slugs**, pas les 4 lignes sans slug.
- Depuis le 2026-10-04, chaque carte montre aussi l'owner déclaré et l'état.
- La prochaine action owner se lit dans la file d'actions, les handoffs dans l'onglet chaînes.
- La « dernière preuve » par département n'est pas portée par le snapshot : elle reste dans le tableau ci-dessus.

---

## Vue 2 — Top 5 problèmes business (mesurés 2026-05-31, **affinés 2026-06-01**, 30 j)
1. **0 vente gardée / 30 j** — 3 paiements, **3 annulés**.
2. **Cause directe = rupture fournisseur** — annulations « pas dispo » / « plus disponible » (100 % des paiements récents).
3. **vue → panier ≈ 4 % (sous-funnel `/pieces`)** — 452 sessions vue produit → 18 paniers. **Vrai funnel site (GA4 06-01) = 0,17 % panier** : 10 475 sessions → mêmes 18 paniers. Catalogue/page produit **non retenus comme fuite principale à ce stade** : 98,6 % vendable mesuré 06-01.
4. **Acquisition faible qualité** (corrige « haut non mesuré » — GA4/GSC peuplés) — direct **75 %** avec bounce ~100 % (signal bot/qualité suspect à vérifier), **SEO CTR 0,27 %** (85 clics) malgré rank pos 4-43 sur vraies requêtes pièces ; seule la requête marque « automecanik » clique.
5. **Instrumentation aveugle** — segment panier→paiement non tracké · attribution 0 % · panier abandonné 0 capturé.

→ Détail, chiffres et actions : **[sales-funnel-scorecard.md](./sales-funnel-scorecard.md)**.

---

## Vue 3 — Flux de production (où ça casse)
| Flux | Statut |
|---|---|
| RAW → WIKI | Actif (ADR-031/033 en cours) |
| WIKI → PAGE | Partiel (chaîne readiness) |
| PAGE → DEMANDE | **Faible** (sous-funnel `/pieces` 4 % ; **funnel site 0,17 %**) |
| FAFA → DEMANDE | Non mesuré (0 source_code→demande) |
| DIAGNOSTIC → PAGE/DEMANDE | **Cassé** (diag→produit 5/196) |
| DEMANDE → DEVIS | n/a (pas de flux devis instrumenté) |
| DEVIS → PAIEMENT | **Aveugle** (pas d'event checkout/paiement) |
| COMMANDE → LIVRAISON | Partiel (orders FSM) |
| **REMBOURSEMENT → CAUSE → AMÉLIORATION** | **Cause identifiée = rupture** → boucle à fermer (Achats) |

---

## Vue 4 — Décision scoring (taxonomie)
`REUSE` (existe, utiliser) · `IMPROVE` (existe, incomplet) · `CREATE_CHECKLIST` · `CREATE_SCRIPT` · `CREATE_SKILL` · `CREATE_AGENT` · `PAUSE` · `NO-CODE`.
**Règle :** pas de `CREATE_SKILL`/`CREATE_AGENT` sans gap-score prouvé. Aujourd'hui : **0 création** — tout est REUSE/IMPROVE.

---

## Vue 5 — Format de rapport départemental standard
> Mini-report **on-demand, read-only** (l'automatisation reste **parquée**, owner-GO). C'est le chaînon qui permet à un agent de **travailler seul** sans réinventer la stratégie : il sait son département, son KPI, sa source, son rapport, sa règle de décision.

| Champ | Rôle |
|---|---|
| Département | nom |
| Période | jour / semaine / mois |
| KPI principal | chiffre clé |
| Score | Fort / Moyen / Faible / Critique |
| Évolution | mieux / stable / pire |
| Preuve | source utilisée |
| Trou détecté | problème principal |
| Cause probable | hypothèse |
| Action proposée | REUSE / IMPROVE / CREATE / PAUSE |
| Risque | faible / moyen / haut |
| Owner-GO requis | oui / non |
| Prochaine preuve | next evidence |

---

## Vue 6 — Structure de pilotage (départements critiques)
| Département | Agents / skills / capacités | Modules | KPI | Rapport |
|---|---|---|---|---|
| Achats & Fournisseurs | Supplier-Truth engine (fusionné, inerte par flag — cf. ligne 12) + `pri_dispo`/`pri_marge_n` | suppliers / pricing | dispo réelle | supplier availability report |
| Commercial & Ventes | funnel checker `__seo_event_log` | orders / cart | paiement gardé | sales funnel report |
| Pages & SEO | R-agents SEO + `seo-gamme-audit` | seo / wiki | vue→ATC | page report |
| Media & Fafa | `fafa-*` skills | Fafa factory | demande issue vidéo | media performance report |
| Pricing | `PricingInvariantsService` | pricing | marge nette | margin risk report |
| Data & Analytics | `web-vitals-audit` / `runtime-truth-audit` | RCOP / event logs | tracking fiable | tracking integrity report |
| IA / Agents | `continuous-improvement-global` | canonical.json / skills registry | agents utiles | capability report |

---

## Exemples de mini-reports — **preuves sur la période mesurée : 30 derniers jours**
> Source `sales-funnel-scorecard.md`, **à réactualiser chaque semaine** — *pas une vérité éternelle.*

**Achats & Fournisseurs** — KPI : paiements remboursés pour indisponibilité · Résultat : 3 paiements, **3 annulés « pas dispo »** · Score : Critique · Évolution : 1ʳᵉ mesure · Preuve : sales-funnel-scorecard.md · Trou : dispo fournisseur non fiable sur les produits qui atteignent le paiement · Cause probable : `pri_dispo` binaire jamais rafraîchi · Action : **REUSE** (vérifier dispo/marge/fournisseur sur les produits du tunnel) · Risque : moyen · Owner-GO : oui (tout gate) · Prochaine preuve : score dispo/marge/fournisseur des produits vus/paniers/payés.

**Commercial & Ventes** — KPI : paiement gardé · Résultat : **0** · Score : Critique · Évolution : 1ʳᵉ mesure · Preuve : sales-funnel-scorecard.md · Trou : des paniers + quelques paiements, mais **aucune vente conservée** · Cause probable : annulation rupture en aval · Action : **IMPROVE** (mesurer vue→panier et paiement→gardé) · Risque : moyen · Owner-GO : non (mesure) · Prochaine preuve : produits des 18 paniers et 3 paiements.

**Production Pages & SEO** — KPI : vue produit → ajout panier · Résultat : **~4 %** (452→18) · Score : Faible/Moyen · Évolution : 1ʳᵉ mesure · Preuve : sales-funnel-scorecard.md · Trou : les pages vues ne convainquent pas assez · Cause probable : compatibilité/prix/CTA insuffisants (Apple Trust) · Action : **IMPROVE** (analyser les pages vues sans ATC ; **ne pas créer de pages**) · Risque : faible · Owner-GO : non (analyse) · Prochaine preuve : top pages vues sans ATC.

---

## Scorecard hebdo — 6 départements critiques (pas 24/jour)
| Département | KPI semaine | Verdict (2026-05-31) |
|---|---|---|
| Commercial & Ventes | paiements **gardés** | 🔴 0/30j |
| Achats & Fournisseurs | annulations « pas dispo » | 🔴 3/3 paiements |
| Produit & Expérience Client | vue→panier % | 🟠 ~3,4% — cause mesurée = **mix-trafic/intention + INP mobile 712ms** (page innocentée : 98,6% vendable) |
| Data & Analytics | tunnel mesuré vs aveugle | 🟠 **haut mesuré 06-01** (GA4+GSC peuplés) ; reste aveugle = panier→paiement + attribution 0 % |
| Catalogue & Compatibilité | erreurs compat / dispo affichée | 🔴 ~11,7k pièces embrayage affichées vendables (rupture exposée, quarantaine = 3) |
| IT & Runtime | site fiable + events tunnel | 🟠 segment paiement non tracké |

---

## Fiches courtes — départements critiques
**Commercial & Ventes** — Mission : transformer demandes en paiements gardés · Existant : `orders`+`cart`+funnel · Score : Critique · KPI : paiements gardés · Problème : 0 vente gardée/30j · Action : mesurer panier→checkout→payé (fait : 9→3→0) · Décision : IMPROVE.
**Achats & Fournisseurs** — Mission : la bonne pièce dispo au bon délai · Existant : `suppliers` + Supplier-Truth (fusionné, inerte par flag — niveaux de preuve en ligne 12) · Score : Critique · KPI : disponibilité réelle · Problème : 3/3 paiements annulés rupture · Action : activation owner-GO de la sentinelle, puis projection consensus H3 (la route `projection/:pieceId` a été retirée le 2026-09-10 : sa table n'a jamais existé) → gate dispo avant vente (owner-GO) · Décision : IMPROVE.
**Produit & Expérience Client** — Mission : simplifier le parcours d'achat · Existant : skills front + design-tokens · Score : Faible/Moyen · KPI : conversion/abandon · Problème : vue→panier 4 % · Action : auditer pages vues sans ATC (Apple Trust : compat/prix/CTA) · Décision : IMPROVE.
**Data & Analytics** — Mission : dire où le tunnel bloque · Existant : RCOP + `__seo_event_log` · Score : Moyen · KPI : tracking fiable · Problème : haut & panier→paiement aveugles, attribution 0 % · Action : requêtes lecture seule (faites) + brancher trafic total · Décision : IMPROVE.
**Catalogue & Compatibilité** — Mission : bonne pièce/bon véhicule · Existant : `catalog`+`vehicles` · Score : Moyen (mesure 06-01, ligne 10) · KPI : erreurs compat ↓ + dispo affichée vs réelle · Problème : ~11,7k pièces embrayage affichées vendables ; compat affichée vs réelle non mesurée · Action : croiser dispo fournisseur × compat, quarantaine seulement après la sentinelle dispo (#12) · Décision : IMPROVE.
**IT & Runtime** — Mission : site fiable & mesuré · Existant : NestJS/Remix/Supabase · Score : Fort · KPI : site fiable + events tunnel · Problème : segment panier→paiement non instrumenté · Action : backlog events (owner-GO, payment-adjacent) · Décision : REUSE.

---

## Roadmap par horizon
- **Court terme (maintenant)** : tunnel jusqu'au paiement **gardé** — fermer la fuite rupture (Achats) + **acquisition** (fiabiliser direct 75 %, CTR SEO 0,27 % owner-gated, routage home/blog→produit) ; page/catalogue non retenus comme fuite principale 06-01. *Mesure d'abord, gate ensuite (owner-GO).*
- **Moyen terme** : pages/contenu/Fafa/diagnostic **reliés aux demandes** (source_code→demande, diag→produit, chaîne RAW→WIKI→page). Documenté, pas construit.
- **Long terme** : fidélisation véhicule + rappels entretien (vidange, CT, pneus, assurance), agents/Paperclip orchestration, automatisation — seulement si le scoring le prouve.
