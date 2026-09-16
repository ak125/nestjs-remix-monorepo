---
name: seo-content-loop
description: "Piloter la boucle éditoriale SEO AutoMecanik : sources utiles, RAW, WIKI validé, projection et contrôle des pages. Vérifier règles applicables, preuves, scores et doublons avant de conclure. À utiliser pour enrichir une gamme ou un véhicule, diagnostiquer la boucle ou évaluer la qualité du contenu. RAG réservé au chatbot ; aucune garantie de classement."
license: Internal - Automecanik
version: "1.1"
argument-hint: "[gamme-name | vehicle-slug | status]"
disable-model-invocation: false
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Glob, Grep, Bash
---

# SEO Content Loop

Méthode opératoire dérivée, pas une source de gouvernance. Lire le contrat racine
`CLAUDE.md` et les décisions courantes du vault avant un run. Les références ci-dessous
orientent la lecture ; elles ne remplacent ni leurs amendements ni l'état du code.

## Vérifier les règles avant de corriger ou valider

1. Identifier l'usage : article général, choix pour un véhicule précis, procédure
   technique ou page commerciale. Lire les règles du domaine et le registry comme
   prescrit par le contrat racine, puis les contrats des rôles réellement concernés.
2. Vérifier la fraîcheur des repos avec `scripts/ops/check-repo-freshness.sh` avant
   d'interpréter un checkout externe. Comparer les fichiers concernés à `origin/main` ;
   conserver les changements du candidat et distinguer base, candidat et runtime.
3. Consulter au vault le statut, les amendements et les remplacements des ADRs :
   séparation des couches (031/046/059), rôles et composition (047/066/067/070),
   WIKI et qualité (083/086/088/089/091/092/093), découverte (096).
   ADR-094 est une proposition de verdict composite, pas un gate actif établi.
   ADR-095 présente un conflit de statut entre en-tête et corps ; le signaler,
   vérifier les contrôles réellement appliqués et ne pas déduire une activation.
4. Lire dans le WIKI courant `_meta/source-policy.md` (§9.3),
   `_meta/quality-gates.md` (§7) et `_scripts/promotion_decision.py` :
   la décision automatique du 12 septembre 2026 remplace la revue humaine
   systématique. Preuve insuffisante = blocage avec motif puis réévaluation après
   correction, sans approbation LLM ni contournement des contrôles de sécurité.
5. Pour chaque exigence du run, relever sa référence, le contrôle existant,
   ses tests et son état : présent, branché, activé, observé. Une contradiction
   non résolue reste une limite explicite ; une règle proposée ne devient pas
   obligatoire par sa copie dans ce skill.

Avant de modifier un gate, appliquer `.claude/rules/guardrails.md` : lire ses tests,
identifier son propriétaire, vérifier l'ordre d'exécution et son contrat de portée.
Étendre les mécanismes existants. Aucun seuil arbitraire ni second décideur.

## Exécuter la boucle selon les manques utiles

**Besoin utilisateur → collecte RAW → proposition WIKI → décision automatique →
export/projection → composition et rendu → contrôles SEO → résultats observés.**

- Définir les informations manquantes pour l'intention et l'entité, avec preuves
  attendues. L'article général n'a pas à résoudre les références OE, codes moteur
  ou dimensions absents de son contenu ; la compatibilité relève du catalogue.
  Tout conseil technique précis effectivement retenu reste soumis à ses contrôles.
- Rechercher les sources appropriées à ces manques, en privilégiant les documents
  primaires applicables. Dériver les équipementiers du catalogue de la gamme,
  vérifier les sites et URLs ; ne pas inventer marques, mots-clés ou correspondances.
  Les questions et résultats de recherche éclairent la demande, pas la vérité d'un fait.
- Vérifier la capacité de collecte disponible : capture d'URLs fournies et découverte
  de nouvelles sources sont deux capacités distinctes. ADR-096 cadre la découverte ;
  sa présence ne prouve pas un moteur opérationnel. `RUN_TARGETED_RAW_TO_WIKI` est un
  label de run, pas un CLI. Utiliser le mécanisme existant et signaler la capacité
  manquante. Un seul agent par défaut, conformément aux instructions de session.
- Conserver les sources RAW et leur provenance ; extraire les passages utiles avec
  leurs références et contradictions. Vérifier l'adéquation du passage à chaque
  affirmation, son contexte et son actualité. Une URL ou une confiance déclarée
  ne constitue pas une preuve. Dédupliquer la collecte et tracer les rafraîchissements.
  Ne pas copier les textes sources pour produire une page.
- Proposer au WIKI selon ses schémas, sections canoniques et règles de preuve.
  Réutiliser le décideur existant ; le score seul n'autorise pas la promotion.
  Lire les motifs bloquants et corriger leurs causes. Un contrôle impossible reste
  bloquant ; les anciens identifiants contenant `HUMAN_REVIEW` n'imposent pas à eux
  seuls une revue humaine. La qualification WIKI n'autorise pas le diagnostic LIVE.
- Alimenter les consommateurs uniquement par les exports/projections WIKI validés
  selon les contrats existants. RAG est consommateur pour le chatbot ; ne pas relancer
  les producteurs legacy `rag-enrich-*`, `ingest-oem-*` ou `download-oem-corpus.py`.
- Mesurer après composition et rendu les contrôles applicables au rôle. Une fiche
  WIKI valide ne prouve pas la qualité de la page assemblée, ni son indexation.
  Une activation, une publication et un déploiement restent des actions distinctes.
- Réitérer lorsqu'une correction ou nouvelle preuve répond à un manque identifié.
  Sans gain d'information ou sans source vérifiable disponible, consigner la limite
  et le blocage ; ne pas répéter une collecte identique pour faire monter un nombre.

## Évaluer les scores sans les confondre avec le résultat

Séparer qualité de la source avant capture, preuve des affirmations, substance WIKI,
qualité de la page composée et résultats par page/requête. Un bon score sur un axe
ne compense pas l'échec d'un contrôle obligatoire sur un autre.

Vérifier formule, version, données réellement utilisées et câblage des scorers
existants (`compute-confidence-score.py`, `shadow_score.py`, scorers applicatifs).
Le six dimensions est observé à côté du moteur legacy et peut conditionner la
promotion selon `PROMOTE_GATE_ENGINE` ; ne pas basculer ce réglage implicitement.
Les seuils viennent du contrat et de la configuration vérifiés, pas de ce guide.

Avant de qualifier un score de fiable, le confronter à des contenus évalués
indépendamment : contenu utile sourcé, texte long répétitif, source arbitraire,
preuve hors contexte, contradiction et information manquante. Mesurer faux positifs
et faux négatifs ; un exemple adversarial démontre une limite, pas sa fréquence.
Ni longueur, ni nombre de sections, ni confiance déclarée ne certifient l'excellence.
Le classement en première position est un objectif ; aucun score interne ne le garantit.

## Contrôler les doublons au bon niveau

- **Sections** : comparer l'identité canonique, notamment `Symptômes`/`symptomes`,
  casse, accents et espaces. Réutiliser la normalisation et les contrats existants ;
  ne pas supprimer les faits distincts contenus sous deux titres équivalents.
- **Page rendue** : rechercher les répétitions de paragraphes, FAQ et blocs ajoutés
  par composition. Des empreintes différentes ne prouvent pas une information nouvelle.
- **Pages voisines** : comparer intention, rôle, catalogue et faits utiles aux
  variantes. Préserver `catalog_signature` et les règles de composition R2 ;
  ne pas fabriquer de différence pour passer un test de diversité.
- **Surface SEO** : vérifier title/H1, canonical, maillage, indexabilité effective
  et cohérence des données structurées avec le visible, selon les contrats existants.
  Distinguer collisions exactes et similarité à qualifier ; relever si le contrôle
  ne fait que produire un rapport. Aucun seuil universel de similarité dans ce guide.

Les faits communs exacts et avertissements nécessaires peuvent se répéter. Selon
ADR-067, une similarité ne déclenche pas la suppression ou la canonicalisation
automatique d'une page. Préserver les URLs et les zones STOP du contrat racine :
aucune mutation implicite de meta/H1, canonical, robots ou indexation.

## Livrable du run

Appliquer le contrat de sortie référencé par le workspace : périmètre demandé et lu,
preuves, contradictions, corrections autorisées, validations exécutées, exclusions
et inconnues. Distinguer score calculé, décision WIKI, export, page réellement servie
et résultats SEO. Ne pas annoncer la boucle validée depuis un simple run réussi.
