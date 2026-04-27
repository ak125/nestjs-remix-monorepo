---
name: content-quality-gate
description: |
  Quality gate pour le contenu des sections conseils dans __seo_gamme_conseil (Supabase). Utilise cette skill quand l'utilisateur veut "vérifier qualité", "scorer contenu", "quality check", "audit qualité section", "comparer contenu", "détecter sections faibles", "gap analysis", ou "review queue". Aussi quand on parle de verdicts WRITE/REVIEW/BLOCK, scoring de contenu, ou détection de régressions. Peut être utilisé seul pour un audit qualité, ou en combinaison avec surgical-cleaner et legacy-recycler comme gate de validation.
---

# Content Quality Gate — Scoring et validation de contenu

## Principe fondamental

**3 niveaux de vérification, jamais de write automatique.** Scorer -> Comparer -> Décider. Tout verdict BLOCK ou REVIEW stoppe le pipeline jusqu'à validation humaine.

## Base de données

- **Projet Supabase** : `cxpojprgwgubzjyqzmoq`
- **Table** : `__seo_gamme_conseil`
- **Colonnes** : `sgc_pg_id` (TEXT !), `sgc_section_type`, `sgc_content`, `sgc_enriched_by`
- **Outil** : `mcp__claude_ai_Supabase__execute_sql`

## Démarcation avec les skills existantes

| Skill | Rôle | Scope |
|-------|------|-------|
| **content-quality-gate** (ce skill) | **Gate technique** : pollution, longueur, régression, scoring objectif | Avant/après toute écriture en DB |
| `seo-content-architect` | **Gate éditorial** : R2D2, E-E-A-T, intent-first, GEO | Pendant la rédaction SEO |
| `content-audit` | **Audit structurel** : Intent-First, Evidence-First, Decision-First | Post-production, audit page complète |
| `seo-gamme-audit` | **Audit SEO large** : scores R1-R8, maillage, vocab interdit | Audit gamme multi-rôle |

Ce skill ne remplace pas les autres — il est le **garde-fou technique** qui bloque les régressions et la pollution AVANT que le contenu n'arrive en DB.

---

## Niveau 1 : Score par section (L1)

Chaque section reçoit un score 0-100 basé sur des critères objectifs.

### Critères de scoring universels

| Critère | Points | Mesure |
|---------|--------|--------|
| **Longueur** | 0-15 | <50 chars = 0, 50-150 = 5, 150-400 = 10, 400-1500 = 15, >3000 = 10 (pénalité verbosité) |
| **Absence pollution** | 0-20 | Les 15+ regex pollution-scanner : 0 match = 20, 1 match = 5, 2+ = 0 |
| **Structure HTML** | 0-15 | Présence `<b>`, `<ul>`, `<li>`, `<br>` appropriés = 15, texte brut sans structure = 5, HTML cassé = 0 |
| **Spécificité pièce** | 0-20 | Mentionne la pièce/gamme par nom + détails techniques = 20, générique = 5, hors-sujet = 0 |
| **Cohérence section** | 0-15 | Le contenu correspond au type de section (S1=fonction, S2=quand, S3=choix, etc.) |
| **Français correct** | 0-15 | Pas de fragments étrangers, pas de phrases incomplètes, pas de mots coupés |

### Critères spécifiques par type de section

| Section | Bonus/Malus spécifiques |
|---------|------------------------|
| S1 (fonction) | +10 si explique le rôle mécanique concret, -10 si copié de Wikipedia |
| S2 (quand changer) | +10 si liste de symptômes concrets, -10 si générique "consultez un pro" |
| S3 (comment choisir) | +10 si critères d'achat spécifiques (marques, specs), -10 si marketing |
| S4_DEPOSE | +10 si étapes numérotées avec outils, -10 si blog scrapé |
| S5 (erreurs) | +10 si erreurs spécifiques au composant, -10 si "ne pas oublier de vérifier" |
| S6 (vérifications) | +10 si méthode de diagnostic concrète, -10 si conseil vague |

### Requête SQL de scoring rapide

```sql
SELECT sgc_pg_id, sgc_section_type,
  LENGTH(sgc_content) as len,
  sgc_enriched_by,
  -- Indicateurs pollution
  CASE WHEN sgc_content ~* 'Source:\s*web/' THEN 1 ELSE 0 END as has_rag_scraping,
  CASE WHEN sgc_content ~* 'Skip to main content|Gestion des cookies' THEN 1 ELSE 0 END as has_nav_scraping,
  CASE WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ' THEN 1 ELSE 0 END as has_oem_marketing,
  CASE WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s' THEN 1 ELSE 0 END as has_blog_h2,
  -- Indicateurs qualité
  CASE WHEN LENGTH(sgc_content) BETWEEN 150 AND 1500 THEN 'OK'
       WHEN LENGTH(sgc_content) < 50 THEN 'VIDE'
       WHEN LENGTH(sgc_content) > 3000 THEN 'SUSPECT'
       ELSE 'COURT' END as length_verdict
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}'
ORDER BY sgc_section_type;
```

## Niveau 2 : Comparaison avec existant (L2)

Avant toute modification, comparer le contenu proposé avec l'existant.

### Règle anti-régression

**BLOCK si le nouveau contenu est inférieur à l'existant.** Critères :
- Score L1 du nouveau < Score L1 de l'existant
- Nouveau plus court ET moins spécifique
- Nouveau contient de la pollution détectable
- Existant est tagué `pipeline-v5-surgical-clean` (déjà nettoyé manuellement)

### Matrice de décision

| Existant | Nouveau proposé | Verdict |
|----------|-----------------|---------|
| Vide / <50 chars | Score >= 70 | WRITE |
| Vide / <50 chars | Score 40-69 | REVIEW |
| Vide / <50 chars | Score < 40 | BLOCK |
| Court (<300) générique | Score >= 70 + spécifique | WRITE |
| Court (<300) générique | Score 40-69 | REVIEW |
| Bon (>300, propre) | Score >= 80 + nettement supérieur | REVIEW (validation manuelle) |
| Bon (>300, propre) | Score < 80 | BLOCK (pas de régression) |
| Déjà nettoyé (v5-*) | Tout | BLOCK (sauf si score > 90 + REVIEW) |

### Requête de comparaison

```sql
SELECT sgc_pg_id, sgc_section_type,
  LENGTH(sgc_content) as current_len,
  sgc_enriched_by,
  LEFT(sgc_content, 300) as current_preview
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}'
```

## Niveau 3 : Review Queue (L3)

Les sections avec verdict REVIEW sont mises en file d'attente pour validation humaine.

### Verdicts finaux

| Verdict | Signification | Action |
|---------|---------------|--------|
| **WRITE** | Qualité suffisante, pas de régression | Peut être écrit après confirmation rapide |
| **REVIEW** | Qualité incertaine ou cas limite | Nécessite examen humain détaillé |
| **BLOCK** | Régression détectée ou qualité insuffisante | Ne pas écrire, chercher meilleure source |

## Gap Detection — Sections manquantes

Scanner les gammes pour détecter les sections absentes ou vides :

```sql
SELECT pg.pg_id, pg.pg_nom,
  ARRAY_AGG(sgc.sgc_section_type) as sections_presentes
FROM "__piece_gamme" pg
LEFT JOIN "__seo_gamme_conseil" sgc ON sgc.sgc_pg_id = pg.pg_id::text
WHERE pg.pg_id IN (
  SELECT DISTINCT sgc_pg_id::int FROM "__seo_gamme_conseil"
)
GROUP BY pg.pg_id, pg.pg_nom;
```

Sections attendues pour une gamme complète : `S1, S2, S2_DIAG, S3, S4_DEPOSE, S4_REPOSE, S5, S6, S_GARAGE, S7, S8, META`

### Priorisation des gaps

| Section manquante | Priorité | Raison |
|-------------------|----------|--------|
| S3 (comment choisir) | HAUTE | Impact SEO direct, aide conversion |
| S4_DEPOSE (démontage) | HAUTE | Contenu unique, forte valeur ajoutée |
| S2 (quand changer) | MOYENNE | Symptômes, aide diagnostic |
| S5 (erreurs) | MOYENNE | Différenciation, valeur pratique |
| S1 (fonction) | BASSE | Souvent couvert par description produit |

## Workflow complet

1. **Scoring L1** : Exécuter la requête de scoring sur la gamme cible
2. **Analyse** : Calculer le score composite pour chaque section
3. **Comparaison L2** : Si modification proposée, comparer avec l'existant
4. **Verdict** : WRITE / REVIEW / BLOCK pour chaque section
5. **Gap detection** : Identifier les sections manquantes
6. **Rapport** : Tableau récapitulatif + coverage manifest

## Rapport de sortie

Après chaque audit qualité, produire :

| pg_id | Section | Score L1 | Pollution | Longueur | Verdict | Gap? |
|-------|---------|----------|-----------|----------|---------|------|

Plus le coverage manifest obligatoire (voir agent-exit-contract.md).

## Attention SQL

- `sgc_pg_id` est TEXT -> utiliser des quotes : `WHERE sgc_pg_id = '82'`
- `pg_id` dans `__piece_gamme` est INT -> cast si jointure : `pg.pg_id::text = sgc.sgc_pg_id`
- Pas de colonne `sgc_updated_at` (elle n'existe pas)
