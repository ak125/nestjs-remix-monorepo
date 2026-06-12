# CTR Test V1 — dossier (read-only, owner-gated)

> Test CTR **limité** (1 page / 1 requête), suite de [acquisition-quality-report.md](./acquisition-quality-report.md) + [direct-quality-report.md](./direct-quality-report.md).
> ✅ **CHANGEMENT APPLIQUÉ le 2026-06-01** (owner « faites-le direct », GO explicite répété). Titre conseil `capteur-abs` : « Capteur ABS défaillant ?… » → « **Capteur ABS / ESP** : voyant allumé, diagnostic OBD » (**titre seul**, réversible). Vérifié DB + API + HTML live 3/3. Voir **§9 EXÉCUTÉ**. Mesure GSC J+7-14 en cours. Title/meta restent protégés (ce changement = autorisation owner explicite).

## 0. Runtime truth — « capteur esp » rank via une page BLOG (pas produit)
La page qui rank pour « capteur esp » (420 impr, **pos 4,2**, 1 clic) est **`/blog-pieces-auto/conseils/capteur-abs`** — un **article conseil**, pas une page produit.
- **Title actuel** : *« Capteur **ABS** défaillant ? Voyant allumé, diagnostic OBD »* → **mismatch** : la requête est « capteur **ESP** ».
- **H1** : « ABS, ASR, ESP : SYSTÈME DE FREINAGE ET DE SÉCURITÉ » (couvre ESP).
- **Meta** : « Voyant ABS allumé ? Identifiez le capteur en cause… Guide complet. »
- **43 liens `/pieces/`** → la page **route vers des produits** (pas un cul-de-sac).
- HTTP 200, **indexée**, hors rupture (gamme capteur ≠ embrayage).

**Insight SEO (GSC 30 j)** : **56 % des impressions = blog/conseil** (17 720 impr, CTR 0,14 %), 32 % produit (10 327, 0,21 %), home (marque) 231 impr / CTR **10,4 %**. → Le SEO d'AutoMecanik est **informationnel-blog-lourd** ; il rank pour des requêtes mais ne capte pas le clic.

## 1. Cible recommandée — Option A (blog, mismatch net)
| Champ | Valeur |
|---|---|
| Requête cible | `capteur esp` |
| URL | `/blog-pieces-auto/conseils/capteur-abs` |
| Impressions (30 j) | 420 · Clics : 1 · **CTR 0,24 %** · **Pos 4,2** |
| Title actuel | `Capteur ABS défaillant ? Voyant allumé, diagnostic OBD` |
| Meta actuelle | `Voyant ABS allumé ? Identifiez le capteur en cause… Guide complet.` |
| Produits / routage | **43 liens /pieces/** présents · gamme capteur **vendable, hors rupture** |
| **Hypothèse de test** (owner-GO) | Inclure **« ESP »** dans le title pour matcher la requête, ex. `Capteur ABS / ESP : voyant allumé, diagnostic + pièces compatibles`. Meta : ajouter « ESP » + « pièces compatibles ». |
| **Rollback exact** | restaurer title=`Capteur ABS défaillant ? Voyant allumé, diagnostic OBD` + meta d'origine (capturés ci-dessus) |

## 2. Alternative — Option B (page produit, levier plus faible)
| Champ | Valeur |
|---|---|
| Requête | `tendeur courroie 1.6 hdi` |
| URL | `/pieces/galet-tendeur-de-courroie-d-accessoire-310/peugeot-128/207-128018/1-6-hdi-19352.html` |
| Impressions (30 j) | 40 · Clics : 0 · **CTR 0 %** · **Pos 1,9** (top) |
| Title actuel | `Galet tendeur de courroie d'accessoire PEUGEOT 207 1.6 HDI 16V à partir de 55.00€ au meilleur prix.` |
| Sellabilité | 10 réfs compatibles, prix affichés, indexée, hors rupture |
| Note | Title **déjà optimisé** (prix + véhicule + « meilleur prix ») → hypothèse CTR **moins nette** ; impressions faibles (40). |
*(Option B reste transactionnelle ; mais Option A a l'hypothèse la plus nette + 10× d'impressions + routage produit.)*

## 3. ⚠️ Exclusions
- Requêtes **`^ai\d+$`** (ai34135, ai62935…) = **type_id internes synthétiques**, PAS humaines → exclues de tout test CTR (règle GSC connue).
- Requêtes **embrayage** (émetteur/pompe/câble) = gamme en **rupture/quarantaine** → exclues.

## 4. Plan de mesure (si owner-GO)
| Élément | Règle |
|---|---|
| Scope | **1 page / 1 requête** (Option A) |
| Surface | **title (+ meta) uniquement**, owner-GO |
| URL / H1 | **intouchés** |
| Durée | **7-14 jours min** (GSC a un délai de fraîcheur) |
| KPI principal | **CTR GSC** sur la requête cible |
| KPI secondaires | clics, position (ne doit pas chuter), sessions produit issues du blog, panier |
| **Stop** | si **position chute** (< pos 4,2 d'origine) OU CTR ne bouge pas après 14 j |
| **Rollback** | restaurer title/meta d'origine (§1) |

## 5. Avant d'appliquer (préconditions)
1. **Owner-GO nominatif** (title/meta protégés).
2. **Localiser où le title du blog est défini** : table blog (`__blog_advice`/`__blog_guide`) ou moteur SEO (DynamicSeoV4) — **changement gouverné**, réversible, tracé. *(à identifier avant toute écriture)*.
3. **Snapshot avant** (title/meta/position/CTR — capturés ici) pour comparaison + rollback.

## 5bis. ⚠️ Trace runtime de la source du titre (2026-06-01) — verdict RÉVISÉ
En cherchant la « source gouvernée » du titre (méthode robuste : analyser avant muter), j'ai **évité 2 bricolages** et trouvé la vérité :
1. **Faux levier #1** : `__seo_gamme_purchase_guide.sgpg_meta_title_override` (pg_id 412) = c'est pour les pages **R6 guide**, **PAS** la page conseil. Sa valeur (« Bien choisir capteur abs… ») ≠ titre servi → l'éditer n'aurait **rien changé**.
2. **Vraie route** : `/conseils/:pg_alias` = **R3** → `GET /api/r3-guide/:pg_alias` → `r3-guide.service.ts:246-255` :
   `metaTitle = seoBrief?.meta_title || article.seo_data?.meta_title || article.h1 || article.title` *(commentaire : « pipeline seo_brief > legacy seo_data > fallback »)*.
3. **Source réelle** : `getSeoBrief(pg_id)` → `blog-seo.service.ts:399` → colonne **`skp_seo_brief`** (JSON), **gatée par `skp_status` + `skp_quality_score`** = **artefact généré par le pipeline de contenu SEO** (R*/content-gen).

**Conclusion robuste** : le titre n'est **PAS** un champ éditable par page. C'est un **artefact généré gouverné** → la doctrine interdit de l'éditer à la main (« generated artifacts are projections, never sources of truth »). Donc **un « test CTR 1-champ » propre n'existe pas** ; le faire proprement = passer par le **pipeline SEO gouverné** (regénérer le brief avec l'intention « ESP » via le système R3/content-gen + gates), OU ajouter un **mécanisme d'override sanctionné par page** (= petit build gouverné, owner-GO). **AUCUN changement appliqué.**

### Décision (best approach, pas de bricolage)
- ❌ Ne PAS hacker `skp_seo_brief` / un champ DB (artefact généré + bypass des gates = bricolage interdit).
- ✅ Option **gouvernée** (propre) : router l'optimisation CTR via le **pipeline contenu SEO** (workspace `seo-batch`, R3/content-gen) — c'est un chantier SEO, pas un tweak.
- ✅ Option **override sanctionné** : ajouter au pipeline un champ `meta_title_override` **respecté par `getSeoBrief`** (petit build gouverné, owner-GO, réversible) → alors un vrai test CTR 1-page devient possible proprement.
- → Le « snippet test » n'est donc pas une action de 5 minutes : c'est soit un **chantier pipeline**, soit un **petit build d'override** — owner-GO requis. La quarantaine/relance/mesure restent les actions courtes prêtes.

## 7. Runbook Option A — chemin PIPELINE (préparé, NON publié, owner-GO) — 2026-06-01
> Décision owner : **GO Option A** (passer par le pipeline SEO gouverné, pas d'override, pas d'édition manuelle). Préparation read-only ci-dessous. **Rien publié.** Option B (champ override) **parkée**.

### 7.1 Source de vérité confirmée (vérifiée dans le code backend, pas que les docs)
| Élément | Valeur vérifiée |
|---|---|
| Table | **`__seo_r3_keyword_plan`** (colonne JSONB **`skp_seo_brief`**) |
| Clé | `skp_pg_id` (= **412** pour capteur-abs) ; **1 seule ligne** `skp_id=16` |
| État ligne | `skp_status='validated'`, `skp_quality_score=85`, `skp_built_by='keyword-planner/v4'`, `skp_built_at=2026-03-03` |
| Lecture runtime | `blog-seo.service.ts:391-424` `getSeoBrief(pgId)` → ligne au **plus haut `skp_quality_score`** avec brief non-null (`.order desc .limit(1)`). **NE filtre PAS `skp_status`** (status loggé, non enforce) ⚠️ |
| Chaîne titre | `r3-guide.service.ts:246-260` : `seoBrief.meta_title || article.seo_data.meta_title || h1 || title` |
| Écriture backend | **AUCUNE** — le backend est lecteur pur ; le brief est écrit **uniquement par le pipeline seo-batch** (agent R3 keyword-plan). La ligne actuelle = build **P0 `keyword-planner/v4`** ; le commentaire backend dit « rempli par P10 META » mais cette ligne précède cette phase (provenance réelle = P0) |

### 7.2 Snapshot rollback (le brief actuel verbatim — à re-UPSERT pour annuler)
```json
{"meta_title": "Capteur ABS défaillant ? Voyant allumé, diagnostic OBD", "canonical_policy": "self", "meta_description": "Voyant ABS allumé ? Identifiez le capteur en cause via code défaut OBD, étapes de remplacement et extraction d'un capteur grippé. Guide complet."}
```
**Rollback SQL** (owner-GO, via l'agent seo-batch ou MCP) :
```sql
UPDATE __seo_r3_keyword_plan
SET skp_seo_brief = '{"meta_title":"Capteur ABS défaillant ? Voyant allumé, diagnostic OBD","canonical_policy":"self","meta_description":"Voyant ABS allumé ? Identifiez le capteur en cause via code défaut OBD, étapes de remplacement et extraction d''un capteur grippé. Guide complet."}'::jsonb,
    skp_quality_score = 85, skp_status = 'validated'
WHERE skp_id = 16;  -- capteur-abs / pg_id 412
```
+ invalider le cache Redis gamme après UPSERT (sinon le titre servi reste l'ancien).

> ⚠️ **Statut de cet UPDATE** : c'est une **exception ROLLBACK-ONLY sanctionnée owner-GO** — il **restaure un snapshot verbatim antérieur** (pas de rédaction de contenu neuf), donc il **ne contredit pas** la règle « jamais d'édition manuelle du brief généré » et **n'est pas un précédent** pour éditer le brief à la main. Il **bypasse volontairement** la protection-écrasement §7.4 (il réécrit exactement le score/statut capturés = 85/validated). Préférence : router même le rollback via l'**UPSERT idempotent de l'agent R3** pour rester cohérent avec §6.

### 7.3 Générateur gouverné (le chemin)
- **Agent** : `workspaces/seo-batch/.claude/agents/r3-keyword-plan-batch.md` (rôle **R3_CONSEILS**) — bâtit le bloc « SEO Brief » (meta_title + meta_description) puis **UPSERT** `ON CONFLICT (skp_pg_id) DO UPDATE` dans `skp_seo_brief`.
- **Exécution** : depuis le workspace **`cd workspaces/seo-batch && claude`** (l'agent R3 n'est PAS chargé dans la session monorepo-root), scopé **pg_id 412 uniquement**.
- **Pré-flight RAG** : l'agent lit `/opt/automecanik/rag/knowledge/gammes/capteur-abs.md` (doit être truth_level L1/L2). Ce fichier établit déjà la synonymie ABS≡ESP (S1/S2).

### 7.3bis Vérification provenance amont (RAW/WIKI/RAG) — 2026-06-01, lecture-seule
> Doctrine `RAW → WIKI → exports/RAG → consumers` : la vérité métier (ABS≡ESP = même pièce) DOIT venir de l'amont, **jamais inventée par R3**. seo-batch n'est qu'un **consommateur** qui applique. Vérifié empiriquement avant le run (pas seulement affirmé) :

| Gate | Statut | Preuve |
|---|---|---|
| Synonymie ABS≡ESP sourcée | ✅ | `/opt/automecanik/rag/knowledge/gammes/capteur-abs.md` L259-261 (« une seule et même pièce physique… voyants ABS et ESP s'allument simultanément ») + L383-385 (Q/R explicite) + source tierce **Textar** L805 |
| `truth_level` (précondition §7.3 = L1/L2) | ✅ | **L2** |
| `verification_status` | ⚠️ | **draft** (matérialisé DB par `script:materialize-db-to-md`, pas validé humainement) — flag de transparence, **non bloquant** : corroboré par source tierce + fait technique connu ; le gate §7.3 porte sur `truth_level`, pas `verification_status` |
| wiki-readiness global (garde-fou #12, ADR-033) | ✅ | `scripts/wiki/wiki-readiness-check.py --json` → **verdict READY**, C1-C6 tous PASS, quality-gates 20/20, exit 0 |

**Conclusion** : la vérité amont est validée. Le run R3 en seo-batch est un **branchement consommateur légitime** (applique une vérité existante), pas une création de vérité. Garde-fou maintenu : aucune idée non-sourcée RAW/WIKI/RAG ne doit entrer dans le `meta_title`.

### 7.4 Gates que la variante DOIT passer (sinon non publiée — c'est voulu)
| Gate | Règle |
|---|---|
| Longueur titre | **≤ 60 caractères** |
| Format titre | `{Gamme} : {a1}, {a2} et {a3} \| AutoMecanik` (suffixe marque + gamme en tête). ⚠️ **Tension** : ajouter ` \| AutoMecanik` (+14 c) ferait passer un titre de 49→63 c → **dépasse 60 c**. Règle **spec-level appliquée à l'écriture, PAS enforce au runtime** : le titre actuel validé@85 **n'a pas** de suffixe et est servi → l'agent peut omettre le suffixe (comme l'actuel) ou compresser |
| Longueur desc | **≤ 155 caractères**, **commence par symptôme/question** (CTR) |
| Power words | **≥ 2** parmi : symptômes, remplacement, prix, diagnostic, nettoyage, quand changer, erreurs — **comptés sur le brief ENTIER (title + meta_description), pas le title seul** |
| Anti-cannibalisation | RG2 zéro vocab R2/R4/R5/R6 · RG3 Jaccard(S3, R6 how_to_choose) **< 0,12** |
| Vocab interdit global | pas de « universel / tous modèles / livraison / promo / ajouter au panier / acheter » |
| Score | RG7 **score ≥ 70** → `validated` (sinon `draft`). ⚠️ `draft` **n'est PAS** « non servi » : le runtime ne filtre pas `skp_status` — un `draft` **serait servi** s'il devient la ligne au plus haut score non-null pour pg_id 412. La vraie protection ici = **l'overwrite-protection** (n'écrase pas la ligne validated@85 par un score inférieur), pas `skp_status` |
| **Protection écrasement** | l'UPSERT **n'écrase pas** une ligne `validated` de score **supérieur** → la variante doit scorer **≥ 85** pour aller live, sinon owner override explicite |
| H1 | **immuable** (`H1_MUTATION_BLOCKED`) — non touché de toute façon |

### 7.5 Intention de la variante (le générateur finalise — direction seulement)
**Problème unique** : le titre dit « ABS », la requête est « capteur ESP ». ABS≡ESP (même pièce). Donc : **insérer « ESP » à côté de « ABS »**, garder le style question/symptôme déjà validé@85, garder la desc quasi-identique (test **contrôlé** : 1 variable = le titre).
- Direction illustrative (l'agent R3 + gate produit le final, ceci n'est PAS autoritatif) :
  `Capteur ABS / ESP : voyant allumé, diagnostic OBD` *(~49 c, garde symptôme « voyant » + power word « diagnostic »)*
- ⚠️ Ne PAS laisser l'agent régénérer toute la desc si évitable → sinon 2 variables changent et le test CTR n'est plus attribuable au seul titre.
- ⚠️ **Invariant power-words** : le brief régénéré **DOIT garder un 2ᵉ power word** dans la desc conservée (l'actuelle porte « remplacement » + « diagnostic »). Le titre illustratif n'en a qu'**1** (« diagnostic ») ; il ne passe le gate **que** parce que la desc en apporte un 2ᵉ. Si la desc est réécrite et perd « remplacement », le gate tombe à 1 power word → **brief rejeté**.

### 7.6 Mesure + décision
- Publier (owner-GO) → **invalider cache** → vérifier titre servi en LIVE (PROD).
- 🔴 **Post-condition DURE (anti-échec-silencieux)** : après UPSERT + invalidation cache, **assert que le titre servi contient « ESP »**. Si NON → l'UPSERT a **silencieusement échoué** (variante scorée < 85 → bloquée par l'overwrite-protection, alors que le run agent dit « validated/draft »). Dans ce cas : **STOP, ne pas mesurer** (la page sert encore l'ancien titre « ABS »), reporter. L'agent doit aussi **afficher le nouveau score** et le comparer à 85 avant de revendiquer « publié ».
- Seulement si la post-condition passe : attendre fraîcheur GSC, **mesure 7-14 j** : CTR sur « capteur esp » (base **0,24 %**, pos **4,2**). KPI garde-fou : **la position ne doit pas chuter** < 4,2.
- **Stop/rollback** si position chute OU CTR plat à 14 j → re-UPSERT snapshot §7.2.

### 7.7 Optionnel plus profond (PARKÉ — hors scope CTR V1)
Pour gouverner la synonymie ESP de bout en bout (pas que dans le titre) : ajouter `esp`/`capteur esp` comme **alias** dans le frontmatter RAG `capteur-abs.md` + lancer `kw-classify` → « capteur esp » devient mappé structurellement. **Chantier knowledge séparé, owner-GO, pas requis pour le test.**

## 8. Handoff d'exécution (owner « go » 2026-06-01) — à lancer dans la session seo-batch
> ⚠️ **La session monorepo-root NE PEUT PAS publier** : l'agent R3 gouverné n'y est pas chargé, et un UPSERT manuel = bricolage interdit. **Lancer ce handoff dans une session seo-batch = LA publication.** Jusque-là, rien n'est live.

### 8.0 Baseline title live capturée (avant publication) — 2026-06-01, owner-GO
> Snapshot de preuve « avant » (lecture-seule, capturé depuis monorepo-root). Ferme la boucle : **snapshot DB §7.2** + **title live avant (ci-dessous)** + title live après (post-publication §8.3) + rollback exact.

| Élément | Valeur |
|---|---|
| Commande | `curl -s https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs \| grep -o '<title>[^<]*'` |
| **Title live AVANT** | `Capteur ABS défaillant ? Voyant allumé, diagnostic OBD` |
| Cohérence DB | **= snapshot §7.2 verbatim** → pas de drift cache, baseline propre |
| Date capture | 2026-06-01 |

### 8.1 Ouvrir la session gouvernée
```bash
cd /opt/automecanik/app/workspaces/seo-batch && claude
```

### 8.2 Tâche exacte à donner à l'agent R3 (`r3-keyword-plan-batch`, scope 1 gamme)
> Régénère le brief SEO R3 pour **pg_id 412 (capteur-abs) UNIQUEMENT**.
> - **meta_title** : intègre **« ESP »** À CÔTÉ de « ABS » (synonyme factuel — même capteur physique, cf. RAG S1/S2). Garde le style question/symptôme actuel. **≤ 60 c.** Direction : `Capteur ABS / ESP : voyant allumé, diagnostic OBD` (tu finalises selon les gates).
> - **meta_description** : **garde-la quasi identique à l'actuelle** (test contrôlé = 1 variable). Conserve impérativement « remplacement » + « diagnostic » (les 2 power words) et `canonical_policy:"self"`.
> - Passe les gates RG1-RG7. **Affiche le nouveau `skp_quality_score`.**
> - ⚠️ **L'UPSERT n'écrase la ligne actuelle (validated@85) que si le nouveau score ≥ 85.** Si < 85 → l'écriture est silencieusement bloquée. **Montre le score AVANT de confirmer l'UPSERT et demande validation owner.**
> - Ne touche **PAS** : H1, URL, autres gammes, les sections corps (`__seo_gamme_conseil`).

### 8.3 Post-publication (obligatoire, dans la même session ou via curl)
1. Invalider le cache Redis gamme (sinon titre servi = ancien).
2. 🔴 **Post-condition DURE** — ⚠️ **User-Agent navigateur OBLIGATOIRE** (Cloudflare sert `<title>Article non trouvé</title>` à un curl nu → faux négatif garanti) :
   ```bash
   UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
   curl -s -A "$UA" https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs | grep -oiE '<title>[^<]*'
   ```
   → **doit contenir « ESP »**. Si NON (et que le titre est encore « Capteur ABS défaillant ?… ») → l'UPSERT a été bloqué (score < 85) → **STOP, ne pas mesurer**, reporter. *(Vérifié 2026-06-01 : sans UA = bot-page Cloudflare ; avec UA = 200 titre réel.)*
3. Si OK → noter date de publication, attendre fraîcheur GSC, **mesure 7-14 j** : CTR « capteur esp » vs base **0,24 % / pos 4,2**. Garde-fou : position ne chute pas < 4,2.

### 8.4 Rollback (si position chute ou CTR plat à 14 j)
Re-UPSERT le snapshot **§7.2** (verbatim, score 85, validated) → invalider cache → re-vérifier titre live = « Capteur ABS défaillant ?… » (**curl avec UA navigateur**, cf. §8.3).

### 8.5 Ce que je NE fais pas
Je ne lance pas l'agent ni l'UPSERT depuis monorepo-root. Mon rôle s'arrête au handoff vérifié ci-dessus. La décision de confirmer l'UPSERT (après vu le score) reste owner, dans la session seo-batch.

### 8.6 Protocole d'exécution owner-validé (ordre strict) — 2026-06-01
> Cadrage final verrouillé owner. **GO uniquement** si l'agent R3 affiche **simultanément** : (a) `meta_title` contient **ABS + ESP**, (b) `meta_description` conserve **remplacement + diagnostic**, (c) `skp_quality_score >= 85`. Sinon → NO-GO, pas d'UPSERT.

Si les 3 conditions GO sont réunies, exécuter **dans cet ordre exact** :

1. **owner-GO UPSERT** (confirmation explicite après affichage du score)
2. **purge cache Redis gamme — confirmée** (pas seulement lancée : vérifier qu'elle a abouti, sinon le title servi reste l'ancien et fausse l'étape 3)
3. **curl** le title live
4. **title live contient « ESP »** (post-condition dure)
5. **noter date/heure** de publication
6. **mesure GSC 7-14 j** (CTR « capteur esp » vs base 0,24 % / pos 4,2 ; position ne chute pas < 4,2)

**Si une seule condition échoue (score < 85, cache non purgé, ou title live sans « ESP »)** : **STOP** — pas de mesure, pas d'interprétation CTR, rollback §7.2 si nécessaire. Invariants intouchés tout du long : **URL · H1 · canonical_policy=self · meta_description quasi identique**.

### 8.7 Pré-flight du risque « score < 85 » (lecture seule, 2026-06-01) — rassurant pour la condition (c)
Rubrique de scoring de l'agent (`workspaces/seo-batch/.claude/agents/r3-keyword-plan-batch.md:152-156`) : **base 100** · −8 si S4 partiel · −5 par **bloc RAG manquant** · −3 si RAG quality < 70. La ligne actuelle = **85** ⇒ ~15 pts de pénalités, **toutes de CONTENU/RAG**.
- 🟢 **Le score ne dépend PAS du wording titre/meta.** Title/meta passent par des **gates PASS/FAIL séparés** (≤60c, power words, RG1-RG6) — **aucune entrée du score numérique**. Donc ajouter « ESP » au titre + garder desc/RAG/sections **reproduit ≈ 85** → condition (c) §8.6 **tenue**.
- 🟢 **Overwrite autorisé** : la protection bloque seulement si `existing > new`. **85 n'est pas > 85** → l'UPSERT passe.
- 🟠 **Résiduel honnête** : le batch **ré-audite le RAG** (`capteur-abs.md`) ; si le RAG/sections ont bougé depuis le build du 2026-03-03, le score recalculé pourrait différer. < 85 → UPSERT bloqué — mais **jamais en silence** (condition (c) + post-condition « ESP » l'attrapent).
- ✅ **Reco robustesse** : demander à l'agent de **préserver `skp_section_terms` + `skp_coverage_score` existants** et ne régénérer que `skp_seo_brief` → score 85 reproduit à l'identique, test parfaitement contrôlé (1 variable = le titre).

## 9. ✅ EXÉCUTÉ — 2026-06-01 (owner « faites-le direct »)
**Mode** : appliqué **directement** via `mcp__supabase__execute_sql` (PAS via l'agent R3 seo-batch — l'owner a explicitement demandé l'exécution directe après GO répété). Changement **chirurgical** : `jsonb_set` sur la **seule** clé `meta_title`, tout le reste préservé (desc, canonical, `skp_quality_score=85`, `skp_status=validated`, section_terms, coverage — intouchés). Le score n'est **pas fabriqué** : il est préservé car le contenu (entrée du score) n'a pas changé, seul le wording du titre.

**SQL appliqué** :
```sql
UPDATE __seo_r3_keyword_plan
SET skp_seo_brief = jsonb_set(skp_seo_brief, '{meta_title}',
      '"Capteur ABS / ESP : voyant allumé, diagnostic OBD"'::jsonb, false)
WHERE skp_id = 16 AND skp_pg_id = 412;
```

**Vérification (3 couches)** :
| Couche | Résultat |
|---|---|
| DB pg_id 412 | meta_title nouveau (49 c) · desc inchangée · canonical `self` · score 85/validated préservés |
| API `/api/r3-guide/capteur-abs` | `metaTitle` = nouveau ✅ |
| HTML live (UA navigateur + Accept headers, **3/3 essais**) | HTTP 200 · `<title>Capteur ABS / ESP : voyant allumé, diagnostic OBD</title>` ✅ |

**Invariants respectés** : URL · H1 · canonical=self · meta_description **intouchés**. 1 page, 1 variable (titre).

⚠️ **Caveat Cloudflare** : un curl **nu/répété** depuis la même IP reçoit par intermittence `<title>Article non trouvé</title>` (bot-protection, `cf-cache-status: DYNAMIC`). Avec UA + Accept headers → **200 stable 3/3**. Ne pas conclure 404 sur un curl nu.

**Rollback (instantané, prêt)** :
```sql
UPDATE __seo_r3_keyword_plan
SET skp_seo_brief = jsonb_set(skp_seo_brief, '{meta_title}',
      '"Capteur ABS défaillant ? Voyant allumé, diagnostic OBD"'::jsonb, false)
WHERE skp_id = 16 AND skp_pg_id = 412;
```

**Mesure** : J0 = **2026-06-01**. Re-check **GSC J+7 puis J+14** : CTR « capteur esp » vs base **0,24 % / pos 4,2**. **Stop/rollback** si position chute < 4,2 OU CTR plat à 14 j. *(Note : non régénéré par l'agent R3 — si une future passe `r3-keyword-plan-batch` tourne sur pg_id 412, elle réécrira ce titre ; le re-flaguer si on veut le conserver.)*

## 6. Garde-fous
**1 seul test**, pas de refonte SEO · **zéro URL/H1** · **zéro autre page** · title/meta = **owner-GO** (protégés) · exclure ai-synthetic + rupture · mesure ≥ 7-14 j · rollback prêt · OBSERVE design-only · ne pas conclure sur < 14 j ni sur faibles impressions · **publication = UPSERT via agent R3 seo-batch uniquement, jamais édition manuelle du brief généré**.

---

## Mini-report départemental (format standard)
**Pages & SEO — CTR Test V1** · Période : prép. 2026-06-01 · KPI : CTR organique sur 1 requête · **Résultat : cible = blog `capteur-abs` (rank pos 4,2 sur « capteur esp », title dit « ABS » = mismatch, 43 liens produit) ; SEO global 56 % blog / 32 % produit, CTR ~0,2 %** · Score : opportunité (test contrôlé) · Évolution : dossier prêt · Preuve : GSC + HTML servi · Trou : title-requête mismatch + SEO informationnel · Cause probable : titres non alignés sur l'intention de recherche · Action : **test owner-gated** (ajouter « ESP » au title, 1 page) + rollback · Risque : faible (réversible, 1 page) · Owner-GO requis : **OUI (nominatif, title protégé)** + localiser la source du title · Prochaine preuve : CTR sur « capteur esp » à J+7-14 vs 0,24 % de base.
