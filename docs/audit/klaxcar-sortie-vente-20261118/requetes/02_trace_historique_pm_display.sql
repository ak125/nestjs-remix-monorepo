-- Lecture seule. Relevé 2026-11-18 23:49:03–23:49:45 UTC.
select pm_display, count(*) from pieces_marque group by 1 order by 1;
select pm_id, pm_name, pm_display, pm_sitemap, pm_relfollow, pm_top
  from pieces_marque where pm_name ilike any (array['%klax%','%veneporte%','LPR%','%quick%steer%']) order by 1;

select pp.pri_dispo, pp.pricing_state, left(coalesce(pp.pricing_state_reason,'∅'),60) reason,
       coalesce(pp.pricing_updated_by,'∅') by_, left(coalesce(pp.pricing_updated_source,'∅'),70) src,
       pp.pri_type, count(*)
  from pieces_price pp where pp.pri_pm_id = '2590' group by 1,2,3,4,5,6 order by 7 desc;
select count(*) hist_klax from pieces_price_history h
 where h.pri_piece_id_i in (select piece_id from pieces where piece_pm_id = 2590);
