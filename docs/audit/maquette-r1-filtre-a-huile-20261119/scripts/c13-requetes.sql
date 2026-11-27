-- Décision 157 : les cartes (et surtout les repliées) contre les requêtes véhicule les plus tapées de la gamme. SELECT seulement.
with k as (select pg_id, type_id, keyword, coalesce(volume,0) vol from __seo_keywords where pg_id in (7,402) and type_id is not null),
top as (select pg_id, type_id, max(vol) vol_max, sum(vol) vol_tot, (array_agg(keyword order by vol desc nulls last))[1] kw from k group by 1,2),
rk as (select *, rank() over (partition by pg_id order by vol_tot desc) rang_demande from top)
select pg_id, count(*) types_avec_requete, sum(vol_tot) volume_total from rk group by 1 order by 1;
with k as (select pg_id, type_id, keyword, coalesce(volume,0) vol from __seo_keywords where pg_id in (7,402) and type_id is not null),
top as (select pg_id, type_id, sum(vol) vol_tot, (array_agg(keyword order by vol desc nulls last))[1] kw from k group by 1,2),
rk as (select *, rank() over (partition by pg_id order by vol_tot desc) rang_demande from top),
cartes(pg_id,type_id,rang_carte) as (select 7, unnest(array[19052,30091,19966,18929,16102,23175,17696,17079,18793,31083,16201,11758,17768,19255,22457,57,31077,13927,7072]), generate_subscripts(array[19052,30091,19966,18929,16102,23175,17696,17079,18793,31083,16201,11758,17768,19255,22457,57,31077,13927,7072],1) union all select 402, unnest(array[77310,65057,16108,30936,19341,17989,15903,18400,26547,27326,8456,8461,13100,58963,31672,32172,58791]), generate_subscripts(array[77310,65057,16108,30936,19341,17989,15903,18400,26547,27326,8456,8461,13100,58963,31672,32172,58791],1))
select c.pg_id, c.rang_carte, c.type_id, case when c.rang_carte>12 then 'repliée' else 'visible' end etat, rk.rang_demande, rk.vol_tot, rk.kw
from cartes c left join rk on rk.pg_id=c.pg_id and rk.type_id=c.type_id order by c.pg_id, c.rang_carte;
with k as (select pg_id, type_id, coalesce(volume,0) vol, keyword from __seo_keywords where pg_id in (7,402) and type_id is not null),
top as (select pg_id, type_id, sum(vol) vol_tot, (array_agg(keyword order by vol desc nulls last))[1] kw from k group by 1,2)
select pg_id, type_id, vol_tot, kw from (select *, rank() over (partition by pg_id order by vol_tot desc) r from top) x where r<=8 order by pg_id, r;
