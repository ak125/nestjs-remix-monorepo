-- Mandat DM 6.6 — données véhicule des pages relevées (démonstration des gabarits candidats) et état R8. Lecture seule.
select t.type_id, ma.marque_name, mo.modele_name, t.type_name, t.type_fuel, t.type_power_ps, t.type_year_from, t.type_year_to,
       r.meta_title r8_meta_title, r.sitemap_included r8_sitemap_included, r.robots_directive r8_robots, r.seo_decision r8_seo_decision,
       r.specific_content_ratio r8_specific_ratio, r.boilerplate_ratio r8_boilerplate_ratio
from auto_type t
left join auto_modele mo on mo.modele_id::text = t.type_modele_id::text
left join auto_marque ma on ma.marque_id::text = t.type_marque_id::text
left join __seo_r8_pages r on r.type_id::text = t.type_id::text
where t.type_id::text in (select unnest(string_to_array('2113,2114,2115,5371,5377,5677,7979,8418,8461,8990,8991,9292,9465,9466,9981,10227,11112,11172,13100,13365,14818,14908,15716,15835,15890,16102,16104,16553,16554,16669,16920,17258,17768,18229,18314,18497,18586,18781,18791,19052,19352,19676,19961,20034,21501,23077,23829,23831,24490,25470,26630,28769,29997,30091,31340,32682,32825,33866,34241,54957,57284,57721,58650,59067,59438,59639,65483,72988,76346,76375,76594,77283,77698,77699,82921', ',')))
order by 1;
