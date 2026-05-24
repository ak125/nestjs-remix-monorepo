# Produit C — système d'aide à la décision automobile (gated post commerce-loop V1)

**Date** : 2026-05-23
**Statut** : design validé (plan approuvé), spec à reviewer avant writing-plans. **C n'est PAS implémenté V1 dans cette spec** — Phase 3 GATED par commerce-loop V1 + KPIs + ADRs vault résolus.
**Branche** : `feat/ai-additive-layer-design-spec`
**Plan source** : `/home/deploy/.claude/plans/je-vais-expose-plusieur-resilient-hickey.md` (approuvé 2026-05-23)
**Spec compagnon** : `2026-05-23-ai-additive-layer-phase-0-and-1-design.md` (Phase 0+1, exécutable maintenant)
**Mémoires** : [[project_a_b_c_surfaces_distinction]], [[feedback_product_c_design_invariants]], [[feedback_v1_first_dont_build_ultimate_engine_too_early]], [[feedback_no_rag_for_content_legacy_code_is_not_strategy]], [[feedback_vehicle_context_option_a_locked]], [[feedback_seo_is_not_the_product_acquisition_serves_conversion]]

---

## 1. Vision statement canon

> Le futur différenciant n'est PAS "SEO pour IA".
>
> C'est un système qui aide réellement à prendre une décision automobile fiable :
> - **observable**,
> - **graduée** (en confiance),
> - **commercialement utile** (chemin vers la pièce / le devis),
> - **sans fausse précision**.
>
> Beaucoup plus ambitieux que "AI SEO". Aussi beaucoup plus défendable.

**Positionnement canonique** : C = **"commerce support system"**, PAS "diagnostic AI". Objectif réel = **réduire l'incertitude avant achat**. Pas un assistant médecin de la voiture ; un outil qui aide le user à *décider* quelle pièce/intervention il achète.

**Surface distincte de A/B** (cf. [[project_a_b_c_surfaces_distinction]]) : C est hors-SEO, conversion-first, interactif, n'existe pas aujourd'hui. KPIs, roadmap, ADRs, logique produit tous différents de A (pages symptômes SEO) et B (section R3).

## 2. Nature réelle du produit (anti-confusion)

C n'est PAS :
- un moteur SEO
- un chatbot
- un "AI mechanic"
- un assistant général mécanique
- un forum automobile
- un copilote garage complet

C **est** :
> Un système d'aide à la décision automobile, **guidé, observable et calibré**.

Le vrai produit n'est pas "donner la bonne réponse mécanique". C'est **réduire suffisamment l'incertitude pour permettre une action fiable** (acheter une pièce, demander un devis, escalader vers atelier, surveiller).

## 3. Model UX et architecture data — deux niveaux distincts

**Niveau UX (ce que voit le user, séquentiel)** :
```
problem
  → confidence (qualitatif V1 — buckets uniquement)
  → verification recommandée
  → urgency
  → repairability
  → parts (si pertinent)
  → action (cart / quote / atelier / surveille)
```

**Niveau Data graph (ce que le backend traverse, déterministe)** :
```
problem → vehicle → confidence × {
  cause_hypothesis →
    verification ×
    urgency ×
    repairability →
  parts × supplier_availability × maintenance_interval
} → action_list
```

Le niveau UX est la **séquence linéaire** présentée au user (progressive disclosure). Le niveau Data est le **graphe interne** que le backend traverse. Pas deux schémas concurrents : l'un est UI, l'autre est data.

## 4. Invariants canon (ne JAMAIS violer)

Synthèse de [[feedback_product_c_design_invariants]] (à acter dans les ADRs C de Phase 0).

### 4.1 Deterministic-first (data reliability > LLM reasoning)

Ordre des dépendances :
1. Supplier Truth V1 (mesuré-fiable <5% error)
2. Compatibilité véhicule (VehicleContext locked + `auto_type`/`pieces_gamme`)
3. Maintenance intervals (data canon)
4. OBD2 code mapping (data référentielle)
5. Probabilités simples (rules + freq from `__seo_*` analytics, pas modèle ML)
6. Règles métier explicites
7. **Optionnel et seulement après tout ce qui précède** : génération texte LLM (FAQ/explications, **jamais** verdict)

### 4.2 Invariant anti-"assistant magique"

> C ne pose JAMAIS un diagnostic certain.
> C propose UNIQUEMENT :
> - hypothèses (multiples, ordonnées par confiance)
> - vérifications recommandées
> - niveaux de confiance explicites
> - prochaines actions possibles
>
> Tout output certain ("votre turbo est HS") = bug.

Adresse risque juridique (mauvais diagnostic → user fait mauvaise réparation → préjudice) + risque UX (trust break).

### 4.3 Invariant "C ≠ chatbot libre"

> C reste **guidé et structuré multi-step**, jamais chat libre open-ended.

Sans cet invariant : hallucinations + dérive scope + support impossible + debug impossible. Le flow guidé multi-step est observable, déterministe, testable.

### 4.4 OBD2 = signal, PAS verdict

> Un code OBD2 (`P0401`...) entre comme **élément d'evidence** dans le `Pourquoi` d'une hypothèse, jamais comme la conclusion.
>
> "P0401 présent" entre dans le rationale ; il ne sort jamais en `hypothèse = P0401`.

Beaucoup de projets diagnostic confondent ECU signal et root cause. C ne fait pas cette erreur.

**Note** : cet invariant est canon **forward** — il s'applique le jour où C intégrera la lecture OBD2 (V1.x scope-extension), pas en V1. En V1, OBD2 lookup est HORS scope (cf. §7). L'invariant existe maintenant pour éviter qu'une future V1.x bricole une mauvaise sémantique.

### 4.5 Confidence : buckets visibles, scores numériques cachés (V1)

| Technique interne | Affichage user V1 |
|---|---|
| Score numérique calculé | **Caché** (logs/observabilité only) |
| Confidence bucket (haute/moyenne/basse/aucune) | **Visible** |
| Rationale (evidence-first) | **Visible** |
| Certainty numérique | **Masquée** jusqu'à calibration validée |

Anti-fausse-précision + anti-responsabilité-implicite. Pas de "0.62" affiché en V1.

### 4.6 Repairability = niveau de complexité estimé, JAMAIS prescription

| Profile | Signification | CTA |
|---|---|---|
| `DIY easy` | Complexité basse, outils basiques | Pièce + tuto |
| `DIY medium` | Outils spécifiques ou compétences | Pièce + tuto + atelier option |
| `garage recommended` | Compétence atelier requise | Devis garage primaire, pièce secondaire |
| `critical` | Immobilisation / sécurité | Atelier urgent uniquement, pas de pièce DIY |

**Reformulation canon** : "niveau de complexité estimé", JAMAIS "vous pouvez le faire". Toujours coupler avec "consulter atelier en cas de doute".

### 4.7 A/B (SEO) ≠ C (outil)

Surfaces strictement distinctes. Toute réutilisation cross-surface = ADR de réutilisation explicite. Mêmes vocabulaires (symptôme/cause/pièce/véhicule) ne justifient PAS la fusion. cf. [[project_a_b_c_surfaces_distinction]].

## 5. Cost/Risk awareness + Evidence-first UI

### 5.1 Cost/Risk awareness sur chaque hypothèse

Chaque hypothèse retournée par C inclut :
- `coût_estimatif` (fourchette pièce + main d'œuvre)
- `niveau_urgence` (immédiat / dans la semaine / dans le mois / surveille)
- `risque_roulage` (continuer à rouler = OK / dégradant / dangereux / interdit)

Adresse la vraie question du user : "**est-ce grave ?**".

### 5.2 Evidence-first UI

Chaque hypothèse expose son *pourquoi* :

```
Hypothèse : Vanne EGR encrassée (confiance moyenne)
  Pourquoi :
    - symptôme déclaré : fumée noire au démarrage
    - véhicule : Clio 3 1.5 dCi (motorisation à risque connue)
    - fréquence observée sur cette motorisation : "courante" (qualitatif V1)
    - autres signaux compatibles : perte puissance, ralenti instable
  Vérifications discriminantes :
    - lecture codes OBD2 (P0401 attendu)
    - inspection visuelle ouvertures
```

Anti-magie + pédagogie + confiance + auditabilité.

## 6. KPIs canon (hors-SEO)

| KPI | Pourquoi |
|---|---|
| diagnostic completion rate | UX / engagement |
| CTA click-through | commerce / intent signal |
| add-to-cart rate | conversion directe |
| quote request rate | lead garage |
| supplier match success | vérité opérationnelle (Supplier Truth) |
| symptom resolution confidence (déclaré user) | utilité perçue |
| repeat usage | valeur produit |
| **confidence calibration accuracy** | KPI critique : un bucket "haute" doit correspondre à ≥75% cas justes en cohorte. À mesurer en continu (golden set + user feedback). |
| **escalation-to-garage rate** | Doit corréler avec niveaux de confiance bas + repairability `garage recommended/critical`. Si pas de corrélation → modèle calibré faux. |

**KPIs INTERDITS** pour C : impressions, ranking, AI visibility score, citation rate. Ces métriques appartiennent à A/B.

## 7. V1 ultra-minimal (anti-monstre)

> Le V1 de C ne fait QUE : **symptôme → vérifications recommandées → CTA**.

Sont **HORS V1** :
- probabilities numériques
- calibration numérique
- urgency engine dédié
- repairability matrix complète
- supplier orchestration avancée
- OBD2 lookup
- maintenance intervals
- learning loop automatique
- escalation routing avancé

Chacun de ces blocs = V1.x scope-extension PR, JAMAIS bundled. ADR scope strict garde-fou.

**Périmètre V1 borné** : seulement diagnostic symptôme→pièce sur **3 familles de pannes pilotes** (freinage, démarrage, fumée diesel) × **5 modèles véhicule pilotes** (à choisir par ownership selon volume `__seo_event_log`). Tout ajout = nouvelle PR scope-extension avec preuve V1 réussie.

## 8. Complexity budget (mesurable, canon)

L'ADR Complexity budget Phase 0 fixe des plafonds qu'aucune V1.x ne peut franchir sans déclencher un ADR de revision majeur :

| Métrique | Plafond V1 | Plafond fin V1.x cumulé (12 mois) |
|---|---|---|
| Hypothèses simultanées affichées | ≤5 | ≤7 |
| Flows d'entrée | 1 (`symptôme`) | ≤3 (`symptôme`, `code OBD2`, `entretien`) |
| Règles métier hardcodées | ≤20 | ≤50 |
| Croissance ontology symptômes | 30 baseline | ≤45 (+50% max) |
| Croissance ontology causes | 80 baseline | ≤120 (+50% max) |
| Nouveaux domaines/trimestre | 0 (V1 figé) | ≤1 / trimestre |
| Nouvelles intégrations externes/trimestre | 0 | ≤1 / trimestre |
| Questions max par session | ≤5 | ≤8 |

Tout dépassement = freeze + revision ADR + décision explicite owner. Pas d'auto-extension. Cohérent avec doctrine globale du repo (ratchets CI, registry strict, branch-protection).

## 9. Ontology governance stricte

Source of Truth versionnée : `.spec/00-canon/diagnostic-ontology/` (sous réserve ADR canon-registry-extension distinct, à ouvrir avant Phase 3).

**Contenu V1 borné** :
- Symptômes ≤30
- Causes ≤80 (mappées aux familles pilotes)
- Vérifications ≤50

**Process** :
- Tout ajout/modification/rename = PR avec ratchet ontology-size
- Audit trimestriel des alias / overlaps via `scripts/audit/diagnostic-ontology-audit.ts` (à créer)
- Owner explicite (à nommer dans l'ADR Ontology governance)
- Pas de "petit ajout silencieux" dans le code ; tout passe par la SoT

## 10. Decision liability doctrine

Règles d'escalade obligatoire (à acter dans ADR Decision liability) :

- **Forcer l'escalade garage** : confidence basse + risque élevé + repairability `critical`
- **Bloquer le CTA pièce** : risque sécurité non-validable sans vérification atelier
- **Afficher un danger** : risque roulage immédiat (`risque_roulage = interdit`)

**Cadre juridique** : C n'est jamais "responsable" du diagnostic ; user reste seul décisionnaire. À ancrer dans CGU (modifier `frontend/app/routes/cgu.*` après ADR Decision liability mergée).

## 11. Non-goals explicites (canon)

```
C DOES NOT:
- guarantee repairs
- replace mechanics
- diagnose all failures
- support all vehicles
- support open-ended conversations
- provide medical-grade certainty
- replace OBD2 scanners
- claim DIY capability for any user
```

À acter dans ADR Produit C (vision + KPIs + non-goals).

## 12. Manques à combler dans les ADRs C (post-Phase-0, pré-Phase-3)

Cinq éléments structurants à ajouter aux ADRs C avant ouverture du chantier V1 :

1. **Decision liability doctrine** — règles escalade / blocage CTA / danger UI (cf. §10).
2. **Verification discriminante strategy** — algorithme bornée : quelle question, à un moment donné, réduit le plus l'incertitude ? Max 5 questions par session V1.
3. **Minimal viable ontology** — liste canon symptômes ≤30 / causes ≤80 / vérifications ≤50, anti-doublons, anti-incohérences, versionnée, owner explicite.
4. **Confidence learning loop** — mécanisme recalibration (golden set + user feedback annoté) + correction d'hypothèse fausse + dépréciation d'heuristique. Sans loop, C dérive ou stagne.
5. **Human escalation routing** — cadre prévu V1 mais pas tout implémenté V1 : garage partenaire par zone × spécialité, expert vertical, voie urgence, voie DIY impossible.

## 13. Risques structurants (12 risques, garde-fous canon)

Synthèse résumée — détails dans plan source. Chaque risque a son garde-fou dans l'ADR correspondant.

| # | Risque | Garde-fou |
|---|---|---|
| 1 | Explosion de scope | ADR scope strict : 3 familles × 5 modèles pilotes V1 |
| 2 | Reconstruire expert system géant | ≤20 règles V1, ≤50 max ; préférer freq observées |
| 3 | Dette UX multi-step | Progressive disclosure + quick exits + paths courts + confidence adaptive |
| 4 | Données faibles au démarrage | V1 heuristique, buckets qualitatifs, scores numériques cachés |
| 5 | C trop ambitieux post-V1 | V1 ultra-minimal `symptôme → vérifications → CTA`, V1.x scope-extensions séparées |
| 6 | Interprétation des scores | Buckets visibles, numériques cachés (cf. §4.5) |
| 7 | Repairability litigieux | Reformulation "complexité estimée", jamais "vous pouvez" |
| 8 | OBD2 mapping dangereux | OBD2 = signal, pas verdict (cf. §4.4) |
| 9 | A/B et C re-fusionnent | Surfaces strictes, ADR réutilisation explicite |
| 10 | Supplier Truth fragile | Mesuré <5% error sur golden set avant unlock C |
| 11 | Ontology drift | Gouvernance stricte (cf. §9) |
| 12 | Silent complexity creep | Complexity budget mesurable (cf. §8) |

## 14. Pré-requis unlock C (gates de Phase 3)

1. **Commerce-loop V1 finie** (étapes 5-7) — funnel attribution + sticky-buy + abandoned cart + merchant-XML
2. **KPI funnel remonté** : conv rate organic ≥0.5% sur 30j (3× baseline 0.17%)
3. **9 ADRs Phase 0 mergées** + hash-locked + mirrored
4. **Supplier Truth mesuré-fiable** : <5% error rate sur golden set de 200 références, mesuré sur 14j
5. **Wiki pipeline branché** (gate #12) OU décision owner explicite que C n'utilise pas le wiki en V1

Aucun de ces 5 = pas d'unlock C. La voie γ recommandée (cf. plan source) respecte cette séquence.

## 15. Verification (post-unlock, à raffiner à l'ouverture du chantier C)

À ce stade, C reste design-only. La vérification réelle vient avec l'écriture du writing-plans détaillé Phase 3 (post-unlock). Mais critères de succès V1 envisagés :

- **Périmètre V1 livré** : 3 familles × 5 modèles pilotes
- **Calibration accuracy** : bucket "haute" corrèle à ≥75% cas justes sur golden set
- **Escalation rate cohérente** : bucket "basse" + repairability `critical` → ≥80% escalade garage
- **Tests anti-régression** : aucun output certain ("votre X est HS") ; aucun affichage de score numérique ; aucun chat libre
- **Complexity budget respecté** : tous les plafonds §8 sous le seuil
- **Aucune violation invariants §4** vérifiée par tests automatisés

## 16. Anti-régressions

- C reste design-only tant que les 5 pré-requis §14 ne sont pas tous remplis.
- Conformité [[feedback_v1_first_dont_build_ultimate_engine_too_early]] : V1 ultra-minimal canon.
- Conformité [[feedback_no_rag_for_content_legacy_code_is_not_strategy]] : C utilise RAG potentiellement comme chatbot-style data layer si scopé (mais V1 ne fait pas appel à RAG).
- Conformité [[feedback_vehicle_context_option_a_locked]] : C lit `VehicleContext` mais ne le mute jamais.
- Conformité [[feedback_no_url_changes_ever]] + [[feedback_no_touch_meta_h1_if_optimized]] : C n'écrit pas dans les pages A/B SEO.
- Aucune action sur `payments/` (cf. [[feedback_no_payment_module_changes_ever]]).
