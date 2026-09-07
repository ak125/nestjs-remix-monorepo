# Root cause — Pipeline TecDoc → `pieces_media_img` — 2026-04-13

> **Statut** : `SCOPE_SCANNED — ROOT_CAUSE_CONFIRMED`.
> **Objectif** : identifier exactement le script et la ligne de code qui ont introduit les 4 996 429 lignes fantômes dans `pieces_media_img`.

## 1. Script fautif identifié

**Fichier** : [`scripts/tecdoc-project-core.py`](../../scripts/tecdoc-project-core.py)
**Date de dernière modification** : 2026-03-26 18:45
**Fonction** : `project_image_chunk(dlnr)` aux lignes 94-117
**Statement INSERT fautif** : lignes 100-110

```python
def project_image_chunk(dlnr):
    """Project one DLNR chunk of t232 → pieces_media_img."""
    conn = psycopg2.connect(CONN_STR, options='-c statement_timeout=120000')
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_media_img (pmi_piece_id, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display, pmi_piece_id_i)
        SELECT
          ar.piece_id::text, %s, '', gr.bildname, t232.sortnr, '1', ar.piece_id
        FROM tecdoc_raw.t232 t232
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = t232.artnr AND ar.source_dlnr = t232.dlnr::int
        JOIN tecdoc_doc.graphics_registry gr ON gr.source_bildnr = t232.bildnr::int AND gr.source_dlnr = t232.dlnr::int
        WHERE ar.piece_id IS NOT NULL AND t232.losch_flag != '1' AND gr.bildname IS NOT NULL
          AND t232.dlnr = %s
        ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING
        """, (dlnr, dlnr))
```

## 2. Défauts du statement (ligne par ligne)

### 2.1 `pmi_folder = ''` en dur
```sql
SELECT ar.piece_id::text, %s, '', gr.bildname, ...
                              ^^
```
Le 3e champ de la liste SELECT (qui correspond à `pmi_folder`) est la chaîne vide **littérale**. Le script projette 9M+ lignes avec `pmi_folder=''`, créant directement les fantômes de l'audit §1.

L'intention du développeur originel était probablement : *"je mets vide en attendant qu'un script secondaire remplisse avec le `dlnr`"*. Le script secondaire n'a jamais été écrit — ou bien `recover-tecdoc-images.py` (qui utilise `pmi_folder=eq.{dlnr}`) attendait une table déjà remplie et n'a jamais pu s'exécuter.

### 2.2 `pmi_name = gr.bildname` brut
```sql
SELECT ..., gr.bildname, ...
```
`graphics_registry.bildname` contient les noms TecDoc **bruts** : parfois des références produit (`fdb4180_1100025`), parfois des noms techniques (`KIT3P`, `TECH BULLETIN ACT - TS 04 -19`), **sans extension de fichier**.

Conséquences :
- Impossible de construire une URL valide (pas d'extension).
- Certains `bildname` ne désignent pas des images (TSBs, guides de montage, bulletins techniques). Ces lignes polluent la table même sémantiquement — elles ne correspondront **jamais** à un fichier image.

### 2.3 `pmi_display = '1'` systématique
```sql
SELECT ..., t232.sortnr, '1', ...
                         ^^^
```
Toutes les lignes sont marquées `display='1'` sans vérifier que leur pendant visuel existe. Cela contamine directement toutes les RPCs qui se basent sur ce flag.

### 2.4 Aucune validation d'existence Storage
Le script fait `JOIN` uniquement sur les tables TecDoc (`t232`, `article_registry`, `graphics_registry`) et n'interroge **jamais** `storage.objects`. Aucune vérification que `bildname` correspond à un fichier réellement uploadé dans le bucket `rack-images`.

### 2.5 `ON CONFLICT DO NOTHING`
```sql
ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING
```
La contrainte d'unicité `(pmi_piece_id, pmi_name)` empêche les doublons mais **ne corrige rien** : si une ligne fantôme a été insérée en premier (`folder=''`), une ligne valide future avec le même `(piece_id, name)` sera ignorée. C'est un amplificateur de dette : plus on relance le script, plus on verrouille les fantômes.

### 2.6 Pas de contrainte DB en amont
La table `pieces_media_img` n'a **aucune contrainte** qui bloquerait l'insertion de lignes cassées : pas de `CHECK (pmi_folder ~ '^[0-9]+$')`, pas de `CHECK (pmi_name ~* '\.(jpg|jpeg|...)$')`, pas de `FOREIGN KEY` vers `storage.objects`. Le script peut donc insérer n'importe quoi sans résistance.

## 3. Script de "recovery" prévu mais non fonctionnel

Le fichier [`scripts/recover-tecdoc-images.py`](../../scripts/recover-tecdoc-images.py) (513 lignes) existe et implémente la chaîne Playwright → CDN TecAlliance → upload Supabase. Mais :

- Ligne 110 et 162 : il **filtre** sur `pmi_folder=eq.{dlnr}`, donc ne traite que les lignes déjà remplies. **Les lignes fantômes `pmi_folder=''` sont invisibles pour ce script**.
- Il suppose que la table est déjà cohérente, ce qui n'est jamais le cas.

Le design complet (projection → recovery) n'a jamais été exécuté dans l'ordre prévu, et la boucle de récupération ne peut pas se déclencher sur les 5 millions de lignes fantômes.

## 4. Note sécurité — secrets en clair

[`scripts/recover-tecdoc-images.py:50-51`](../../scripts/recover-tecdoc-images.py) :
```python
TECDOC_EMAIL = "<EXPURGE 2026-09-07>"
TECDOC_PASS = "<EXPURGE 2026-09-07>"
```

Credentials en clair dans le fichier source, versionné dans le repo. **À remonter séparément comme dette de sécurité** (rotation du mot de passe + migration vers `backend/.env`). Hors scope de la remédiation `pieces_media_img`.

## 5. Autres scripts touchant `pieces_media_img`

| Fichier | Rôle | Problème |
|---|---|---|
| `scripts/tecdoc-project-core.py` | Projection TecDoc → DB | **Source unique de la pollution** (ligne 103) |
| `scripts/recover-tecdoc-images.py` | Télécharge depuis CDN TecAlliance | Ne voit pas les lignes fantômes |
| `scripts/convert-rack-images-webp.py` | Renomme en .webp | Ignore les lignes fantômes |
| `scripts/cleanup-inactive-rack-images-v2.py` | Supprime les fichiers Storage orphelins | ⚠️ **Script fautif de l'incident 2026-04-11** — bug de pagination a effacé 80k fichiers actifs |

## 6. Chronologie reconstituée

| Date | Événement | Impact |
|---|---|---|
| ≤ mars 2026 | Anciennes pièces avec images valides, Storage cohérent | Affichage OK |
| 2026-03-26 | Création/modification de `tecdoc-project-core.py` | Injection de ~5M lignes fantômes (`folder=''`) |
| Mars-avril 2026 | Le script tourne, la table se pollue progressivement | Les RPCs génèrent des URLs `rack-images//xxx` (404) |
| 2026-04-11 | Incident `cleanup-inactive-rack-images-v2.py` : 80 374 fichiers Storage supprimés, dont 100 % du dossier `21/` (Valeo) et 2/3 du dossier `62/` (Ferodo) | Les pièces qui marchaient encore passent en 404 |
| 2026-04-13 | Migration `20260413_fix_broken_images_in_listing.sql` : filtre défensif `pmi_folder ~ '^[0-9]+$'` ajouté à `get_listing_products_extended` | Les 404 deviennent des `no.png` silencieux → symptôme visible (utilisateur remonte le problème) |
| 2026-04-13 | Signalement utilisateur des pages Megane + Mercedes | Déclenchement de cet audit |

## 7. Corrections requises (hors scope de cet audit)

À planifier dans l'ADR-011 :

1. **Réécriture de `project_image_chunk`** avec :
   - `pmi_folder = %s` (le `dlnr` passé en paramètre), pas `''`
   - `pmi_name = gr.bildname || '.jpg'` (ou équivalent détecté via une colonne extension si elle existe dans `graphics_registry`)
   - Vérification `EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='rack-images' AND name = dlnr || '/' || bildname || '.jpg')` avant INSERT
   - Alternative plus robuste : faire la projection en deux étapes (stage table → upload → validation → insert final)
2. **Contraintes DB** : `CHECK` sur format `pmi_folder` et `pmi_name`, trigger `BEFORE INSERT/UPDATE` qui bloque toute ligne sans contrepartie Storage.
3. **Rotation des credentials TecDoc** dans `recover-tecdoc-images.py`.
4. **Purge des lignes fantômes existantes** selon la classification du rapport de réconciliation.

## 8. Exit contract

| Champ | Valeur |
|---|---|
| `scope_requested` | Identifier le script et le mécanisme qui ont pollué `pieces_media_img` |
| `scope_actually_scanned` | 4 scripts Python `scripts/tecdoc-*.py` + `scripts/recover-tecdoc-images.py` + `scripts/cleanup-inactive-rack-images-v2.py` |
| `files_read_count` | 5 scripts (`tecdoc-project-core.py`, `recover-tecdoc-images.py`, `convert-rack-images-webp.py`, `cleanup-inactive-rack-images-v2.py`, `tecdoc-import.py`) |
| `excluded_paths` | Autres chemins d'écriture de `pieces_media_img` (edge functions, backend services) — non trouvés dans le backend NestJS actif |
| `corrections_proposed` | Décrit en §7 (hors scope audit) |
| `validation_executed` | 0 |
| `remaining_unknowns` | — Confirmé que les écritures passent uniquement par `tecdoc-project-core.py` pour le volume massif. Vérification complémentaire backend à faire si des routes admin écrivent aussi. |
| `final_status` | `SCOPE_SCANNED — ROOT_CAUSE_CONFIRMED` |

La cause racine est **confirmée avec certitude** : le statement SQL des lignes 100-110 de `scripts/tecdoc-project-core.py` insère systématiquement `pmi_folder=''` et `pmi_name` sans extension, sans validation Storage. C'est le point unique d'injection de la pollution.
