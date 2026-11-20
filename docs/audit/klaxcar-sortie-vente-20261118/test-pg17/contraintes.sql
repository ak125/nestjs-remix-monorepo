ALTER TABLE public.pieces ADD CONSTRAINT pieces_pkey PRIMARY KEY (piece_id);
ALTER TABLE public.pieces_marque ADD PRIMARY KEY (pm_id);
ALTER TABLE public.pieces_price ADD CONSTRAINT pieces_price_pkey PRIMARY KEY (pri_piece_id, pri_type);
ALTER TABLE public.pieces_price ADD CONSTRAINT fk_pieces_price_piece_i FOREIGN KEY (pri_piece_id_i) REFERENCES public.pieces(piece_id);
ALTER TABLE public.pieces_price ADD CONSTRAINT pieces_price_pricing_state_check CHECK ((pricing_state = ANY (ARRAY['ACTIVE'::text, 'OUTLIER'::text, 'DEGRADED'::text, 'MANUAL_OVERRIDE'::text, 'SUPPLIER_CONFLICT'::text, 'IMPORT_ERROR'::text, 'FROZEN'::text, 'COMPETITOR_LOCKED'::text])));
CREATE INDEX idx_pieces_pm_id ON public.pieces (piece_pm_id);
CREATE INDEX idx_pieces_price_piece_id_i ON public.pieces_price (pri_piece_id_i);
CREATE INDEX idx_pprice_pm_id ON public.pieces_price (pri_pm_id);
CREATE INDEX idx_pieces_price_pri_dispo ON public.pieces_price (pri_dispo);
