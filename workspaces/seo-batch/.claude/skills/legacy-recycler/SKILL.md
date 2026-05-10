---
name: legacy-recycler
description: "Recycle contenu legacy (__blog_advice*) vers __seo_gamme_conseil v5. Use when user mentions recycler legacy, injecter contenu expert, enrichir depuis CSV, importer blog advice. À utiliser après pollution-scanner."
---

# Legacy Recycler — Recyclage de contenu expert hérité

## Principe fondamental

**Ne JAMAIS écrire en DB sans validation humaine.** Proposer le mapping, montrer avant/après, attendre "ok" ou "je valide", puis exécuter.

## Sources de données legacy

### Structure des tables legacy

Le contenu CMS hérité est réparti sur 3 tables :

- **`__blog_advice`** — Article principal (colonnes préfixées `ba_`)
- **`__blog_advice_h2`** — Sections H2 de l'article (préfixe `ba2_`)
- **`__blog_advice_h3`** — Sous-sections H3 (préfixe `ba3_`, liées via `ba3_ba2_id`)

### Source principale : `__blog_advice`

```sql
SELECT ba_id, ba_pg_id, ba_title, ba_h1, LENGTH(ba_content) as len,
  ba_content_type, ba_difficulty, ba_time_minutes
FROM "__blog_advice"
WHERE ba_pg_id IS NOT NULL
ORDER BY LENGTH(ba_content) DESC;
```

### Source riche : sections H2 + H3

Le vrai contenu expert est dans les H2/H3, pas dans `ba_content` (souvent juste une intro courte).

```sql
-- H2 d'un article
SELECT ba2_id, ba2_h2, LENGTH(ba2_content) as len, LEFT(ba2_content, 300) as preview
FROM "__blog_advice_h2"
WHERE ba2_ba_id = '{ba_id}'
ORDER BY ba2_id;

-- H3 d'un H2
SELECT ba3_id, ba3_h3, LENGTH(ba3_content) as len
FROM "__blog_advice_h3"
WHERE ba3_ba2_id = '{ba2_id}'
ORDER BY ba3_id;
```

### Cross-refs gamme

Rapprochement par `ba_pg_id` ou par nom de gamme/slug :

```sql
SELECT ba.ba_id, ba.ba_title, ba.ba_pg_id, pg.pg_nom,
  (SELECT COUNT(*) FROM "__blog_advice_h2" h2 WHERE h2.ba2_ba_id = ba.ba_id) as h2_count
FROM "__blog_advice" ba
LEFT JOIN "__piece_gamme" pg ON pg.pg_id::text = ba.ba_pg_id
WHERE ba.ba_content IS NOT NULL
ORDER BY LENGTH(ba.ba_content) DESC;
```

## Base de données

- **Projet Supabase** : `cxpojprgwgubzjyqzmoq`
- **Table cible** : `__seo_gamme_conseil`
- **Tables source** : `__blog_advice`, `__blog_advice_h2`, `__blog_advice_h3`
- **Outil** : `mcp__claude_ai_Supabase__execute_sql`

## Pipeline de recyclage (4 étapes)

### Étape 1 : `cleanCmsHtml()` — Nettoyage HTML hérité

Le contenu CMS legacy contient du HTML sale :

```
Patterns à nettoyer :
- style="..." inline           -> supprimer
- &nbsp; &amp; &eacute;       -> convertir en UTF-8
- <font ...>                   -> supprimer la balise, garder le texte
- <span style="...">          -> supprimer la balise, garder le texte
- class="MsoNormal"           -> supprimer l'attribut
- <div> imbriqués vides       -> supprimer
- <br><br><br>+               -> réduire à <br><br>
- <!-- commentaires -->        -> supprimer
```

**Règle** : Garder la structure sémantique (`<b>`, `<ul>`, `<li>`, `<p>`, `<h3>`) mais retirer tout le formatage cosmétique.

### Étape 2 : `splitIntoSections()` — Découpage en sections typées

Le contenu legacy est un flux HTML continu. Le découper en blocs thématiques :

| Pattern détecté | Section v5 cible |
|-----------------|------------------|
| "À quoi sert", "Rôle du/de la", "fonction" | S1 (fonction) |
| "Quand changer", "Quand remplacer", "signes d'usure", "symptômes" | S2 (quand changer) |
| "Comment choisir", "critères", "quel(le)... choisir" | S3 (comment choisir) |
| "Comment démonter", "étapes", "dépose", "remplacement" | S4_DEPOSE (démontage) |
| "Erreurs à éviter", "pièges", "ne pas faire" | S5 (erreurs) |
| "Comment vérifier", "contrôle", "diagnostic" | S6 (vérifications) |

**Heuristiques de découpage** :
1. Chercher les `<h2>`, `<h3>`, `<b>` en début de paragraphe comme marqueurs de section
2. Si pas de marqueurs clairs, utiliser l'analyse sémantique du contenu
3. Un bloc peut mapper vers plusieurs sections si le contenu est riche

### Étape 3 : `scoreLegacyQuality()` — Score de qualité 0-100

Chaque bloc extrait reçoit un score basé sur :

| Critère | Points | Description |
|---------|--------|-------------|
| Longueur | 0-20 | <100 chars = 0, 100-300 = 10, 300-800 = 15, >800 = 20 |
| Spécificité pièce | 0-25 | Mentionne la pièce par nom + détails techniques spécifiques |
| Structure | 0-15 | Listes à puces, étapes numérotées, sous-titres |
| Absence pollution | 0-15 | Pas de marketing, pas de scraping, pas de contenu générique |
| Valeur ajoutée | 0-15 | Conseils pratiques, avertissements, cas particuliers |
| Français correct | 0-10 | Pas de mots étrangers, pas de fragments incomplets |

**Seuils de décision** :

| Score | Verdict | Action |
|-------|---------|--------|
| >= 70 | WRITE | Proposer l'injection dans la section v5 |
| 40-69 | REVIEW | Montrer à l'humain pour décision manuelle |
| < 40 | BLOCK | Ne pas utiliser, trop faible/générique |

### Étape 4 : `mapToV5Sections()` — Injection dans __seo_gamme_conseil

Pour chaque bloc scoré WRITE ou REVIEW validé :

1. **Vérifier l'existant** : la section v5 cible a-t-elle déjà du contenu ?
   ```sql
   SELECT sgc_content, LENGTH(sgc_content) as len, sgc_enriched_by
   FROM "__seo_gamme_conseil"
   WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}'
   ```

2. **Décision** :
   - Section vide ou très courte (<100 chars) -> REMPLACER
   - Section existante faible (<300 chars, générique) -> ENRICHIR (ajouter en début/fin)
   - Section existante bonne (>300 chars, propre) -> NE PAS TOUCHER (sauf si legacy très supérieur)

3. **ROLLBACK LOG (obligatoire avant tout UPDATE)** : Sauvegarder l'ancien contenu.
   ```sql
   SELECT sgc_pg_id, sgc_section_type, sgc_enriched_by,
     LENGTH(sgc_content) as old_len,
     LEFT(sgc_content, 500) as old_content_backup
   FROM "__seo_gamme_conseil"
   WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}';
   ```
   Inclure `old_content_backup` dans le rapport de sortie.

4. **Exécuter** (après validation humaine) :
   ```sql
   UPDATE "__seo_gamme_conseil"
   SET sgc_content = '{contenu_legacy_nettoyé}',
       sgc_enriched_by = 'pipeline-v5-legacy-recycle'
   WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{type}';
   ```

## Attention SQL

- `sgc_pg_id` est TEXT -> utiliser des quotes : `WHERE sgc_pg_id = '82'`
- Échapper les apostrophes : `l'étrier` -> `l''étrier`
- Pas de colonne `sgc_updated_at` (elle n'existe pas)
- `pgid` dans `__BLOG_ADVICE_OLD` peut être NULL pour certains articles

## Tags de traçabilité

| Action | Tag `sgc_enriched_by` |
|--------|----------------------|
| Contenu legacy injecté (remplacement total) | `pipeline-v5-legacy-recycle` |
| Contenu legacy ajouté (enrichissement partiel) | `pipeline-v5-legacy-enrich` |

## Workflow complet d'utilisation

1. **Scanner** d'abord avec `pollution-scanner` pour identifier les sections faibles/vides
2. **Lister** les articles legacy disponibles pour la gamme ciblée
3. **Nettoyer** le HTML legacy (`cleanCmsHtml`)
4. **Découper** en sections (`splitIntoSections`)
5. **Scorer** chaque bloc (`scoreLegacyQuality`)
6. **Montrer** à l'utilisateur : bloc legacy proposé vs contenu actuel
7. **Attendre** validation humaine explicite
8. **Exécuter** l'UPDATE si validé
9. **Vérifier** le résultat (re-query + scoring)

## Rapport de sortie

Après chaque batch de recyclage, produire :

| pg_id | Section | Source legacy | Score | Verdict | Action | Avant (chars) | Après (chars) |
|-------|---------|---------------|-------|---------|--------|---------------|---------------|

Et le coverage manifest obligatoire (voir agent-exit-contract.md).
