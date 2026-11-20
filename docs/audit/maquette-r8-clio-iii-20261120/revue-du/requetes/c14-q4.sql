-- Complément n° 14 DU. SELECT seulement. Gammes demandées sans lien servi après : pièces liées / vendables (définition estVendable) et sitemap pièces, type 19052.
with x(pg_id) as (values (124),(2462),(123),(806),(1123),(3859),(258),(83)),
rel as (select r.rtp_pg_id pg_id, r.rtp_piece_id from pieces_relation_type r join x on r.rtp_pg_id=x.pg_id where r.rtp_type_id=19052),
vend as (select rel.pg_id, rel.rtp_piece_id, bool_or(pp.pri_dispo in ('1','2','3') and coalesce(pp.pricing_state,'')<>'FROZEN' and p.piece_display is true and pp.pri_vente_ttc_n>0) v
  from rel join pieces p on p.piece_id=rel.rtp_piece_id left join pieces_price pp on pp.pri_piece_id=rel.rtp_piece_id::text group by 1,2)
select x.pg_id, (select pg_name from pieces_gamme where pg_id::int=x.pg_id) nom, x.pg_id = any('{2,4,7,8,9,10,13,39,40,48,50,70,78,82,107,124,138,141,158,170,183,188,191,193,234,243,247,249,259,273,274,277,285,289,295,298,300,306,307,310,312,316,318,321,402,424,429,447,448,458,468,470,475,479,577,620,624,655,805,807,809,817,830,851,854,1145,1182,1260,1269,1270,1289,1367,1385,2462}'::int[]) lien_avant,
 (select count(*) from vend where vend.pg_id=x.pg_id) liees, (select count(*) from vend where vend.pg_id=x.pg_id and v) vendables,
 (select max(map_has_item) from __sitemap_p_link where map_type_id=19052 and map_pg_id=x.pg_id) sitemap_has_item
from x order by 1;
