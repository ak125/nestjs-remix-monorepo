---
name: surgical-cleaner
description: "Nettoyage chirurgical sections polluées __seo_gamme_conseil. Use when user mentions nettoyer section, supprimer pollution, clean gamme, couper pollution, remplacer S4_DEPOSE. À utiliser APRÈS pollution-scanner."
---

# Surgical Cleaner — Nettoyage section par section

## Principe fondamental

**Ne JAMAIS modifier sans validation humaine.** Proposer le nettoyage, attendre "ok" ou "je valide", puis exécuter. Toujours montrer avant/après.

## Base de données

- **Projet Supabase** : `cxpojprgwgubzjyqzmoq`
- **Table** : `__seo_gamme_conseil`
- **Colonnes** : `sgc_pg_id` (TEXT !), `sgc_section_type`, `sgc_content`, `sgc_enriched_by`
- **Outil** : `mcp__claude_ai_Supabase__execute_sql`

## Catégories de sections

Chaque type de section a un traitement spécifique :

### PROTECTED — Ne pas toucher
`S4_REPOSE`, `S6`, `S_GARAGE`, `S7`, `S8`, `META`

Ces sections ont un format structuré (tableaux, FAQ schema.org, détails/summary) qui ne supporte pas un nettoyage partiel. Si polluées, signaler pour review manuelle.

**Exception** : S6 peut être REPLACE si 100% copie d'une autre section (ex: pg_id=689 S6 était une copie de S4_DEPOSE).

### CLEAN — Retirer les fragments polluants
`S1`, `S2`, `S2_DIAG`, `S3`, `S5`

Le contenu propre est en début de section (checklist de symptômes, critères de choix, liste d'erreurs). La pollution est greffée en queue. Technique :

1. Lire le contenu complet
2. Identifier le point de coupure (premier `# `, `## `, `### `, `(Source: web/`, marketing OEM)
3. Garder tout ce qui précède
4. Conserver le lien guide d'achat en fin s'il existe (`<p class="mt-4...">`)

**Règle S2_DIAG** : S2_DIAG est CLEAN si c'est du texte pollué. Il est PROTECTED uniquement si c'est un tableau diagnostique structuré (`<table>`, `<details>`). Vérifier le format avant de décider.

### REPLACE — Remplacer entièrement
`S4_DEPOSE` (quand 100% scrapé)

Le contenu est entièrement composé de paragraphes de blog numérotés (`<b>1.</b> ## Titre scrapé...`). Aucune instruction de démontage réelle. Remplacer par des étapes propres au format :

```html
<b>1.</b> Étape 1.<br>
<b>2.</b> Étape 2.<br>
...
```

Les étapes de remplacement doivent être :
- Spécifiques à la pièce (pas génériques)
- 5 à 8 étapes maximum
- Commencer par sécurité (débrancher batterie, lever véhicule)
- Finir par le nettoyage du support

## Workflow de nettoyage

### Étape 1 : Récupérer le contenu

```sql
SELECT sgc_pg_id, sgc_section_type, LENGTH(sgc_content) as len, sgc_content
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}'
```

### Étape 2 : Analyser et proposer

Montrer à l'utilisateur :
- Le contenu actuel (ou un aperçu si > 500 chars)
- Le point de coupure identifié
- Le contenu nettoyé proposé
- Action : CLEAN (couper) ou REPLACE (remplacer)

### Étape 3 : Exécuter après validation

**3a — ROLLBACK LOG (obligatoire avant tout UPDATE)** : Sauvegarder l'ancien contenu dans le rapport de sortie.
```sql
SELECT sgc_pg_id, sgc_section_type, sgc_enriched_by,
  LENGTH(sgc_content) as old_len,
  LEFT(sgc_content, 500) as old_content_backup
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}';
```
Inclure `old_content_backup` dans le rapport. C'est le seul moyen de restaurer si le nettoyage dégrade.

**3b — UPDATE** :
```sql
UPDATE "__seo_gamme_conseil"
SET sgc_content = '{contenu_nettoyé}',
    sgc_enriched_by = 'pipeline-v5-surgical-clean'  -- ou 'pipeline-v5-replace'
WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}';
```

**Attention SQL** :
- `sgc_pg_id` est TEXT -> utiliser des quotes : `WHERE sgc_pg_id = '82'`
- Échapper les apostrophes : `l'étrier` -> `l''étrier`
- Pas de colonne `sgc_updated_at` (elle n'existe pas)

### Étape 4 : Vérifier

```sql
SELECT sgc_pg_id, sgc_section_type, LENGTH(sgc_content) as new_len, sgc_enriched_by
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}'
```

## Tags de traçabilité

| Action | Tag `sgc_enriched_by` |
|--------|----------------------|
| Pollution retirée, contenu propre conservé | `pipeline-v5-surgical-clean` |
| Contenu 100% remplacé | `pipeline-v5-replace` |

## Exemples de nettoyages réussis

Lire `references/cleaning-history.md` pour les 28 nettoyages effectués le 2026-03-29, avec avant/après pour chaque section.

## Rapport de sortie

Après chaque batch de nettoyage, produire :

| pg_id | Section | Action | Avant (chars) | Après (chars) | Tag |
|-------|---------|--------|---------------|---------------|-----|

Et le coverage manifest obligatoire (voir agent-exit-contract.md).
