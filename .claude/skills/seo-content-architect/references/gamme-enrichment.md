# Phase 1d — Enrichissement gamme.md v4

> Référencée depuis `SKILL.md` (Phase 1d). Workflow d'enrichissement YAML quand des docs supplémentaires sont disponibles.

**Declencheur** : Phase 1b a trouve des docs supplementaires (web/, pdf/, guides/) via la recherche RAG, ET le gamme.md presente des lacunes dans ses 5 blocs.

**Objectif** : Enrichir le frontmatter YAML du fichier `gammes/{slug}.md` selon le **schema v4 (5 blocs)** AVANT de rediger, pour que le contenu soit fonde sur des donnees riches et verifiees.

> **Schema de reference** : `.spec/00-canon/gamme-md-schema.md` — source de verite pour la structure, les types, et les regles de chaque bloc.

## Detection de version

| Version detectee | Action |
|-----------------|--------|
| `GammeContentContract.v4` | Enrichir selon les 5 blocs ci-dessous |
| `GammeContentContract.v3` ou absent | Convertir en v4 PUIS enrichir (voir Etape 0) |

## Etape 0 — Conversion v3 → v4 (si necessaire)

Si le gamme.md est en v3 ou v1 (pas de `quality.version: GammeContentContract.v4`), proposer la conversion :

```
CONVERSION v3 → v4 proposee pour gammes/{slug}.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mapping :
  page_contract.symptoms → diagnostic.symptoms (ajouter id + severity)
  page_contract.timing → maintenance.interval
  page_contract.risk.costRange → selection.cost_range
  page_contract.antiMistakes → selection.anti_mistakes
  page_contract.howToChoose → selection.criteria
  page_contract.faq → rendering.faq
  mechanical_rules.must_be_true → domain.must_be_true
  mechanical_rules.must_not_contain_concepts → domain.must_not_contain
  mechanical_rules.confusion_with → domain.confusion_with
  mechanical_rules.role_summary → domain.role

Blocs a creer (absents en v3) :
  - selection.checklist
  - selection.brands
  - diagnostic.causes (avec %)
  - diagnostic.quick_checks
  - maintenance.usage_factors
  - maintenance.good_practices
  - installation.* (si applicable)
  - _sources (provenance)
  - cross_gammes (relations)
  - lifecycle

Valider la conversion avant enrichissement ?
```

## Etape 1 — Decouvrir les docs supplementaires

```bash
# Rechercher les docs non-gamme lies a cette piece
curl -s -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "{nom_piece}", "limit": 10, "includeFullContent": true}' \
  | jq '.results[] | select(.sourcePath | startswith("gammes/") | not) | {title, sourcePath, sourceType, score}'
```

Filtrer : garder uniquement les docs `web/`, `pdf/`, `guides/` avec `truth_level` L1 ou L2.

## Etape 2 — Lire et analyser le contenu complet

Pour chaque doc supplementaire trouve, lire le fichier source :
```
/opt/automecanik/rag/knowledge/{source_path}
```

Extraire les donnees structurees pertinentes pour les **5 blocs v4** :

| Donnee a extraire | Destination v4 | Critere d'extraction |
|-------------------|----------------|---------------------|
| Role mecanique detaille | `domain.role` (>80 chars) | Description fonctionnelle precise, sans verbe generique |
| Termes techniques cles | `domain.must_be_true` | Vocabulaire metier obligatoire dans le contenu |
| Confusions courantes | `domain.confusion_with` | Pieces proches ou causes confondues |
| Pieces associees | `domain.related_parts` + `cross_gammes` | Mentions de pieces liees au remplacement |
| Criteres de selection | `selection.criteria` (min 3) | Dimensions, types, compatibilites |
| Checklist achat | `selection.checklist` (min 3) | Etapes verification avant commande |
| Erreurs d'achat | `selection.anti_mistakes` (min 3) | Phrases "ne pas", "erreur", "eviter" |
| Fourchette de cout | `selection.cost_range` | Montants en EUR avec unite (la paire, l'unite, le kit) |
| Marques recommandees | `selection.brands` | Premium / equivalent / budget |
| Symptomes de defaillance | `diagnostic.symptoms` (min 3) | Signes d'usure avec severity (confort/securite/immobilisation) |
| Causes de panne | `diagnostic.causes` (min 2) | Ordonnees par frequence, % si connu |
| Tests sans outil | `diagnostic.quick_checks` (min 2) | Verifications visuelles/manuelles |
| Intervalles remplacement | `maintenance.interval` | Valeur + unite (km/mois/condition) + note |
| Facteurs d'usure | `maintenance.usage_factors` | Conditions accelerant l'usure |
| Bonnes pratiques | `maintenance.good_practices` | Gestes d'entretien preventif |
| Interdits entretien | `maintenance.do_not` | Actions a ne jamais faire |
| Etapes de montage | `installation.steps` (min 3) | Procedure pas a pas |
| Outils necessaires | `installation.tools` | Liste outillage |
| Erreurs de montage | `installation.common_errors` (min 2) | Erreurs de MONTAGE uniquement |
| Questions frequentes | `rendering.faq` (min 4) | Q&A avec reponses sourcees |
| Chiffres avec source | `rendering.arguments` | Claims chiffrees avec `source_ref` |

## Etape 2b — Registrer la provenance

Pour chaque doc supplementaire utilise, ajouter une entree dans `_sources` :

```yaml
_sources:
  {cle-unique}:                    # ex: bosch-2024, mopar-entretien
    type: "manufacturer"|"norm"|"field-expertise"|"study"|"rag-doc"
    doc: "{source_path}"           # chemin fichier RAG ou null
    note: "{contexte en 1 phrase}" # optionnel
```

Les champs enrichis referencent la source via `source: "{cle}"` inline.

## Etape 3 — Proposer le diff YAML v4

Presenter les enrichissements organises par bloc. Ne modifier QUE les champs absents ou insuffisants :

```yaml
# ENRICHISSEMENTS PROPOSES pour gammes/{slug}.md (schema v4)
# Sources : {liste des docs avec titre abrege}
# Blocs enrichis : {liste} / Blocs inchanges : {liste}

_sources:  # +{N} nouvelles entrees
  {cle}:
    type: "{type}"
    doc: "{path}"
    note: "{contexte}"

domain:  # Bloc A
  role: "{enrichi si <80 chars}"
  must_be_true:  # +{N}
    - "{terme}" # [source: {cle}]
  confusion_with:  # +{N}
    - term: "{piece}"
      difference: "{explication}" # [source: {cle}]
  cross_gammes:  # NOUVEAU
    - slug: "{gamme-liee}"
      relation: "{type}"
      context: "{explication}"

selection:  # Bloc B
  criteria:  # +{N}
    - "{critere}" # [source: {cle}]
  anti_mistakes:  # +{N}
    - "{erreur}" # [source: {cle}]
  cost_range:  # AVANT: absent → APRES: renseigne
    min: {N}
    max: {N}
    currency: EUR
    unit: "{unite}"
    source: "{cle}"

diagnostic:  # Bloc C
  symptoms:  # +{N} (avec id + severity)
    - id: "S{N}"
      label: "{symptome}" # [source: {cle}]
      severity: "{confort|securite|immobilisation}"
  causes:  # +{N} (avec %)
    - "{cause} ({X}%)" # [source: {cle}]

maintenance:  # Bloc D
  interval:  # AVANT: generique → APRES: chiffre
    value: "{valeur}"
    unit: "{km|mois|condition}"
    note: "{condition critique}"
    source: "{cle}"

rendering:
  faq:  # +{N}
    - question: "{question}"
      answer: "{reponse}" # [source: {cle}]
  arguments:
    - title: "{claim chiffree}"
      icon: "{lucide-icon}"
      source_ref: "{cle}" # OBLIGATOIRE si chiffre

lifecycle:
  stage: "v4_converted"  # ou "skill_enriched" si deja v4
  last_enriched_by: "skill:seo-content"
  last_enriched_at: {date du jour}
```

**Regles d'enrichissement :**
1. **Ne jamais ecraser** — ajouter aux listes existantes, ne pas remplacer
2. **Deduplication** — verifier que le nouveau contenu n'est pas deja present (meme sens)
3. **Sourcer** — chaque ajout annote avec le doc source + entree dans `_sources`
4. **Max 5 ajouts par champ** — au-dela, prioriser par pertinence
5. **Validation obligatoire** — presenter le diff et demander : "Ces enrichissements sont corrects ? Je mets a jour gamme.md et je continue la redaction."
6. **Hard gates** — verifier AVANT de proposer :
   - `domain.role` > 80 chars et pas de pattern generique
   - `selection.cost_range.max < 10 * cost_range.min`
   - Tout chiffre dans `rendering.arguments` a un `source_ref`
7. **Scoring** — estimer le score v4 apres enrichissement (ref: `.spec/00-canon/gamme-md-schema.md` §Scoring v4)

## Etape 4 — Appliquer les modifications

Apres validation de l'admin, mettre a jour le fichier `gammes/{slug}.md` via l'outil Edit :
- Mettre a jour `updated_at` a la date du jour
- Mettre a jour `lifecycle.stage` et `lifecycle.last_enriched_by`
- Mettre a jour `quality.version: GammeContentContract.v4` si conversion

> **Si aucun doc supplementaire n'est trouve** : passer directement a Phase 2. Le skill fonctionne normalement avec les donnees existantes du gamme.md.

> **Si le gamme.md v4 est deja riche** (tous les seuils minimums atteints par bloc) : noter "Gamme.md v4 deja complet, aucun ajout necessaire" et passer a Phase 2.
