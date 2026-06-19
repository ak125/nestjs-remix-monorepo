---
name: seo-content-loop
description: "Méthode opératoire canonique du contenu SEO AutoMecanik : la BOUCLE scraping LARGE → RAW → WIKI → CONSUMER → mesure SCORE → itérer jusqu'au score. NO-RAG (RAG = chatbot only). Pointe vers le canon vault (ADR-031/046/059/083/086), ne le duplique pas. Use when: planifier/exécuter du contenu R1-R8, enrichir une gamme/motorisation, débloquer le pipeline, ou décider 'comment produire du contenu qui ranke'."
license: Internal - Automecanik
version: "1.0"
argument-hint: "[gamme-name | vehicle-slug | status]"
disable-model-invocation: false
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Glob, Grep, Bash
---

# SEO Content Loop — la boucle canonique du contenu (NO-RAG)

> **Skill = méthode opératoire, PAS canon.** La gouvernance vit au **vault** :
> ADR-031 (raw/wiki/rag/seo separation) · ADR-046 (RAG = retrieval chatbot only) ·
> ADR-059 (SEO Runtime Projection) · ADR-083 (tiered WIKI promotion) · ADR-086 (Content Excellence Contract).
> Ce skill **pointe** vers eux, ne les réécrit jamais.

## Axiome n°0 (non-négociable)
> **Le contenu ne crée jamais l'information.** Il structure, clarifie, expose ce qui est **sourcé et vérifié**.
> En cas de doute : s'abstenir. Jamais d'invention LLM, jamais de number-swapping, jamais de filler générique.

## La BOUCLE (ordre non négociable)

```
SCRAPING LARGE (RUN_TARGETED_RAW_TO_WIKI) → RAW → WIKI → CONSUMER (R1/R2/R8 → page R) → mesure SCORE → (si < seuil) itérer
```

1. **SCRAPING LARGE** (web → `automecanik-raw/sources/web-research/<gamme>/`) — la 1ʳᵉ étape, pas RAW directement.
   - **Méthode de scraping = run web-research `RUN_TARGETED_RAW_TO_WIKI <gamme>`** (label du run, pas un CLI) :
     **N agents web-research read-only parallèles**, sources FR auto, **anti-pollution** (faits **reformulés**,
     non verbatim), **chaque fait cité + confidence-rated**. **Sortie structurée mappée aux champs WIKI**
     (`target_wiki_field`) : `selection-criteria.md` · `common-mistakes.md` · `compatibility-technical.md` ·
     `price-quality-brands.md` · `faq-symptoms.md` + `source-index.json` (provenance) + `extraction-report.json`
     (run, contradictions **à valider humainement**, governance). `verification_status: draft` → **validation
     humaine REQUISE** avant promotion WIKI ; **0 publication**, **0 invention**. **Template livré (preuve)** :
     `automecanik-raw/sources/web-research/colonne-de-direction/` (pg 1211, 31 sources).
   - Le handoff `raw-to-wiki` (état **PARTIAL**, gate **`human_review_required`**) est tracé dans la projection
     **de référence** (non-canon) `.spec/00-canon/ai-registry/agent-operating-map.yaml` ; le **canon** est au
     vault (**ADR-031** raw→wiki, **ADR-059** projection, **ADR-083** promotion tiered).
   - **PROFONDEUR > LARGEUR (gravé 2026-06-15, [[feedback_rank_1_objective_and_content_excellence_bar]])** :
     re-synthétiser les **mêmes blogs distributeurs/médias qui rankent déjà** (Oscaro/Vroomly/Mister-Auto…) = contenu
     **dérivé** → **ne dépasse jamais ce qu'il recopie** → ne rank JAMAIS #1. Viser à **BATTRE** le SERP : **sources
     primaires/autoritaires** (OE technique/datasheets, **texte réglementaire brut** UNECE/ISO/SAE, registres
     FMSI/WVA), **data réelle**, angles/comparatifs uniques, et la **data catalogue AutoMecanik par véhicule**
     (réf/fitment/specs — l'edge que les concurrents n'ont pas). **Motorisation-aware** = condition des variants R2.
   - **LARGE et comprehensif** : multi-source, **par gamme ET par motorisation**, **saturer tout l'espace du
     sujet**. **OBJECTIF = RANKER #1**. JAMAIS de gap-filling myope (ne pas s'isoler sur un champ/une norme).
   - Angles à saturer : rôle, symptômes, diagnostic, procédure, critères de choix, **qualité + équipementiers
     réels**, normes, comparatifs, **PAA / People-Also-Ask**, prix, compatibilité, **problèmes par code moteur**,
     OEM/OE, durées de vie, couples (sourcés).
   - Cible = **`sources/`** (primaire, append-only, **URL citable + manifest**). **JAMAIS** `recycled/rag-knowledge/`.
     **NE PAS** lancer les legacy `download-oem-corpus.py` / `rag-enrich-*` / `ingest-oem-*` (= content-RAG abandonné).
   - **Découverte des sources par ENTITÉ (data-driven — « les chercher », pas les deviner)** :
     - **Gamme** : les bons équipementiers **DIFFÈRENT par gamme** (amortisseur = Bilstein/Sachs/Monroe · embrayage =
       Sachs/LuK/Valeo · filtration = Mann/Mahle/Wix · freinage = Brembo/ATE/Textar — **aucun chevauchement**). Les
       **dériver du CATALOGUE** (autorité), jamais de mémoire : `pieces ⋈ pieces_marque` filtré par
       `pieces_gamme.pg_alias`, classé `pm_oes DESC, pm_nb_stars DESC` → équipementiers réels, **OES en tête**. Puis
       marque → **site technique** : vérifié (seed = inventaire `__rag_web_ingest_jobs`, **URLs only, PAS le contenu
       RAG**) sinon **DISCOVER** par recherche — **jamais d'URL fabriquée**.
     - **Véhicule (R8)** : fiches-auto.fr (fiabilité/pannes **par code moteur**) + caradisiac.com (specs ; slug = slug
       fiche wiki → templatable) + forums véhicule. fiches-auto = **DISCOVER** (id interne non-dérivable).
     - **Diagnostic** : sources symptômes→causes (codes OBD/VAG, constructeur, forums techniques) — à découvrir de même.
     - **Dédup + refresh** : chaque cible scrapée **une seule fois** (manifest type `app/audit/scrape-targets-*.md`) ;
       rafraîchir périodiquement. Sortie toujours **`.md`** par `target_wiki_field` (cf. ci-dessus).
   - **Mesure de la substance produite (complète l'étape 5)** : le **scorer shadow ADR-088**
     (`automecanik-wiki/_scripts/shadow_score.py`, 6 dimensions à **planchers entity-type-aware**) note
     `claim`/`applies_to`/`evidence`/`related_gammes` par engineBlock → re-scraper jusqu'au TIER A.
2. **RAW** (`automecanik-raw/`) — normaliser/recycler le scrape en fiches sourcées (frontmatter contrat
   `_schemas/recycled-frontmatter.schema.json`), `verification_status` `to_verify`→`verified` (humain).
   `recycled/` n'est **jamais** canon (canon RAW `CLAUDE.md`).
3. **WIKI** (`automecanik-wiki/`) — proposer (`proposals/`), structurer aux sections ADR-086 (TIER A), export
   ajv. **Promotion = gouvernée ADR-083 tiered** (TIER A auto fail-closed · TIER B humain · vagues mesurées).
   Jamais un GO big-bang. Seul `WIKI_ACCEPTED` promu alimente PROD/indexable.
4. **CONSUMER** (R1/R2/R8…) — lisent la **projection WIKI→DB** (ADR-059). Flags OFF par défaut, additif,
   fallback explicite logué. Jamais RAG, jamais candidat non promu en PROD.
5. **SCORE — gate rank-#1 (l'étape qui empêche de livrer du médiocre, [[feedback_rank_1_objective_and_content_excellence_bar]])**.
   Les gates WIKI existants (`_scripts/gates/` : claim/source/contradiction/risk/confidence) vérifient que le contenu
   n'est pas **faux** — ils **ne mesurent pas l'excellence**. Ajouter une **mesure rank-#1 capable** (ancrée
   **ADR-086 Content Excellence Contract** + `gamme.schema` + `diversity_score`/sibling-distinctness), 5 axes :
   **① profondeur vs SERP** (couvre les tops +davantage) · **② autorité des sources** (primaire/OE/réglementaire vs
   blog secondaire) · **③ différenciation/unicité** (data/angles que les concurrents n'ont pas, dont catalogue
   AutoMecanik) · **④ motorisation-awareness** (permet les variants R2 + autorité R1) · **⑤ complétude topique**
   (entité+PAA+comparatifs+intents). **Seuil promotion = rank-#1 capable** (ex. ≥85/100, aucun axe <60).
   Si < seuil → **re-scraper plus PROFOND (pas plus large) / ré-enrichir → re-tourner** jusqu'au score. Jamais
   déclarer « fait » sans score rank-#1 capable.

## Différenciation = réelle, sur le bon AXE (anti-bricolage)
- **Jamais fabriquée** : si deux sœurs (ex. 105 std vs 105 4Motion) sont proches pour une gamme, l'assumer ;
  différencier seulement sur les points **vérifiables** (puissance, années, 4Motion, compat, référence pièce).
- **Axe par famille de gamme** :
  - gammes **moteur** (filtration, distribution, injection, turbo, embrayage) → **code moteur + known-issues**.
  - gammes **châssis** (frein, suspension, direction) → **référence pièce compatible + dynamique (poids/puissance)** ;
    le code moteur n'y est PAS le différenciateur.
- Succès = « texte **utile, sourcé, non artificiel** », pas « texte différent à tout prix ».

## INTERDITS (pièges re-rencontrés)
- ❌ **RAG comme source de contenu/SEO** (ADR-046). RAG = chatbot only. Interdit : `recycled/rag-knowledge/` comme
  source canon, scripts `download-oem-corpus.py` / `rag-enrich-*` / `ingest-oem-*` (ancienne pipeline RAG) — **NE PAS LANCER**.
- ❌ Inférer la stratégie du **code legacy** présent dans le repo (systèmes RAG morts encore là). Confirmer le
  mécanisme courant (owner / canon / pattern récemment livré), ne pas deviner.
- ❌ Toucher aux URLs/canonical ; muter `pg_relfollow`/`pg_display`/`pg_sitemap` ; keyword brut `__seo_keywords`
  comme terme produit ; casser les gates commerce R2 (sellable, `catalog_signature`, noindex 0-vendable).
- ❌ **Inventer un nouvel outil de scraping** ou contourner la gouvernance de `RUN_TARGETED_RAW_TO_WIKI`
  (sortie `draft` + validation humaine avant WIKI). Le scraping écrit en `sources/web-research/<gamme>/`,
  **jamais** directement en WIKI/PROD ni dans une page R sans promotion.

## Quand l'utiliser
Toute tâche « produire/améliorer du contenu pour ranker » (R1-R8, gamme, motorisation), débloquer le pipeline,
ou trancher « comment ». Voir mémoires : `feedback_seo_content_pipeline_scrape_raw_wiki_kw`,
`feedback_no_rag_for_content_legacy_code_is_not_strategy`, `project_r8_content_solidity_phaseab_20260614`,
`reference_engine_code_mapping_auto_type_motor_code`.
