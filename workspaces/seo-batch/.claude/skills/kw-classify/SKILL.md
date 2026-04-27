---
name: kw-classify
description: "Classification contextuelle par Claude des keywords bruts Google Ads KP. Lit __seo_keywords → classifie par role R1/R3/R4/R6 → écrit dans __seo_keyword_results avec vol percentile. Usage : /kw-classify <pg_alias> [--role r1|r3|r4|r6|all] [--dry-run]"
argument-hint: "<pg_alias> [--role r1|r3|r4|r6|all] [--dry-run]"
allowed-tools: Read, mcp__supabase__execute_sql, Glob
---

# KW Classifier — Skill /kw-classify v1.0

## Principe

Les KW Google Ads KP sont importés bruts dans `__seo_keywords` par `scripts/seo/import-gads-kp.py`.
Ce skill classifie contextuellement chaque KW dans `R1/R3/R4/R6` ou l'exclut (pollution sémantique).

**Pourquoi skills-first :**
- Regex = faux positifs ("filtre à huile hydraulique" classé R1 alors que c'est industriel)
- Claude comprend le sens du KW + le contexte gamme (RAG) = classification de qualité
- 1 run par gamme (post-import) → pré-classifie pour `/content-gen` → zéro charge répétée

## Usage

```
/kw-classify filtre-a-huile              # Classifie tous les rôles
/kw-classify filtre-a-huile --role r1    # R1 uniquement
/kw-classify filtre-a-huile --dry-run    # Preview sans écriture DB
```

## Projet Supabase
`cxpojprgwgubzjyqzmoq`

---

## Procédure

### Étape 1 — Résoudre la gamme

```sql
SELECT pg_id, pg_alias, pg_name FROM pieces_gamme WHERE pg_alias = '{input}';
```

Lire aussi le RAG frontmatter pour connaître le contexte :
```
Read /opt/automecanik/rag/knowledge/gammes/{pg_alias}.md
```

Parser `domain.role`, `domain.must_not_contain`, `domain.confusion_with`, `variants[].aliases`.

### Étape 2 — Vérifier qu'il y a des KW à classifier

```sql
SELECT COUNT(*) FROM __seo_keywords
WHERE pg_id = {pg_id} AND source = 'google-ads-kp';
```

Si 0 → `STOP. Lancer d'abord l'import : python3 scripts/seo/import-gads-kp.py`.

### Étape 3 — Charger les KW par tranche de volume

Pour gérer le volume sans saturer le contexte, charger en 3 passes :

**Pass 1 — Strategic (volume >= 500)** : ~50-100 KW, classification la plus importante (vont en H1/H2).

```sql
SELECT keyword, volume, competition_idx
FROM __seo_keywords
WHERE pg_id = {pg_id} AND source = 'google-ads-kp' AND volume >= 500
ORDER BY volume DESC, keyword;
```

**Pass 2 — Mid-tail (100 <= volume < 500)** : ~100-300 KW, classification standard (body text + FAQ).

```sql
SELECT keyword, volume FROM __seo_keywords
WHERE pg_id = {pg_id} AND source = 'google-ads-kp' AND volume >= 100 AND volume < 500
ORDER BY volume DESC, keyword LIMIT 300;
```

**Pass 3 — Long tail (volume < 100)** : ~500-1500 KW, classification rapide (variantes naturelles).

```sql
SELECT keyword, volume FROM __seo_keywords
WHERE pg_id = {pg_id} AND source = 'google-ads-kp' AND volume < 100
ORDER BY volume DESC, keyword;
```

Pour long tail, charger par chunks de 500 si > 500 rows. Si réponse > 100KB, réduire le chunk.

### Étape 4 — Règles de classification (Claude applique)

Pour chaque KW, appliquer les règles dans cet ordre **STRICT de priorité** :

#### 4.1 — EXCLUSION (pollution sémantique)
Exclure si le KW :
- Est un **outil** de la gamme, pas la pièce (ex: "cloche filtre a huile", "clé à sangle", "pince circlip")
- Est **hors contexte auto** (ex: "filtre huile hydraulique" = industriel, "briggs stratton" = tondeuse)
- Est **un autre produit confondu** (cf. `domain.confusion_with` du RAG)
- Contient un mot de `domain.must_not_contain` non détecté par le filtre Python
- Est **trop générique** sans lien clair ("filtres voiture" pour filtre-à-huile = ambigu)

#### 4.2 — Priorité des intents (si KW matche plusieurs)
1. **`prix` gagne TOUJOURS** → R1 transactional
   - "prix vidange filtre huile" → R1 (pas R3, car prix est l'intent primaire)
   - "filtre à huile prix" → R1
2. **Marque + gamme** → R6 investigation
   - "bosch filtre à huile", "purflux filtre huile" → R6
   - Marques reconnues : purflux, mann, mahle, bosch, hengst, filtron, sachs, lemforder, delphi, febi, valeo, luk
3. **Comment/tuto/vidange pur (sans prix)** → R3 how_to
   - "comment changer filtre à huile" → R3
   - "vidange filtre à huile" → R3 (si sans "prix")
4. **Informationnel (c'est quoi, rôle)** → R4
   - "c'est quoi un filtre à huile", "à quoi sert filtre huile" → R4
5. **Sinon** → R1 par défaut (transactional)

#### 4.3 — Intent par rôle

| Role | Intent(s) |
|------|----------|
| R1 | `transactional` (achat), `navigational` (store: norauto, oscaro, feu vert) |
| R3 | `how_to`, `informational` (pour les cas "quand changer") |
| R4 | `informational` |
| R6 | `investigation`, `commercial` |

### Étape 5 — Assignation vol par percentile (par rôle)

Après avoir classifié TOUS les KW, pour chaque rôle :
1. Trier les KW du rôle par volume desc
2. HIGH = top 10% (minimum 1 KW)
3. MED = 10-40% suivants
4. LOW = 60% restants

**Adaptatif par taille :**
- Si le rôle a **< 10 KW** : top 20% HIGH, next 40% MED, rest LOW
- Si le rôle a **< 5 KW** : top 1 KW = HIGH, rest = MED
- Si le rôle a **1-2 KW** : tous en MED (trop peu pour HIGH)

### Étape 6 — Écriture en DB

**Si `--dry-run` :** afficher le tableau de classification sans écrire.

**Sinon :** UPSERT batch dans `__seo_keyword_results`.

```sql
INSERT INTO __seo_keyword_results (pg_id, pg_alias, role, kw, intent, vol, source)
VALUES
  ({pg_id}, '{pg_alias}', 'R1', 'filtre à huile', 'transactional', 'HIGH', 'google-ads-kp'),
  ({pg_id}, '{pg_alias}', 'R1', 'filtre huile', 'transactional', 'HIGH', 'google-ads-kp'),
  -- ... tous les KW
ON CONFLICT (pg_id, kw, role) DO UPDATE SET
  vol = EXCLUDED.vol,
  intent = EXCLUDED.intent,
  source = EXCLUDED.source;
```

Batch par 100 rows pour éviter les requêtes SQL trop larges.

### Étape 7 — Rapport

```
## KW Classification — {pg_name} (pg_id={pg_id})

| Role | HIGH | MED | LOW | Total |
|------|------|-----|-----|-------|
| R1   |   10 |  22 |  45 |    77 |
| R3   |    1 |   2 |   1 |     4 |
| R4   |    1 |   1 |   0 |     2 |
| R6   |    2 |   3 |   3 |     8 |
| **Exclus** | | | | **372** |
| **Total** | 14 | 28 | 49 | **463** |

Raisons d'exclusion :
- Outil : 5 KW (cloche, clé à sangle, pince)
- Industriel : 12 KW (hydraulique, briggs stratton, tracteur)
- Confusion : 8 KW (filtre à air, filtre à carburant)
- must_not_contain : 347 KW (climatisation, universel, accessoires...)

Prochaine étape : /content-gen {pg_alias} --all
```

---

## Règles

1. **Ne jamais classifier sans lire le RAG** — les `must_not_contain` et `confusion_with` sont gamme-spécifiques.
2. **Prix > tout** — la règle de priorité 4.2 est absolue.
3. **Exclure > classifier faussement** — mieux vaut moins de KW que des KW polluants.
4. **Percentile adaptatif** — les petits rôles (R3/R4) doivent avoir au moins 1 HIGH.
5. **Idempotent** — ON CONFLICT permet de relancer sans créer de doublons.
6. **Dry-run obligatoire au premier run** d'une nouvelle gamme.
7. **Après classification → invalider cache Redis** :
   ```bash
   redis-cli DEL kw-results:{pg_id}:*
   ```

---

## Architecture skills-first

```
1. Toi : Chrome → export Google Ads KP CSV
2. VPS : python3 scripts/seo/import-gads-kp.py {csv}
     → __seo_keywords (raw, sans role)
3. Claude Code : /kw-classify {gamme}
     → __seo_keyword_results (classifié par role, vol percentile)
4. Claude Code : /content-gen {gamme} --all
     → lit __seo_keyword_results pré-classifié
     → génère contenu R1/R3/R4/R6 + images
     → écrit en DB
```

Chaque étape est idempotente et découplée.
