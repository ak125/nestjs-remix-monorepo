-- Lecture seule (sweep-psql.sh, transaction_read_only = on). Relevé 2026-11-18 23:42:33–23:42:41 UTC.
select pm_id, pm_name, pm_display, pm_alias from pieces_marque where pm_id = 2590 or pm_name ilike '%klax%';

select 'pieces piece_pm_id=2590' k, count(*), count(*) filter (where piece_display) disp
  from pieces where piece_pm_id = 2590;

-- Lignes par pri_dispo, état, fournisseur, affichage et prix > 0
select pp.pri_dispo, coalesce(pp.pricing_state,'∅') st, pp.pri_frs, p.piece_display,
       (pp.pri_vente_ttc_n > 0) prix_pos, count(*) lignes, count(distinct pp.pri_piece_id_i) pieces
  from pieces_price pp join pieces p on p.piece_id = pp.pri_piece_id_i
 where p.piece_pm_id = 2590 group by 1,2,3,4,5 order by 6 desc;

-- Cohérence de la clé de marque côté tarif
select count(*) lignes_pri_pm, count(*) filter (where p.piece_id is null) sans_piece,
       count(*) filter (where p.piece_pm_id is distinct from 2590) autre_marque
  from pieces_price pp left join pieces p on p.piece_id = pp.pri_piece_id_i where pp.pri_pm_id = '2590';
select count(*) lignes_pid_text_mismatch
  from pieces_price pp join pieces p on p.piece_id = pp.pri_piece_id_i
 where p.piece_pm_id = 2590
   and (pp.pri_piece_id is distinct from pp.pri_piece_id_i::text or pp.pri_pm_id is distinct from '2590');
select tgname from pg_trigger where tgrelid = 'public.pieces_price'::regclass and not tgisinternal;
