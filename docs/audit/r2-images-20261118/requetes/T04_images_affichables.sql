-- T04 : images affichables (pmi_display='1') des pièces vendables, rang = ordre pmi_sort (rang 1 = image de couverture).
-- Exécuté par lots de piece_id (:ids), STATEMENT_TIMEOUT_MS=58000, lecture seule.
\copy (select pmi_piece_id, pmi_pm_id, coalesce(pmi_folder,''), pmi_name, pmi_sort, row_number() over (partition by pmi_piece_id order by pmi_sort) from pieces_media_img where pmi_piece_id = any(:'ids'::text[]) and pmi_display='1') to '<DIR>/data/img/<lot>.csv' csv
