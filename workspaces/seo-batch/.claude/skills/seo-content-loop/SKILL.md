---
name: seo-content-loop
description: "Enrichissement, admission et projection des faits techniques AutoMecanik : recherche/RAW → WIKI approuvé → consommateurs, selon le canon vault ADR-031/046/059/083/086. Utiliser pour compléter les preuves d'une gamme/motorisation, préparer leur admission ou diagnostiquer ce pipeline. Pour la création éditoriale ou vidéo, suivre d'abord le brief et les méthodes créatives ; ce skill traite les faits à admettre et ne choisit ni le premier lot ni l'angle. NO-RAG pour la production de contenu."
license: Internal - Automecanik
version: "1.1"
argument-hint: "[gamme-name | vehicle-slug | status]"
disable-model-invocation: false
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Glob, Grep, Bash
---

# SEO Content Loop — enrichissement, admission et projection (NO-RAG)

> **Skill = méthode opératoire, PAS canon.** La gouvernance vit au **vault** :
> ADR-031 (raw/wiki/rag/seo separation) · ADR-046 (RAG = retrieval chatbot only) ·
> ADR-059 (SEO Runtime Projection) · ADR-083 (tiered WIKI promotion) · ADR-086 (Content Excellence Contract).
> Ce skill **pointe** vers eux, ne les réécrit jamais.

## Portée dans une mission éditoriale ou vidéo

Suivre d'abord la gamme prioritaire, le brief et les rôles de pages demandés.
Pour le programme catalogue, lire **Programme éditorial et média** dans
`.claude/knowledge/workspaces.md` (chemin relatif à la racine du dépôt).
Ne pas sélectionner le lot suivant d'après une fiche WIKI disponible ou un ancien pilote.

La recherche de références, les angles, la composition et les brouillons non servis
peuvent avancer avant l'admission de nouveaux faits. Utiliser les méthodes créatives
pertinentes et distinguer les références d'inspiration des preuves techniques.
Tracer les affirmations candidates, leurs sources, leur portée et leur statut dans
le dossier existant. Une fiche WIKI incomplète ne borne pas la recherche éditoriale.

Appliquer la chaîne ci-dessous aux faits à enrichir, admettre et projeter avant leur
mise à disposition dans les consommateurs. Conserver toutes les validations de
promotion, de sécurité et de publication. Ne pas étendre le blocage d'une affirmation
aux parties indépendantes du dossier. Un score qualité interne ne prouve ni un rang
Google ni une hausse des ventes.

## Axiome n°0 (non-négociable)
> **Le contenu ne crée jamais l'information.** Il structure, clarifie, expose ce qui est **sourcé et vérifié**.
> En cas de doute : s'abstenir. Jamais d'invention LLM, jamais de number-swapping, jamais de filler générique.

## La BOUCLE d'admission et de projection (ordre inchangé)

```
SCRAPING LARGE (RUN_TARGETED_RAW_TO_WIKI) → RAW → WIKI → score SUBSTANCE (shadow, sur le WIKI)
  → revue/promotion → export → projection data → CONSUMER (R1/R2/R8) → resolver balises
  → CONSTRUIRE le scorer SEO surface (shadow) → composition R2 → rendu SSR → EXÉCUTER le score surface
  → audit cluster (intra + cross-gamme) → calibration → correction → re-passage → outcome
```

> **2 scores à 2 étapes** : substance (sur le WIKI, tôt) ≠ surface SEO (après composition+rendu, tard) ;
> **construire le scorer ≠ l'exécuter**. Verdict terminal de page = `PAGE_QUALITY_COMPOSITE_PASS`
> (ADR-094, **shadow/gated** jusqu'à calibration — cf. §« scoring en transition » plus bas).
>
> **Chaîne d'autorité** : besoin client → recherche → RAW → WIKI admis → exports/projections → consommateurs.
> RAG = consommateur chatbot : ni source, ni étape de cette chaîne.

1. **SCRAPING LARGE** (web → `automecanik-raw/sources/web-research/<gamme>/`) — la 1ʳᵉ étape, pas RAW directement.
   - **Méthode de scraping = run web-research `RUN_TARGETED_RAW_TO_WIKI <gamme>`** (label du run, pas un CLI) :
     **N agents web-research read-only parallèles**, sources FR auto, **anti-pollution** (faits **reformulés**,
     non verbatim), **chaque fait cité + confidence-rated**. **Sortie structurée mappée aux champs WIKI**
     (`target_wiki_field`) : `selection-criteria.md` · `common-mistakes.md` · `compatibility-technical.md` ·
     `price-quality-brands.md` · `faq-symptoms.md` + `source-index.json` (provenance) + `extraction-report.json`
     (run, contradictions, governance). `verification_status: draft` → **aucune promotion WIKI** sans la
     décision du décideur unique sur preuve, auto-review de sens comprise (ADR-119) ; une contradiction bloque
     la fiche jusqu'à une capture qui la tranche ; **0 publication**, **0 invention**. **Template livré (preuve)** :
     `automecanik-raw/sources/web-research/colonne-de-direction/` (pg 1211, 31 sources).
   - Le handoff `raw-to-wiki` (état **PARTIAL**, gate **`human_review_required`**, antérieur à ADR-119 et sans
     effet : aucune relecture humaine de fiche n'est une condition de promotion) est tracé dans la projection
     **de référence** (non-canon) `.spec/00-canon/ai-registry/agent-operating-map.yaml` ; le **canon** est au
     vault (**ADR-031** raw→wiki, **ADR-059** projection, **ADR-083** promotion tiered).
   - **Point de départ = besoin client** : les questions réelles de la gamme/motorisation (choix, compatibilité,
     symptômes, entretien, PAA), chacune rattachée à un `target_wiki_field`. La recherche répond à ces questions ;
     elle ne cherche pas à « saturer » le sujet.
   - **PROFONDEUR > LARGEUR (owner 2026-06-15, [[feedback_rank_1_objective_and_content_excellence_bar]])** :
     re-synthétiser les **mêmes blogs distributeurs/médias qui rankent déjà** (Oscaro/Vroomly/Mister-Auto…) = contenu
     **dérivé**, qui ne dépasse pas ce qu'il recopie. Préférer les **sources primaires/autoritaires** (OE
     technique/datasheets, **texte réglementaire brut** UNECE/ISO/SAE, registres FMSI/WVA), la **data réelle**, des
     angles/comparatifs uniques et la **data catalogue AutoMecanik par véhicule** (réf/fitment/specs).
     **Motorisation-aware** = condition des variants R2.
   - **Multi-source, par gamme ET par motorisation**, sans gap-filling myope (ne pas s'isoler sur un champ/une norme).
     **Borne** : la recherche d'une question s'arrête dès qu'une passe n'ajoute aucune source citable nouvelle, et au
     plus au nombre de passes fixé par le brief du run. Une question restée sans source est notée `non sourcée` dans
     `extraction-report.json` ; elle ne bloque pas les questions sourcées du même lot.
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
   - **Mesure de la substance produite (complète l'étape 5) — ⚠️ SCORING EN TRANSITION + ⚠️ ÉTAT RUNTIME À VÉRIFIER SUR `origin/main`** :
     - **Ne pas traiter ce skill comme une vérité runtime figée.** Les scorers + la porte de promotion du wiki
       (`_scripts/compute-confidence-score.py`, `_scripts/promote.py` ADR-083 TIER A/B, `_scripts/shadow_score.py` ADR-088 6-dim
       derrière flag `PROMOTE_GATE_ENGINE`, gate régression `compare-proposal-versions.py`) **évoluent vite et peuvent être
       absents ou différents sur un checkout périmé** (incident 2026-07-02 : checkout wiki 31+ commits derrière `origin/main`).
       **AVANT de t'appuyer sur eux** : (1) lancer la garde de fraîcheur `scripts/ops/check-repo-freshness.sh <chemin-wiki> origin/main`
       (racine monorepo) — si `STALE`, ne conclus pas sur le vieux code ; (2) lire l'état réel via
       `git -C <chemin-wiki> show origin/main:_scripts/<fichier>` (présence + statut de câblage + seuil). **En cas de conflit
       entre ce skill (dérivé) et l'état réel du repo : l'état du repo l'emporte.**
     - **Doctrine stable (indépendante du checkout)** : le score scalaire seul ne suffit jamais à déclarer « TIER A / fait ».
       La promotion reste gouvernée par la **porte tiered déterministe** (ADR-083 : TIER A auto fail-closed / TIER B bloqué par ses motifs, réévalué
       automatiquement, sans approbation humaine — ADR-119),
       durcie par le scorer de substance (ADR-088, planchers par claim) et recalibrée sur `source-catalog` (ADR-091) ;
       **les familles sécurité (freinage/direction/airbag/suspension) suivent ADR-114 avec la condition
       d'auto-review de sens d'ADR-119 D3, sans relecture humaine** ; tant que la levée d'ADR-119 D4 n'est pas
       inscrite dans le décideur, elles restent bloquées.
       Tant que le scorer autoritaire cible n'est pas confirmé câblé **sur `origin/main`**, traiter le verdict comme **indicatif**.
       (Détail + plan : `app/audit/content-loop-method-confusion-and-hardening-2026-06-22.md`.)
2. **RAW** (`automecanik-raw/`) — normaliser/recycler le scrape en fiches sourcées (frontmatter contrat
   `_schemas/recycled-frontmatter.schema.json`), `verification_status` `to_verify`→`verified` (humain).
   `recycled/` n'est **jamais** canon (canon RAW `CLAUDE.md`).
3. **WIKI** (`automecanik-wiki/`) — proposer (`proposals/`), structurer aux sections ADR-086 (TIER A), export
   ajv. **Promotion = gouvernée ADR-083 tiered** (TIER A auto fail-closed · TIER B bloqué par ses motifs, sans approbation humaine (ADR-119) ·
   vagues mesurées).
   Jamais un GO big-bang. Seul `WIKI_ACCEPTED` promu alimente PROD/indexable.
4. **CONSUMER** (R1/R2/R8…) — lisent la **projection WIKI→DB** (ADR-059). Flags OFF par défaut, additif,
   fallback explicite logué. Jamais RAG, jamais candidat non promu en PROD. **Projeté ≠ servi** : une version
   active en DB n'est lue que sous `SEO_PROJECTION_READ_V1` + jeton `<ROLE>@<entity_id>` de
   `SEO_PROJECTION_READ_CANARY` ; sinon le rendu sert le legacy (constat filtre à huile, 2026-10-31).
5. **MESURE — quatre axes séparés, aucun ne compense un autre** (ambition éditoriale :
   [[feedback_rank_1_objective_and_content_excellence_bar]]) :
   - **① Validation factuelle** — gates WIKI existants (`_scripts/gates/` : claim/source/contradiction/risk/confidence)
     et admission ADR-083/119 : le contenu n'est pas **faux**, chaque claim est sourcé. Bloquant.
   - **② Qualité éditoriale** — mesure d'excellence ancrée **ADR-086 Content Excellence Contract** + `gamme.schema` +
     `diversity_score`/sibling-distinctness : profondeur vs SERP, autorité des sources, différenciation (dont
     catalogue AutoMecanik), motorisation-awareness, complétude topique. Seuils = ceux du scorer gouverné en place
     (cf. étape 1, « scoring en transition ») ; ce skill n'en fixe aucun.
   - **③ Conformité technique** — rendu servi : statut, robots, canonical, H1, JSON-LD conforme au visible, liens
     valides, bornes du contrat de rendu (skill `seo-gamme-audit`).
   - **④ Performance observée** — GSC/GA4 après mise en ligne, période citée ; jamais inventée, sinon `non mesurée`.
     Un rang (« #1 ») est une **observation**, ni une garantie ni un critère de promotion.
   - **Itération bornée** : sous le seuil ②, reprise ciblée sur la dimension faible (re-scraper plus **profond** sur
     les questions concernées, pas plus large), puis re-mesure. Arrêt dès que le seuil est atteint, qu'une reprise ne
     fait plus progresser la mesure, ou au maximum de reprises fixé par le brief : le lot est alors livré `à revoir`
     avec ses manques, pas relancé indéfiniment. Ne jamais relever une note, retirer un critère ni assouplir un seuil
     pour passer. Une règle ou un seuil canonique change par son circuit de gouvernance (vault/ADR), jamais par une
     édition de ce skill ou d'un miroir.

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
  (sortie `draft` ; la promotion WIKI relève du seul décideur, ADR-119). Le scraping écrit en `sources/web-research/<gamme>/`,
  **jamais** directement en WIKI/PROD ni dans une page R sans promotion.

## Quand l'utiliser
Enrichir les preuves d'une gamme/motorisation, préparer leur admission WIKI, vérifier
leur projection ou débloquer ce pipeline. Pour une production éditoriale ou vidéo,
l'appliquer aux faits concernés sans remplacer le brief ni les méthodes créatives.
Voir mémoires : `feedback_seo_content_pipeline_scrape_raw_wiki_kw`,
`feedback_no_rag_for_content_legacy_code_is_not_strategy`, `project_r8_content_solidity_phaseab_20260614`,
`reference_engine_code_mapping_auto_type_motor_code`.
