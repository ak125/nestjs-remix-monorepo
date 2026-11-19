-- Lecture seule. Relevé 2026-11-18 23:50:34–23:50:42 UTC.
-- Garde de la décision 51 : part de KLAXCAR dans les lignes vendables de son fournisseur (CAL).
select count(*) lignes_cal_vendables, count(*) filter (where p.piece_pm_id = 2590) dont_klaxcar
  from pieces_price pp join pieces p on p.piece_id = pp.pri_piece_id_i
 where pp.pri_frs = 'CAL' and pp.pri_dispo in ('1','2','3') and coalesce(pp.pricing_state,'') <> 'FROZEN'
   and p.piece_display and pp.pri_vente_ttc_n > 0;

-- Autres marques : comptées seulement (hors périmètre).
select m.pm_id, m.pm_name, m.pm_display, count(pp.*) lignes_prix,
       count(*) filter (where pp.pri_dispo in ('1','2','3') and coalesce(pp.pricing_state,'') <> 'FROZEN'
                          and p.piece_display and pp.pri_vente_ttc_n > 0) lignes_vendables,
       string_agg(distinct pp.pri_frs, ',') frs
  from pieces_marque m join pieces p on p.piece_pm_id = m.pm_id join pieces_price pp on pp.pri_piece_id_i = p.piece_id
 where m.pm_id in (2590, 2820, 4900, 7190) group by 1,2,3 order by 1;
