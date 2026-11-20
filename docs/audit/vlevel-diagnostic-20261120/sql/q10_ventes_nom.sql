\echo == Q10a volume total commandes payees 12 mois (annulees exclues / incluses)
select count(*) filter (where ord_cancel_date is null) payees_non_annulees, count(*) payees_toutes, min(ord_date), max(ord_date)
from ___xtr_order where ord_is_pay::text='1' and ord_date::timestamp >= now() - interval '12 months';
\echo == Q10b orl_pg_id = id gamme ? (match pieces_gamme)
select count(*) lignes, count(*) filter (where exists (select 1 from pieces_gamme g where g.pg_id::text=l.orl_pg_id::text)) match_pg_id,
 count(*) filter (where exists (select 1 from pieces_gamme g where lower(g.pg_name)=lower(l.orl_pg_name))) match_nom
from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id::text=o.ord_id::text
where o.ord_is_pay::text='1' and o.ord_date::timestamp >= now() - interval '12 months';
\echo == Q10c ventes 12 mois par nom de gamme -> pg_id via pieces_gamme (payees non annulees)
select l.orl_pg_name, (select string_agg(g.pg_id::text, ',') from pieces_gamme g where lower(g.pg_name)=lower(l.orl_pg_name) and g.pg_display::text='1') pg_ids,
 count(distinct o.ord_id) commandes, sum(nullif(l.orl_art_quantity::text,'')::numeric) qte
from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id::text=o.ord_id::text
where o.ord_is_pay::text='1' and o.ord_cancel_date is null and o.ord_date::timestamp >= now() - interval '12 months'
group by 1 order by commandes desc, qte desc limit 20;
