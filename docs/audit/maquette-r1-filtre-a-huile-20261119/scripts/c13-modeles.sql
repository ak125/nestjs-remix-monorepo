select m.modele_id, m.modele_name, m.modele_display, m.modele_marque_id, ma.marque_name, ma.marque_display,
 (select count(*) from __sitemap_p_link s where s.map_modele_id=m.modele_id::int) as lignes_sitemap_modele
from auto_modele m left join auto_marque ma on ma.marque_id::text=m.modele_marque_id::text
where m.modele_id::text in ('140049','46007','140003');
select pg_id, pg_name, pg_display, pg_level from pieces_gamme where pg_id in (7,402);
