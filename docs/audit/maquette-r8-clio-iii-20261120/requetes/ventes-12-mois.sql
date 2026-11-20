-- Ventes payées des 12 derniers mois rattachables aux types Clio III 1.5 dCi (SELECT seulement).
-- Les commandes ne portent pas le véhicule : rattachement par compatibilité de la pièce vendue
-- (orl_pg_id porte en réalité le piece_id : 25 lignes sur 27 concordent par piece_ref → pieces_relation_type),
-- et par l'URL de page quand elle existe.
with t(type_id) as (values (26627),(30141),(19051),(34744),(28839),(19052),(34746),(20078),(19053),
  (34749),(23455),(34745),(23456),(34747),(23457),(23458),(77069),(77070)),
l as (
  select o.ord_id, o.ord_cancel_date, l.orl_id, l.orl_art_ref, l.orl_pg_id, l.orl_pm_id, l.orl_pg_name, l.orl_website_url
  from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id=o.ord_id
  where o.ord_is_pay='1' and o.ord_date::timestamp >= now()-interval '12 months'),
p as (
  select l.*, pc.piece_id from l left join pieces pc
    on pc.piece_id::text=l.orl_pg_id::text and pc.piece_ref=l.orl_art_ref)
select t.type_id,
  count(distinct p.ord_id) filter (where r.rtp_piece_id is not null) as commandes_payees_piece_compatible,
  count(distinct p.ord_id) filter (where r.rtp_piece_id is not null and p.ord_cancel_date is null) as dont_non_annulees,
  string_agg(distinct p.orl_pg_name, ', ') filter (where r.rtp_piece_id is not null) as gammes,
  count(distinct p.ord_id) filter (where p.orl_website_url ~ ('-'||t.type_id||'\.html')) as commandes_via_url_du_type
from t left join p on true
left join pieces_relation_type r on r.rtp_piece_id=p.piece_id and r.rtp_type_id=t.type_id
group by t.type_id order by 2 desc, 1;
