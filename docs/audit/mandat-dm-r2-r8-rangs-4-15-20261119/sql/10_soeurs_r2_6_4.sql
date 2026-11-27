-- Mandat DM 6.2/6.4 — lecture seule.
-- (a) 'self' : pages R2 relevées en PROD → règle sitemap rejouée (code sitemap-v10-pieces.service.ts :
--     pieces_gamme pg_display='1' et pg_relfollow='1' ; __sitemap_p_link.map_has_item > seuil ;
--     seuil = crawl_budget_experiments running/reduce baseline.min_items_threshold (20) ; auto_type type_display='1'
--     et modèle du type = modèle du lien).
-- (b) 'meme_gamme_meme_modele' / 'meme_type_autre_gamme' : pages sœurs des 20 gagnantes R2 (6.4).
with seuil as (
  select coalesce((select (baseline->>'min_items_threshold')::int from crawl_budget_experiments
                    where status='running' and action='reduce' limit 1), 20) s),
seeds(pg_id, modele_id, type_id) as (values (10,140006,57284),(12,140039,77283),(3894,173138,29997),(247,140041,8418),(467,128093,18497),(12,47017,24490),(247,140096,15716),(247,140038,23077),(310,128018,19352),(3939,140053,18314),(3213,140088,32682),(3213,140046,18791),(10,128093,7979),(247,128143,11112),(10,140046,16920),(247,140014,2113),(74,173039,8461),(592,173039,13100),(10,140092,16553),(247,128054,9981)),
selfs(pg_id, modele_id, type_id) as (values (4,128014,9465),(115,128098,76594),(689,128005,18586),(689,128014,9465),(686,140174,77699),(412,58223,23831),(3939,140053,18314),(13,128014,21501),(592,173039,13100),(158,108021,72988),(158,128014,9466),(10,128014,9466),(10,128093,7979),(10,140004,19052),(10,140006,57284),(10,140174,77698),(10,140046,16920),(10,140092,16553),(10,140093,9292),(7,128005,18586),(7,140174,77699),(7,173294,82921),(310,128014,9465),(310,128018,19352),(321,140008,59639),(321,173046,31340),(3894,173138,29997),(307,173141,17768),(402,128021,76375),(458,46006,10227),(458,128006,76346),(1260,123046,18229),(1260,140003,16104),(1260,140174,77699),(1260,140021,8990),(1260,140092,19676),(1260,147024,5677),(12,47017,24490),(12,108032,15835),(12,128014,9466),(12,128093,7979),(12,140039,77283),(3213,140046,18791),(3213,140088,32682),(467,128093,18497),(74,173039,8461),(3922,128014,21501),(249,47014,65483),(247,47014,5377),(247,128014,9465),(247,128014,9466),(247,128018,26630),(247,128054,9981),(247,128143,11112),(247,140014,2115),(247,140014,2113),(247,140026,8991),(247,140038,23077),(247,140041,8418),(247,140096,15716),(316,46070,11172),(316,128014,9465),(316,128014,30091),(316,128018,26630),(316,173044,19961),(577,60073,16102)),
cand as (
  select 'self'::text kind, s.pg_id seed_pg, s.type_id seed_type, l.* from selfs s
    left join __sitemap_p_link l on l.map_pg_id=s.pg_id and l.map_type_id=s.type_id
  union all
  select 'meme_gamme_meme_modele', s.pg_id, s.type_id, l.* from seeds s
    join __sitemap_p_link l on l.map_pg_id=s.pg_id and l.map_modele_id=s.modele_id and l.map_type_id<>s.type_id
  union all
  select 'meme_type_autre_gamme', s.pg_id, s.type_id, l.* from seeds s
    join __sitemap_p_link l on l.map_type_id=s.type_id and l.map_pg_id<>s.pg_id)
select c.kind, c.seed_pg, c.seed_type, c.map_pg_id, c.map_pg_alias, c.map_marque_id, c.map_modele_id, c.map_type_id,
       c.map_has_item, g.pg_display, g.pg_relfollow, t.type_display, (t.type_modele_id::text = c.map_modele_id::text) modele_ok,
       (g.pg_display='1' and g.pg_relfollow='1' and c.map_has_item > (select s from seuil)
        and t.type_display='1' and t.type_modele_id::text = c.map_modele_id::text) as regle_sitemap
from cand c
left join pieces_gamme g on g.pg_id = coalesce(c.map_pg_id, c.seed_pg)
left join auto_type t on t.type_id::text = coalesce(c.map_type_id, c.seed_type)::text
order by 1,2,3,4,8;
