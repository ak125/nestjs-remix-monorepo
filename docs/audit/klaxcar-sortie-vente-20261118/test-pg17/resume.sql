SELECT CASE WHEN p.piece_pm_id = 2590 THEN 'KLAXCAR' ELSE 'témoin' END AS lot, pp.pri_dispo, pp.pricing_state,
       count(*) AS lignes,
       count(*) FILTER (WHERE pp.pricing_state_reason IS NULL AND pp.pricing_updated_by IS NULL AND pp.pricing_updated_source IS NULL) AS sans_trace,
       count(*) FILTER (WHERE pp.pri_dispo IN ('1','2','3') AND pp.pricing_state IS DISTINCT FROM 'FROZEN' AND p.piece_display AND pp.pri_vente_ttc_n > 0) AS vendables
  FROM public.pieces_price pp JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
 GROUP BY 1,2,3 ORDER BY 1,2,3;
