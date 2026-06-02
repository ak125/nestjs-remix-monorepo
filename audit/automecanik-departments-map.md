# AutoMecanik — Tableau de pilotage (24 départements)

> Doc d'analyse/pilotage (pas un registre, pas du canon). Pointe vers l'existant — ne
> duplique pas `canonical.json`. Maj : 2026-05-31. Voir le tunnel : [sales-funnel-scorecard.md](./sales-funnel-scorecard.md).
> **Règle d'or : existant d'abord → mesurer → améliorer → créer seulement si le scoring prouve le manque → pause sinon.**

> **Ce document ne crée aucun agent, aucun registre, aucun module et aucune infrastructure de reporting.
> Il route les capacités existantes vers les départements, clarifie leur mode de maturité, et définit le
> rapport attendu pour permettre le pilotage par scoring.**

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
| 4 | Marketing & Acquisition | demandes qualifiées | module `marketing` + 3 agents G1 | SUPPORT | acquisition report | Moyen | trafic total réel (GA4) | REUSE |
| 5 | Brand & Communication | confiance / avis | brand-compliance-gate + `fafa-brand-safety-reviewer` | LIVE | brand compliance report | Moyen | avis & cohérence | REUSE |
| 6 | Contenu éditorial | contenu validé réutilisable | `blog`/`ai-content` + `content-audit` | LIVE | content coverage report | Moyen | contenu→page→ATC | REUSE |
| 7 | Production Pages & SEO | pages générant ATC | module `seo` + R-agents SEO + `seo-gamme-audit` | LIVE | page report | Faible/Moyen | pages vues sans ATC (452→18) | IMPROVE |
| 8 | Media & Fafa | demandes issues vidéo | Fafa factory + `fafa-*` skills | MANUAL | media performance report | Moyen/Fort | source_code→demande (0) | IMPROVE |
| 9 | Knowledge RAW & WIKI | fiches WIKI validées | `rag-*` + `wiki-proposal-writer` + `rag-check` | SUPPORT | wiki readiness report | Fort | readiness chain ADR-033 | IMPROVE |
| 10 | Catalogue & Compatibilité | erreurs compat ↓ + dispo affichée vs réelle | `catalog`/`vehicles` + `vehicle-ops` + catalog-integrity | LIVE | catalog integrity report | **Moyen** | mesuré 06-01 : **~11,7k pièces embrayage affichées vendables** (épicentre rupture). Quarantaine **reportée → APRÈS sentinelle dispo (cf #12)**, jamais hide aveugle | **IMPROVE** |
| 11 | Diagnostic & Assistance | demandes issues diagnostic | `diagnostic-engine` + `vehicle-ops` | LIVE | diagnostic report | Moyen | diag→produit (5/196) | REUSE |
| 12 | **Achats & Fournisseurs** | dispo réelle / remb. rupture | tarif `price-import`(LIVE) + `suppliers.service`+`___xtr_supplier`(LIVE) + connecteur `reconcile`(contrat) + DistriCash spl_id 26 (worktree) + `pri_dispo`/`pri_marge_n` | LIVE + WORKTREE | supplier availability report | **Critique** | **ORDRE = tarif→config tous fournisseurs→sentinelle dispo→quarantaine**. **Méthode vérif dispo EXISTE** : module `supplier-truth` (worktree `feat/supplier-cal-connector`, 18 tests, **0 PR, 123 commits derrière main**) — connecteurs inoshop→DistriCash(26)+CAL, truth-engine, sync scheduler (=sentinelle), `OrderAvailabilityService→NOMINAL/REVIEW/EQUIVALENCE`. Chantier = **rebase+merge read-only + câbler flux panier/commande**, PAS construire. Quarantaine en dernier | IMPROVE |
| 13 | **Commercial & Ventes** | paiement **gardé** | `orders`/`cart` + funnel `__seo_event_log` | LIVE | sales funnel report | **Critique** | panier→checkout→payé | IMPROVE |
| 14 | Service Client & Fidélisation | relances / satisfaction | `support` + retention agent + abandoned-cart | DORMANT | retention report | Faible | 0 panier abandonné capturé | IMPROVE |
| 15 | Logistique & Opérations | délais / retours | `shipping`/`orders` (physique externe) | SUPPORT / NO-CODE | délais/retours report | Moyen | délai réel expédition | IMPROVE / NO-CODE |
| 16 | Pricing | marge nette protégée | `pricing` + `PricingInvariantsService` | LIVE | margin risk report | Fort | marge sur paniers réels | REUSE |
| 17 | Finance & Comptabilité | cash / paiements reçus | `invoices` + compta externe | NO-CODE | cash digest (manuel) | Support | cash net après annulations | NO-CODE |
| 18 | Juridique & Assurances | conformité | — | NO-CODE | — | Dormant | — | NO-CODE |
| 19 | Risk & Audit | risques suivis | `audit/` + ratchets CI + `runtime-truth-audit` | LIVE | risk/drift report | Moyen | risques ouverts/fermés | REUSE |
| 20 | Produit & Expérience Client | conversion / abandon | `frontend-design`/`responsive-audit`/`web-vitals-audit` + design-tokens | MANUAL | UX/CWV audit report | Faible/Moyen | mesuré 06-01 : **page NON coupable (98,6% vendables)** ; 96% non-ajout = **mix-trafic/intention** (gammes cheap browse = 0 panier) + **INP mobile 712ms (poor)** | IMPROVE |
| 21 | IT & Runtime | site fiable & mesuré | NestJS/Remix/Supabase + CTO + `runtime-truth-audit` | LIVE | runtime health report | Fort | segment panier→paiement aveugle | REUSE |
| 22 | **Data & Analytics** | tracking fiable (vérité) | RCOP (`seo-monitoring`) + `web-vitals-audit` | LIVE | tracking integrity report | Moyen | trafic total + attribution (0 %) | IMPROVE |
| 23 | IA, Agents & Automatisation | capacités utiles ≠ complexité | `canonical.json` + skills registry + `continuous-improvement-global` | LIVE | capability report | Moyen | agents non reliés/inutilisés | REUSE (PAUSE création) |
| 24 | People, Formation & Doc | système compréhensible | `.claude/knowledge` + REPO_MAP + `.claude/rules` | LIVE | doc coverage report | Faible | modules « rôle à rédiger » | REUSE |

**Types Team Topologies** — Stream : Marketing · Pages&SEO · Commercial · Service Client · Fafa · Produit · | Platform : IT · Data · IA/Agents · | Enabling : Gouvernance · Stratégie&Scoring · Risk&Audit · People/Doc · Brand · | Complicated-subsystem : Catalogue · Pricing · Diagnostic · Knowledge · Achats.

**Bilan : 16 REUSE · 6 IMPROVE · 2 NO-CODE.** Rien à construire — voir le backlog parké dans le scorecard tunnel.

---

## Vue 2 — Top 5 problèmes business (mesurés 2026-05-31, 30 j)
1. **0 vente gardée / 30 j** — 3 paiements, **3 annulés**.
2. **Cause directe = rupture fournisseur** — annulations « pas dispo » / « plus disponible » (100 % des paiements récents).
3. **vue → panier ≈ 4 %** — 452 sessions vue produit → 18 paniers.
4. **Trafic faible + haut du tunnel non mesuré** — 452 vues produit/30 j, total site inconnu (pas dans `__seo_event_log`).
5. **Instrumentation aveugle** — segment panier→paiement non tracké · attribution 0 % · panier abandonné 0 capturé.

→ Détail, chiffres et actions : **[sales-funnel-scorecard.md](./sales-funnel-scorecard.md)**.

---

## Vue 3 — Flux de production (où ça casse)
| Flux | Statut |
|---|---|
| RAW → WIKI | Actif (ADR-031/033 en cours) |
| WIKI → PAGE | Partiel (chaîne readiness) |
| PAGE → DEMANDE | **Faible** (4 % vue→panier) |
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
| Achats & Fournisseurs | Supplier-Truth engine (WORKTREE) + `pri_dispo`/`pri_marge_n` | suppliers / pricing | dispo réelle | supplier availability report |
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
| Data & Analytics | tunnel mesuré vs aveugle | 🟠 haut + panier→paiement aveugles |
| Catalogue & Compatibilité | erreurs compat / dispo affichée | 🔴 ~11,7k pièces embrayage affichées vendables (rupture exposée, quarantaine = 3) |
| IT & Runtime | site fiable + events tunnel | 🟠 segment paiement non tracké |

---

## Fiches courtes — départements critiques
**Commercial & Ventes** — Mission : transformer demandes en paiements gardés · Existant : `orders`+`cart`+funnel · Score : Critique · KPI : paiements gardés · Problème : 0 vente gardée/30j · Action : mesurer panier→checkout→payé (fait : 9→3→0) · Décision : IMPROVE.
**Achats & Fournisseurs** — Mission : la bonne pièce dispo au bon délai · Existant : `suppliers` + Supplier-Truth (worktree) · Score : Critique · KPI : disponibilité réelle · Problème : 3/3 paiements annulés rupture · Action : projection lecture seule `supplier_availability` → gate dispo avant vente (owner-GO) · Décision : IMPROVE.
**Produit & Expérience Client** — Mission : simplifier le parcours d'achat · Existant : skills front + design-tokens · Score : Faible/Moyen · KPI : conversion/abandon · Problème : vue→panier 4 % · Action : auditer pages vues sans ATC (Apple Trust : compat/prix/CTA) · Décision : IMPROVE.
**Data & Analytics** — Mission : dire où le tunnel bloque · Existant : RCOP + `__seo_event_log` · Score : Moyen · KPI : tracking fiable · Problème : haut & panier→paiement aveugles, attribution 0 % · Action : requêtes lecture seule (faites) + brancher trafic total · Décision : IMPROVE.
**Catalogue & Compatibilité** — Mission : bonne pièce/bon véhicule · Existant : `catalog`+`vehicles` · Score : Fort · KPI : erreurs compat ↓ · Problème : compat affichée vs réelle non mesurée · Action : croiser dispo fournisseur × compat · Décision : REUSE.
**IT & Runtime** — Mission : site fiable & mesuré · Existant : NestJS/Remix/Supabase · Score : Fort · KPI : site fiable + events tunnel · Problème : segment panier→paiement non instrumenté · Action : backlog events (owner-GO, payment-adjacent) · Décision : REUSE.

---

## Roadmap par horizon
- **Court terme (maintenant)** : tunnel jusqu'au paiement **gardé** — fermer la fuite rupture (Achats) + comprendre vue→panier 4 % (Produit/Catalogue/Pricing). *Mesure d'abord, gate ensuite (owner-GO).*
- **Moyen terme** : pages/contenu/Fafa/diagnostic **reliés aux demandes** (source_code→demande, diag→produit, chaîne RAW→WIKI→page). Documenté, pas construit.
- **Long terme** : fidélisation véhicule + rappels entretien (vidange, CT, pneus, assurance), agents/Paperclip orchestration, automatisation — seulement si le scoring le prouve.
