COPY (SELECT piece_id, piece_ref, piece_pm_id, piece_pg_id, piece_display, piece_name, piece_des, piece_update, piece_sort FROM public.pieces ORDER BY 1) TO STDOUT WITH CSV;
COPY (SELECT * FROM public.pieces_price ORDER BY pri_piece_id, pri_type) TO STDOUT WITH CSV;
