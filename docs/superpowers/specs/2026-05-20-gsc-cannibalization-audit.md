# GSC Cannibalization Audit — rapport cluster-first (run réel 2026-05-20)

**Source** : signal Google réel (`__seo_gsc_daily`, 28j) — pas de similarité de contenu, pas de crawl
**Clusters cannibalisés** : 286 · **Pages analysées** : 662
**Recommandations** : stockées dans `__seo_cannibalization_recommendations` (100% `status='proposed'`)

> Reproduction : `npx ts-node scripts/audit/render-cannibalization-report.ts`

## Pivot diagnostic (vs hypothèse initiale)

L'hypothèse de départ était un duplicate **R8↔R2**. Le signal Google réel le contredit :

| Pattern de cannibalisation | Clusters | Part |
|---|---|---|
| **intra-R2** (pages /pieces/ entre elles) | **241** | **84%** |
| intra-R8 (/constructeurs/ sœurs) | 43 | 15% |
| R8↔R2 (inter-rôles) | 2 | <1% |

➡️ **Le vrai coupable est l'auto-cannibalisation R2** (pages produit/gamme se disputant les mêmes requêtes), PAS le duplicate R8↔R2. Données pilotes confirmant le contexte : `__seo_r8_pages`=155 (154 noindex), `__seo_r2_pages`=0 — ces tables de génération v2 ne sont pas les pages live indexées.

## Distribution des actions recommandées

| Action | Nb pages | Lecture |
|---|---|---|
| keep (HIGH) | 286 | winners de cluster — page de référence |
| differentiate (MEDIUM) | 180 | page proche du winner, à différencier |
| **canonical_candidate (HIGH)** | **142** | loser profond + 0 clic → canonical vers winner |
| noindex_candidate (MEDIUM) | 31 | quasi invisible → candidate noindex (manuel) |
| keep (LOW) | 20 | signaux contradictoires → investiguer |
| differentiate (LOW) | 3 | a ses propres clics |

**Actionnable haute confiance** : 142 canonical_candidate + 31 noindex_candidate = **173 pages** clairement en cannibalisation, recommandées pour consolidation.

## Exemples de clusters réels (requêtes produit)

| Requête | Pattern | Pages | Winner pos | Reco dominante |
|---|---|---|---|---|
| support moteur 207 | intra_r2 | 5 | 15.8 | 4× canonical_candidate |
| embrayage zx | intra_r2 | 5 | 43.0 | 4× canonical_candidate |
| vanne egr 308 1.6 hdi 110 | intra_r2 | 4 | 48.3 | 3× canonical_candidate |
| embrayage saxo 1.5d | r8_vs_r2 | 4 | 29.0 | 3× canonical_candidate |
| vanne egr laguna 2 | intra_r2 | 4 | 47.0 | 2× canonical + 1 diff |
| poulie vilebrequin 1.9 dci | intra_r2 | 5 | 1.0 | 4× differentiate |

Toutes ces requêtes : **0 clic** malgré des impressions — signal clair que la dispersion entre pages dilue le ranking.

## Cause STRUCTURELLE (root-cause, pas symptôme)

Analyse des URLs en concurrence : pattern `/pieces/{gamme}/{marque}/{modèle}/{motorisation}.html`. Les pages produit existent au niveau **motorisation** (type_id), mais les utilisateurs cherchent au niveau **modèle** (« support moteur 207 », pas « support moteur 207 1.6 hdi »). Google voit donc N pages motorisation quasi-identiques matcher la requête modèle → cannibalisation.

| Forme du cluster | Clusters | Pages | Fix structurel |
|---|---|---|---|
| **same_model_diff_motor** (même gamme × même modèle, motorisations ≠) | 117 (48%) | 245 | canonical motorisation → page niveau-modèle |
| same_gamme_diff_model (même gamme, modèles/générations ≠) | 104 (43%) | 271 | examiner : générations distinctes (garder) vs doublons |
| diff_gamme (gammes ≠) | 22 (9%) | 51 | ambiguïté requête, souvent garder |

Exemple `support moteur 207` : 5 URLs `support-moteur-247/peugeot-128/207-128018/{1-4-16v, 1-6-hdi×4}` → même gamme, même modèle 207, 5 motorisations.

➡️ **Le bon fix n'est PAS 142 canonicals ad-hoc, mais UNE règle structurelle** : pour les 117 clusters `same_model_diff_motor`, les pages motorisation devraient déclarer un canonical vers la page niveau-modèle (si le contenu ne varie pas matériellement par motorisation). À valider + appliquer manuellement (règle, pas page par page).

## Validation Google + best practices (vérifié web 2026-05-20)

La solution (canonical des pages motorisation vers le niveau modèle) est **confirmée** par la doc officielle Google + best practice e-commerce variant.

**Google Search Central — Consolidate duplicate URLs :**
- `rel=canonical` recommandé pour « consolidate signals for similar or duplicate pages ».
- Ordre de force : **redirects > rel=canonical > sitemap**.
- ⚠️ `noindex` **bloque** la page de Search → préférer canonical pour consolider (ne PAS combiner noindex + canonical sur la même page).
- Ne pas mixer méthodes de canonical contradictoires.

**Best practice variant cannibalization (onwardSEO 7 rules) :**
- Cible canonical = page parent « base product » OU variante dominante (selon distribution de la demande). → pour nous : **page niveau-modèle** (demande répartie sur motorisations) OU motorisation dominante si une rank nettement mieux.
- **Tous les liens internes** (PLP, fil d'ariane, recommandations) doivent pointer la cible canonical, **pas seulement la balise** `rel=canonical`. ← raffinement clé.
- Demande répartie → canonical vers parent ; une variante domine → canonical vers elle ; stock fluctuant → canonical parent, noindex seulement si discontinué définitivement.
- Renfort requis : schema `url`, sitemap exclusif, ancres internes cohérentes — pas la balise canonical seule.

### 2 raffinements intégrés au plan d'action

1. **Cible canonical — fait structurel décisif** : vérification GSC = **1489 pages niveau-motorisation indexées, MAIS 0 page niveau-modèle** (ni niveau-marque). La cible canonical « parent base product » idéale **n'existe pas**. Deux chemins :
   - **(A) Court terme, réversible, aucun changement d'URL** : canonical des motorisations → la motorisation **dominante** (mieux classée) du cluster, conforme onwardSEO « one variant dominates → canonical to that variant ». C'est le `winner` déjà identifié par l'audit. Applicable immédiatement après revue.
   - **(B) Stratégique, structurel** : **créer des pages niveau-modèle** (`/pieces/{gamme}/{marque}/{modele}.html`) comme hub canonical — meilleure cible long terme (capte la requête modèle « support moteur 207 »), mais = nouveau pattern d'URL/route → décision utilisateur (garde `feedback_no_url_changes_ever`) + chantier dédié. **C'est probablement le vrai fix de fond** : la requête est au niveau modèle, il manque la page de ce niveau.
2. **Congruence des liens internes** : appliquer le canonical ne suffit pas — fil d'ariane + PLP + recos doivent aussi pointer la cible. Sinon Google reçoit des signaux contradictoires (cf onwardSEO : canonical resout seul 55-70% du clustering).
3. **noindex vs canonical** : les 31 `noindex_candidate` ne doivent PAS recevoir aussi un canonical (mutuellement exclusifs). Réservés aux pages sans valeur SEO, pas aux variants à consolider.

## ⚠️ Safety check du change-set — 30/142 seulement applicables

En préparant le change-set, vérification critique : le « winner » (meilleure position GSC) est parfois un **produit différent** (gamme/modèle/moteur ≠). Canonicaliser vers lui = dire à Google « pages identiques » → mauvaise pièce servie → retour SAV. Classement par sécurité (`safety_flag`) :

| safety_flag | Pages | Sens |
|---|---|---|
| `strict_safe_true_dup` | **30** | vrai doublon (même gamme+modèle+motorisation, type_id ≠) → SÛR à canonicaliser |
| `needs_human_review_diff_product` | 112 | gamme/modèle/moteur ≠ → NE PAS auto-canonicaliser |

Exemples de pièges écartés : `kit-d-embrayage`→`butée-d-embrayage` (gammes ≠), `207`→`208` (modèles ≠), `1-6-16v` essence→`1-6-hdi` diesel (moteurs ≠), `alternateur`→`maître-cylindre` (requête junk « gjk f »).

➡️ Change-set sûr (30 paires) : voir `docs/superpowers/specs/2026-05-20-canonical-changeset-strict-safe.md`. Les 112 autres relèvent du fix structurel niveau-modèle (chemin B), pas du canonical page-à-page.

## ⚠️ Aucune action appliquée

Toutes les recommandations sont `status='proposed'`. **Révision humaine obligatoire** avant tout changement canonical/noindex (gardes `feedback_no_url_changes_ever`, `feedback_no_auto_page_suppression_ever`). L'application des canonical/noindex est une étape SÉPARÉE, approuvée page par page (ou batch validé).

## Recommandation orientation

1. **Prioriser les 142 canonical_candidate HIGH** : consolider les losers vers leur winner sur les requêtes produit cannibalisées. Réversible, faible risque.
2. **Cibler le pattern intra-R2** (84% du problème) : comprendre POURQUOI plusieurs pages /pieces/ rankent sur la même requête produit (variantes véhicule ? pages quasi-doublons ?).
3. Le duplicate R8↔R2 et intra-R8 sont secondaires (16% combiné) — traiter après l'intra-R2.
4. Lien avec verdict `conversion_funnel` (0.17%) : la cannibalisation dilue le peu de trafic restant ; consolider peut améliorer position ET conversion.

---
_Étape suivante = révision humaine des recommandations dans `__seo_cannibalization_recommendations`, puis application manuelle approuvée._
