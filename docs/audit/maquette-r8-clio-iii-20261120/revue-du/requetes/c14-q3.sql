-- Complément n° 14 DU. SELECT seulement. Demande textuelle « clio 3 / clio iii » (toutes gammes, tous types), croisée avec les liens servis après.
select count(*) total_kw from __seo_keywords;
with k as (select pg_id, keyword, coalesce(volume,0) vol, type_id, energy from __seo_keywords where keyword ~* 'clio ?(3|iii)( |$)')
select pg_id, (select pg_name from pieces_gamme where pg_id::int=k.pg_id) nom, sum(vol) vol_tot, count(*) nb, (array_agg(keyword order by vol desc))[1] top_kw,
 count(*) filter (where type_id=19052) sur_19052, pg_id = any('{2,4,7,8,9,10,13,39,40,48,50,70,78,82,107,138,141,158,170,183,188,191,193,234,243,247,249,259,273,274,277,285,289,295,298,300,306,307,310,312,316,318,321,402,424,429,447,448,458,468,470,475,479,577,620,624,655,805,807,809,817,830,851,854,1145,1182,1260,1269,1270,1289,1367,1385}'::int[]) lien_apres
from k group by pg_id order by vol_tot desc limit 25;
select keyword, volume, pg_id, type_id, energy from __seo_keywords where keyword ~* 'clio ?(3|iii)' and (pg_id is null or keyword ~* 'dci|diesel|86') order by volume desc nulls last limit 15;
