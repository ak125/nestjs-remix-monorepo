COPY (SELECT piece_id, search_vector IS NULL AS sv_null FROM public.pieces ORDER BY 1) TO STDOUT WITH CSV;
