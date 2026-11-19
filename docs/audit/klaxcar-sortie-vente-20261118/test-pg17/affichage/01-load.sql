\set ON_ERROR_STOP 1
\copy public.pieces FROM 'data/pieces.csv' csv header
\copy public.pieces_price FROM 'data/pieces_price.csv' csv header
\copy public.pieces_relation_type FROM 'data/pieces_relation_type.csv' csv header
\copy public.pieces_media_img FROM 'data/pieces_media_img.csv' csv header
\copy public.pieces_criteria FROM 'data/pieces_criteria.csv' csv header
\copy public.pieces_relation_criteria FROM 'data/pieces_relation_criteria.csv' csv header
\copy public.pieces_ref_search FROM 'data/pieces_ref_search.csv' csv header
\copy public.auto_type FROM 'data/auto_type.csv' csv header
\copy public.auto_type_motor_code FROM 'data/auto_type_motor_code.csv' csv header
\copy public.auto_type_number_code FROM 'data/auto_type_number_code.csv' csv header
\copy public.pieces_marque FROM 'data/pieces_marque.csv' csv header
\copy public.pieces_gamme FROM 'data/pieces_gamme.csv' csv header
\copy public.pieces_side_filtre FROM 'data/pieces_side_filtre.csv' csv header
\copy public.pieces_display_history FROM 'data/pieces_display_history.csv' csv header
\copy public.auto_modele FROM 'data/auto_modele.csv' csv header
\copy public.auto_marque FROM 'data/auto_marque.csv' csv header
\copy public.catalog_gamme FROM 'data/catalog_gamme.csv' csv header
\copy public.__seo_gamme_car FROM 'data/__seo_gamme_car.csv' csv header
\copy public.__seo_family_gamme_car_switch FROM 'data/__seo_family_gamme_car_switch.csv' csv header
\copy public.__seo_gamme_car_switch FROM 'data/__seo_gamme_car_switch.csv' csv header
\copy public.__seo_item_switch FROM 'data/__seo_item_switch.csv' csv header
\copy public.pieces_ref_brand FROM 'data/pieces_ref_brand.csv' csv header
\copy _filter.rtp_pollution_ids FROM 'data/rtp_pollution_ids.csv' csv header
-- contraintes et défauts relevés en base (lecture seule, 2026-11-19)
ALTER TABLE public.pieces ADD CONSTRAINT pieces_pkey PRIMARY KEY (piece_id);
ALTER TABLE public.pieces ALTER piece_display SET DEFAULT false;
ALTER TABLE public.pieces_marque ADD PRIMARY KEY (pm_id);
ALTER TABLE public.pieces_price ADD CONSTRAINT pieces_price_pkey PRIMARY KEY (pri_piece_id, pri_type);
ALTER TABLE public.pieces_price ADD CONSTRAINT fk_pieces_price_piece_i FOREIGN KEY (pri_piece_id_i) REFERENCES public.pieces(piece_id);
ALTER TABLE public.pieces_price ALTER pricing_state SET DEFAULT 'ACTIVE';
ALTER TABLE public.pieces_price ADD CONSTRAINT pieces_price_pricing_state_check CHECK ((pricing_state = ANY (ARRAY['ACTIVE'::text, 'OUTLIER'::text, 'DEGRADED'::text, 'MANUAL_OVERRIDE'::text, 'SUPPLIER_CONFLICT'::text, 'IMPORT_ERROR'::text, 'FROZEN'::text, 'COMPETITOR_LOCKED'::text])));
ALTER TABLE public.pieces_display_history ALTER changed_at SET DEFAULT now();
ALTER TABLE public.pieces_display_history ALTER id ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(pg_get_serial_sequence('public.pieces_display_history','id'), (SELECT max(id) FROM public.pieces_display_history));
ALTER TABLE public.pieces_display_history ADD PRIMARY KEY (id);
ALTER TABLE public.pieces_display_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.pieces (piece_pm_id);
CREATE INDEX ON public.pieces_price (pri_piece_id_i);
CREATE INDEX ON public.pieces_price (pri_pm_id);
CREATE INDEX ON public.pieces_display_history (batch_id);
CREATE INDEX ON public.pieces_relation_type (rtp_type_id, rtp_pg_id);
ANALYZE;
