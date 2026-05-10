---
name: pollution-scanner
description: "Scanner pollution OEM/scraping dans __seo_gamme_conseil. Use when user mentions scanner pollution, détecter scraping, fragments OEM, Textar, Brembo, 'Skip to main content', 'Source: web/', ou audit contenu pipeline v5."
---

# Pollution Scanner — Détection de contenu scrapé/pollué

## Position dans le pipeline

- **Quand** : AVANT `content-gen` (nettoyage préalable) ou APRÈS (vérification post-production)
- **Entrée** : sections `__seo_gamme_conseil` en DB
- **Sortie** : rapport de pollution avec patterns détectés, scores, et propositions de nettoyage
- **Chaîne** : `pollution-scanner` → `surgical-cleaner` (nettoyage) → `content-gen` (regénération si besoin)
- **Ne fait PAS** : génération de contenu, écriture en DB, audit SEO global

## Contexte

Le site AutoMecanik a subi une injection massive de contenu scrapé par 73 services pipeline qui écrivaient dans les sections conseils (`__seo_gamme_conseil`). Ce scanner détecte les fragments polluants restants.

## Quand utiliser

- Audit d'une gamme spécifique (par pg_id ou nom)
- Scan de toutes les gammes pour détecter la pollution résiduelle
- Vérification après un nettoyage chirurgical
- Détection de nouvelles pollutions après un batch pipeline

## Base de données

- **Projet Supabase** : `cxpojprgwgubzjyqzmoq`
- **Table** : `__seo_gamme_conseil`
- **Colonnes clés** : `sgc_pg_id` (TEXT), `sgc_section_type`, `sgc_content`, `sgc_enriched_by`
- **Outil** : `mcp__claude_ai_Supabase__execute_sql`

## Les 15+ patterns de pollution

Exécuter cette classification SQL sur le contenu :

```sql
CASE
  WHEN sgc_content ~* 'Source:\s*web/' THEN 'RAG_SCRAPING'
  WHEN sgc_content ~* 'Source:\s*web-catalog/' THEN 'RAG_SCRAPING'
  WHEN sgc_content ~* 'Skip to main content|Skip to menu|Skip to footer' THEN 'NAV_SCRAPING'
  WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ|Reconditionnement des' THEN 'OEM_MARKETING'
  WHEN sgc_content ~* 'Textar équipées|Brembo.*premium|Verniciatura|Beschichtung' THEN 'OEM_PRODUCT'
  WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s|##\s+Quand\s|##\s+Quel' THEN 'BLOG_H2_INJECTED'
  WHEN sgc_content ~* '- Vivacar|vroomly|oscaro\.com|mister-auto' THEN 'COMPETITOR_SCRAPING'
  WHEN sgc_content ~* 'Inscription newsletter|Aller au contenu|Gestion des cookies' THEN 'NAV_SCRAPING'
  WHEN sgc_content ~* 'Téléchargement →|Partager sur' THEN 'NAV_SCRAPING'
  WHEN sgc_content ~* 'Formula XT|Essential Line|Technologies de plaquettes' THEN 'OEM_MARKETING'
  ELSE 'CLEAN'
END as pollution_type
```

## Workflow

### 1. Scan d'une gamme spécifique

```sql
SELECT sgc_section_type, LENGTH(sgc_content) as len, sgc_enriched_by,
  LEFT(sgc_content, 300) as preview,
  -- classifier pollution
  CASE WHEN sgc_content ~* 'Source:\s*web/' THEN 'RAG_SCRAPING'
       WHEN sgc_content ~* 'Skip to main content' THEN 'NAV_SCRAPING'
       WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s' THEN 'BLOG_H2_INJECTED'
       ELSE 'CLEAN' END as pollution_type
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}'
ORDER BY sgc_section_type;
```

### 2. Scan grande échelle (toutes gammes)

```sql
SELECT pollution_type, COUNT(*) as section_count, COUNT(DISTINCT sgc_pg_id) as gamme_count
FROM (
  SELECT sgc_pg_id,
    CASE
      WHEN sgc_content ~* 'Source:\s*web/' THEN 'RAG_SCRAPING'
      WHEN sgc_content ~* 'Skip to main content|Skip to menu|Skip to footer' THEN 'NAV_SCRAPING'
      WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ|Reconditionnement des' THEN 'OEM_MARKETING'
      WHEN sgc_content ~* 'Textar équipées|Brembo.*premium|Verniciatura|Beschichtung' THEN 'OEM_PRODUCT'
      WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s|##\s+Quand\s|##\s+Quel' THEN 'BLOG_H2_INJECTED'
      ELSE 'CLEAN'
    END as pollution_type
  FROM "__seo_gamme_conseil"
  WHERE sgc_enriched_by IS DISTINCT FROM 'pipeline-v5-surgical-clean'
    AND sgc_enriched_by IS DISTINCT FROM 'pipeline-v5-replace'
) sub
GROUP BY pollution_type
ORDER BY section_count DESC;
```

### 3. Détail des sections polluées

```sql
SELECT sgc_pg_id, sgc_section_type, LENGTH(sgc_content) as len,
  LEFT(sgc_content, 200) as preview
FROM "__seo_gamme_conseil"
WHERE sgc_enriched_by IS DISTINCT FROM 'pipeline-v5-surgical-clean'
  AND sgc_enriched_by IS DISTINCT FROM 'pipeline-v5-replace'
  AND (
    sgc_content ~* 'Source:\s*web/'
    OR sgc_content ~* 'Skip to main content'
    OR sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ|Reconditionnement des'
    OR sgc_content ~* 'Textar équipées|Brembo.*premium|Verniciatura'
    OR sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s|##\s+Quand\s|##\s+Quel'
  )
ORDER BY sgc_pg_id, sgc_section_type;
```

## Format du rapport

Présenter les résultats sous cette forme :

| pg_id | Gamme | Section | Type pollution | Taille | Priorité |
|-------|-------|---------|----------------|--------|----------|

Priorité = HAUTE si S4_DEPOSE 100% scrapé ou taille > 3000 chars, MOYENNE sinon.

## Faux positifs connus

- **pg_id=1164 (Accessoires plaquettes) S3** : le regex capte "Brembo" dans un contexte technique légitime de compatibilité étrier. Ce n'est PAS de la pollution.
- Le contenu technique qui mentionne des marques dans un contexte de comparaison ou compatibilité est légitime.

## Coverage Manifest (obligatoire en sortie)

Tout scan DOIT produire :
```
scope_requested: [ce qui a été demandé]
scope_actually_scanned: [nombre sections / gammes]
excluded_paths: [sections déjà nettoyées pipeline-v5-*]
unscanned_zones: [patterns non couverts]
corrections_proposed: [nombre]
remaining_unknowns: [faux positifs possibles]
final_status: SCOPE_SCANNED ou PARTIAL_COVERAGE
```

Ne JAMAIS dire "tout scanné" ou "100% couvert". Utiliser `SCOPE_SCANNED` avec le périmètre exact.
