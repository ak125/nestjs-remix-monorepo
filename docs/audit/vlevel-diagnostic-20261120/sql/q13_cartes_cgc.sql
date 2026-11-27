\echo == Q13 vehicules de __cross_gamme_car_new par gamme (total, niveau 1 = cartes R1)
select cgc_pg_id, count(*) total, count(*) filter (where cgc_level::text='1') niveau1 from __cross_gamme_car_new where cgc_pg_id::text in ('7','13','1718') group by 1 order by 1;
