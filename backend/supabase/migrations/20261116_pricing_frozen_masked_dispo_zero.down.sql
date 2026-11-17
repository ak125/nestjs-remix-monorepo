-- Rollback: 20261116_pricing_frozen_masked_dispo_zero
-- Remet pri_dispo '1' et la traçabilité d'origine (source, auteur, motif) sur les
-- 9 lignes, et elles seules : une ligne n'est touchée que si elle porte encore
-- exactement l'alignement de ce fichier (pri_dispo '0', FROZEN,
-- pricing_updated_source = la migration). Une ligne modifiée depuis est
-- conservée et signalée.
-- Ne remet PAS les pièces en vente : elles restent FROZEN et masquées. Pour les
-- remettre en vente, jouer ENSUITE le .down.sql de leur quarantaine d'origine
-- (20261018_pricing_quarantine_rupture_sphere_c00282.down.sql), ou, pour le
-- pilote du 2026-05-31, la procédure de audit/unavailable-quarantine-plan.md.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $unalign$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261116_pricing_frozen_masked_dispo_zero.sql';
  c_suffix CONSTANT text := ' | 2026-11-16 : pri_dispo aligné sur 0 (décisions 51 et 118, vendable = dispo 1, 2 ou 3, '
                         || 'ni FROZEN ni masquée). Réversible par 20261116_pricing_frozen_masked_dispo_zero.down.sql.';
  c_rows   CONSTANT jsonb := $json$
    [{"piece_id":5660748,"by":"quarantine-owner-go-2026-10-18","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":9613328,"by":"quarantine-owner-go-2026-10-18","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1008195,"by":"quarantine-owner-go-2026-10-18","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1011020,"by":"quarantine-owner-go-2026-10-18","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1303637,"by":"quarantine-owner-go-2026-10-18","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":1306850,"by":"quarantine-owner-go-2026-10-18","origin":"backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql"}
    ,{"piece_id":3283439,"by":"quarantine-pilot-owner-go","origin":"audit/unavailable-quarantine-plan.md"}
    ,{"piece_id":3283441,"by":"quarantine-pilot-owner-go","origin":"audit/unavailable-quarantine-plan.md"}
    ,{"piece_id":8291920,"by":"quarantine-pilot-owner-go","origin":"audit/unavailable-quarantine-plan.md"}
    ]
  $json$::jsonb;
  v_back bigint;
BEGIN
  UPDATE public.pieces_price pp
     SET pri_dispo              = '1',
         pricing_state_reason   = CASE
                                    WHEN right(pp.pricing_state_reason, length(c_suffix)) = c_suffix
                                    THEN left(pp.pricing_state_reason, length(pp.pricing_state_reason) - length(c_suffix))
                                    ELSE pp.pricing_state_reason
                                  END,
         pricing_updated_by     = e.by,
         pricing_updated_source = e.origin
    FROM jsonb_to_recordset(c_rows) AS e(piece_id bigint, by text, origin text)
   WHERE pp.pri_piece_id_i = e.piece_id
     AND pp.pri_dispo = '0'
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_source = c_source;
  GET DIAGNOSTICS v_back = ROW_COUNT;

  RAISE NOTICE 'rollback alignement FROZEN masquées : % / 9 ligne(s) remise(s) à pri_dispo 1 (reste = modifiée depuis, conservée)',
    v_back;
END
$unalign$;

SELECT pp.pri_piece_id_i, pp.pri_dispo, pp.pricing_state, pp.pricing_updated_source, p.piece_display
  FROM public.pieces_price pp
  JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
 WHERE pp.pri_piece_id_i IN (5660748, 9613328, 1008195, 1011020, 1303637, 1306850, 3283439, 3283441, 8291920)
 ORDER BY 1;

COMMIT;
