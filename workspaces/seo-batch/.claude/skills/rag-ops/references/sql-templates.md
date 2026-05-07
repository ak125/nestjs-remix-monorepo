# SQL Templates — MCP Supabase

Requetes pretes a executer via `mcp__supabase__execute_sql` (project: `cxpojprgwgubzjyqzmoq`).

> **REGLE :** JAMAIS `psql` via Bash. Toujours MCP Supabase.

---

## Corpus Overview

### Distribution par truth level
```sql
SELECT truth_level, COUNT(*) AS total,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
FROM __rag_knowledge
GROUP BY truth_level
ORDER BY truth_level;
```

### Distribution par domaine
```sql
SELECT domain, COUNT(*) AS total
FROM __rag_knowledge
GROUP BY domain
ORDER BY total DESC;
```

### Matrice domaine x truth level
```sql
SELECT domain, truth_level, COUNT(*) AS total
FROM __rag_knowledge
GROUP BY domain, truth_level
ORDER BY domain, truth_level;
```

### Total documents
```sql
SELECT COUNT(*) AS total_docs,
       COUNT(DISTINCT domain) AS domains,
       COUNT(DISTINCT category) AS categories
FROM __rag_knowledge;
```

---

## Recherche de Documents

### Full-text search (FTS francais)
```sql
SELECT id, title, domain, truth_level,
       ts_rank(content_tsv, query) AS rank
FROM __rag_knowledge,
     plainto_tsquery('french', 'disque frein') AS query
WHERE content_tsv @@ query
ORDER BY rank DESC
LIMIT 20;
```

### Documents recents par domaine
```sql
SELECT id, title, truth_level, category, created_at
FROM __rag_knowledge
WHERE domain = 'gammes'
ORDER BY created_at DESC
LIMIT 20;
```

### Documents par categorie
```sql
SELECT id, title, domain, truth_level, created_at
FROM __rag_knowledge
WHERE category = 'freinage'
ORDER BY truth_level, created_at DESC;
```

### Documents L4 (a surveiller)
```sql
SELECT id, title, domain, category, created_at
FROM __rag_knowledge
WHERE truth_level = 'L4'
ORDER BY created_at DESC;
```

---

## Audit Qualite

### Documents sans domaine ou categorie
```sql
SELECT id, title, truth_level, created_at
FROM __rag_knowledge
WHERE domain IS NULL OR domain = ''
   OR category IS NULL OR category = '';
```

### Documents sans contenu FTS
```sql
SELECT id, title, domain
FROM __rag_knowledge
WHERE content_tsv IS NULL;
```

### Doublons potentiels (meme titre)
```sql
SELECT title, COUNT(*) AS duplicates
FROM __rag_knowledge
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;
```

### Documents longs (> 10000 caracteres)
```sql
SELECT id, title, domain, LENGTH(content) AS content_length
FROM __rag_knowledge
WHERE LENGTH(content) > 10000
ORDER BY content_length DESC;
```

---

## RAG-KG Mapping

### Documents sans mapping KG
```sql
SELECT r.id, r.title, r.domain, r.truth_level
FROM __rag_knowledge r
LEFT JOIN kg_rag_mapping m ON r.id::text = m.rag_item_id
WHERE m.mapping_id IS NULL
ORDER BY r.domain, r.title;
```

### Mapping coverage par domaine
```sql
SELECT r.domain,
       COUNT(DISTINCT r.id) AS total_docs,
       COUNT(DISTINCT m.mapping_id) AS mapped_docs,
       ROUND(COUNT(DISTINCT m.mapping_id) * 100.0 / NULLIF(COUNT(DISTINCT r.id), 0), 1) AS coverage_pct
FROM __rag_knowledge r
LEFT JOIN kg_rag_mapping m ON r.id::text = m.rag_item_id
GROUP BY r.domain
ORDER BY coverage_pct;
```

---

## Sync Status

### Derniers syncs
```sql
SELECT sync_id, rag_file_path, rag_category,
       nodes_created, nodes_updated, edges_created,
       errors_count, sync_duration_ms, synced_at
FROM kg_rag_sync_log
ORDER BY synced_at DESC
LIMIT 20;
```

### Sync errors non resolues
```sql
SELECT rag_file_path, rag_category,
       errors_count, errors_detail, synced_at
FROM kg_rag_sync_log
WHERE errors_count > 0
ORDER BY synced_at DESC
LIMIT 20;
```

### Stats agregees par categorie
```sql
SELECT rag_category,
       COUNT(*) AS files_synced,
       SUM(nodes_created) AS total_nodes_created,
       SUM(nodes_updated) AS total_nodes_updated,
       SUM(errors_count) AS total_errors,
       MAX(synced_at) AS last_sync,
       AVG(sync_duration_ms)::int AS avg_duration_ms
FROM kg_rag_sync_log
GROUP BY rag_category
ORDER BY last_sync DESC;
```

---

## Metriques Operationnelles

### Repartition L1+L2 vs L3+L4 (sante corpus)
```sql
SELECT
  CASE WHEN truth_level IN ('L1', 'L2') THEN 'verified' ELSE 'unverified' END AS quality,
  COUNT(*) AS total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
FROM __rag_knowledge
GROUP BY quality;
```

### Domaines avec couverture faible
```sql
SELECT domain, COUNT(*) AS total
FROM __rag_knowledge
GROUP BY domain
HAVING COUNT(*) < 5
ORDER BY total;
```

### Activite recente (7 derniers jours)
```sql
SELECT DATE(created_at) AS jour, COUNT(*) AS nouveaux_docs
FROM __rag_knowledge
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY jour
ORDER BY jour;
```
