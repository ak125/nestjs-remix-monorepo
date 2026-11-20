-- Complément n° 14 DU. SELECT seulement. Gammes vendables du type 19052 (définition estVendable) et couverture par les liens R2 servis.
set statement_timeout='170s';
with rel as (select distinct r.rtp_pg_id pg_id, r.rtp_piece_id from pieces_relation_type r where r.rtp_type_id=19052),
vend as (select rel.pg_id from rel join pieces p on p.piece_id=rel.rtp_piece_id and p.piece_display is true
  join pieces_price pp on pp.pri_piece_id=rel.rtp_piece_id::text and pp.pri_dispo in ('1','2','3') and coalesce(pp.pricing_state,'')<>'FROZEN' and pp.pri_vente_ttc_n>0 group by 1)
select (select count(distinct pg_id) from rel) gammes_liees, count(*) gammes_vendables,
 count(*) filter (where pg_id = any('{2,4,7,8,9,10,13,39,40,48,50,70,78,82,107,124,138,141,158,170,183,188,191,193,234,243,247,249,259,273,274,277,285,289,295,298,300,306,307,310,312,316,318,321,402,424,429,447,448,458,468,470,475,479,577,620,624,655,805,807,809,817,830,851,854,1145,1182,1260,1269,1270,1289,1367,1385,2462}'::int[])) vendables_lien_avant, count(*) filter (where pg_id = any('{2,4,7,8,9,10,13,39,40,48,50,70,78,82,107,138,141,158,170,183,188,191,193,234,243,247,249,259,273,274,277,285,289,295,298,300,306,307,310,312,316,318,321,402,424,429,447,448,458,468,470,475,479,577,620,624,655,805,807,809,817,830,851,854,1145,1182,1260,1269,1270,1289,1367,1385}'::int[])) vendables_lien_apres,
 (select count(*) from unnest('{2,4,7,8,9,10,13,39,40,48,50,70,78,82,107,138,141,158,170,183,188,191,193,234,243,247,249,259,273,274,277,285,289,295,298,300,306,307,310,312,316,318,321,402,424,429,447,448,458,468,470,475,479,577,620,624,655,805,807,809,817,830,851,854,1145,1182,1260,1269,1270,1289,1367,1385}'::int[]) u where u not in (select pg_id from vend)) liens_apres_non_vendables
from vend;
