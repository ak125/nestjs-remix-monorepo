-- scripts/recover-tecdoc-images.sql
--
-- Inventaire des images manquantes du lot VENDABLE, pour un lot de pièces
-- (piece_id dans [%(id_min)s, %(id_max)s[). Requête UNIQUE, lue telle quelle par :
--   - scripts/recover-tecdoc-images.py (sélection de l'import, rapport à blanc) ;
--   - le contrôle « pièce sans image » de la décision 49 (même fichier, voir
--     .claude/knowledge/ops/supplier-brand-price-load-procedure.md).
--
-- Vendable : AUCUNE condition recopiée ici. Le seul appel à la définition est
-- `public.piece_est_vendable(piece_id)`, fonction SQL unique créée par la PR
-- #2191 (mandat CT, migration 20261118_est_vendable_definition_unique.sql,
-- miroir de backend/src/database/services/vendable.ts). Tant que cette
-- migration n'est pas appliquée, la requête échoue (fonction inconnue) et le
-- script s'arrête avec le code 2 : pas de repli sur une copie des conditions.
-- scripts/test_recover_tecdoc_images.py vérifie que ce fichier ne recopie pas
-- la définition.
--
-- Sortie : une ligne par image affichable (pmi_display='1') dont l'objet
-- `rack-images/<pmi_folder>/<pmi_name>` est absent, et une ligne par pièce
-- vendable sans aucune image affichable (classe 'sans_image_affichable').
--   piece_id, pm_id, piece_ref, images_affichables, images_presentes, classe,
--   pmi_folder, pmi_name
-- « Pièce vendable sans image servie » = images_presentes = 0.
--
-- Lecture seule. Paramètres au format psycopg2 (%(nom)s).
WITH vendable AS (
  SELECT p.piece_id, p.piece_pm_id, p.piece_ref
    FROM pieces p
   WHERE p.piece_id >= %(id_min)s
     AND p.piece_id <  %(id_max)s
     AND public.piece_est_vendable(p.piece_id)
),
images AS (
  SELECT v.piece_id, m.pmi_folder, m.pmi_name,
         EXISTS (
           SELECT 1
             FROM storage.objects o
            WHERE o.bucket_id = 'rack-images'
              AND o.name = (m.pmi_folder || '/' || m.pmi_name) COLLATE "C"
         ) AS presente
    FROM vendable v
    JOIN pieces_media_img m
      ON m.pmi_piece_id_i = v.piece_id
     AND m.pmi_display = '1'
),
par_piece AS (
  SELECT v.piece_id,
         count(i.piece_id)                       AS images_affichables,
         count(*) FILTER (WHERE i.presente)      AS images_presentes
    FROM vendable v
    LEFT JOIN images i ON i.piece_id = v.piece_id
   GROUP BY v.piece_id
)
SELECT v.piece_id,
       v.piece_pm_id                             AS pm_id,
       v.piece_ref,
       pp.images_affichables,
       pp.images_presentes,
       CASE WHEN i.piece_id IS NULL THEN 'sans_image_affichable'
            ELSE 'image_absente' END             AS classe,
       i.pmi_folder,
       i.pmi_name
  FROM vendable v
  JOIN par_piece pp ON pp.piece_id = v.piece_id
  LEFT JOIN images i ON i.piece_id = v.piece_id AND NOT i.presente
 WHERE pp.images_affichables = 0
    OR i.piece_id IS NOT NULL
 ORDER BY v.piece_id, i.pmi_folder, i.pmi_name;
