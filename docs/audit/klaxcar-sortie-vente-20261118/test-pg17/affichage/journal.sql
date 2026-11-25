COPY (SELECT id, batch_id, piece_id, pm_id, old_display, new_display, operator FROM public.pieces_display_history ORDER BY id) TO STDOUT WITH CSV;
