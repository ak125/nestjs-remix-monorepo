\echo == Q9a ventes 12 mois (2025-11-20 -> 2026-11-20) par gamme : commandes payees, non annulees
select l.orl_pg_id pg, max(l.orl_pg_name) gamme, count(distinct o.ord_id) commandes, sum(nullif(l.orl_art_quantity::text,'')::numeric) qte,
  (select count(*) from __seo_keywords k where k.pg_id::text=l.orl_pg_id::text) kw,
  (select count(*) from __seo_type_vlevel tv where tv.pg_id::text=l.orl_pg_id::text) tvl
from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id::text=o.ord_id::text
where o.ord_is_pay::text='1' and o.ord_cancel_date is null and o.ord_date::timestamp >= now() - interval '12 months'
group by 1 order by commandes desc limit 15;
\echo == Q9b meme chose, annulees incluses (pour comparaison)
select l.orl_pg_id pg, max(l.orl_pg_name) gamme, count(distinct o.ord_id) commandes
from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id::text=o.ord_id::text
where o.ord_is_pay::text='1' and o.ord_date::timestamp >= now() - interval '12 months'
group by 1 order by commandes desc limit 10;
\echo == Q9c fragments switch par gamme 7 (alias)
select sis_alias, count(*) n, count(distinct sis_content) distincts from __seo_item_switch where sis_pg_id::text in ('7','0') group by sis_pg_id, sis_alias order by sis_pg_id, sis_alias;
\echo == Q9d contenus switch pg 7
select sis_pg_id, sis_alias, sis_content from __seo_item_switch where sis_pg_id::text in ('7') order by sis_alias, sis_id;
\echo == Q9e __seo_gamme_car_switch / __seo_type_switch volumes
select 'gamme_car' t, count(*), count(distinct sgcs_pg_id) gammes, count(distinct sgcs_content) distincts from __seo_gamme_car_switch
union all select 'type', count(*), count(distinct sts_alias), count(distinct sts_content) from __seo_type_switch;
\echo == Q9f gamme_car_switch pg 7
select sgcs_alias, count(*), count(distinct sgcs_content) from __seo_gamme_car_switch where sgcs_pg_id::text='7' group by 1 order by 1;
