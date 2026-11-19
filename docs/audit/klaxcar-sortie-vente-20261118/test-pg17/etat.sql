\pset footer off
COPY (SELECT * FROM public.pieces_price ORDER BY pri_piece_id, pri_type) TO STDOUT WITH CSV;
