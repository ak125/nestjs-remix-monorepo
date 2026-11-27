\echo == Q11a gammes candidates : nom proche "emetteur recepteur embrayage", "cable compteur"
select pg_id, pg_name, pg_alias, pg_display, pg_level from pieces_gamme where pg_name ~* '(metteur|cepteur).*embray|c.ble.*compteur|plaquettes de frein$|ma.tre.cylindre de frein' order by pg_id;
\echo == Q11b candidats : mots-cles, type_vlevel, clics GSC juillet vs octobre (pages /pieces/<alias>-<pg>)
with c(pg) as (values (7),(13),(1718),(3902),(247),(286),(1561),(807))
select c.pg, g.pg_alias,
 (select count(*) from __seo_keywords k where k.pg_id=c.pg) kw,
 (select count(*) from __seo_keywords k where k.pg_id=c.pg and k.type='vehicle') kw_veh,
 (select count(*) from __seo_type_vlevel tv where tv.pg_id=c.pg) tvl,
 (select sum(clicks) from __seo_gsc_daily_page_totals p where p.page like '%/pieces/'||g.pg_alias||'-'||c.pg||'%' and p.date between '2026-07-01' and '2026-07-31') clics_juil,
 (select sum(clicks) from __seo_gsc_daily_page_totals p where p.page like '%/pieces/'||g.pg_alias||'-'||c.pg||'%' and p.date between '2026-10-01' and '2026-10-31') clics_oct
from c join pieces_gamme g on g.pg_id::text=c.pg::text order by 1;
