\echo == Q6a mots-cles pg 7 mentionnant clio 3 / clio iii
select id, keyword, type, v_level, model, energy, displacement, power, volume, type_id, source, updated_at::date
from __seo_keywords where pg_id=7 and keyword ~* 'clio\s*(3|iii)' order by volume desc nulls last, keyword;
\echo == Q6b __seo_type_vlevel pg 7 pour les type_id Clio III 1.5 dCi
select tv.type_id, tv.v_level, tv.source, tv.model, tv.energy, tv.confidence, tv.updated_at from __seo_type_vlevel tv where tv.pg_id=7 and tv.type_id in (77069,77070,26627,30141,19051,34744,28839,19052,34746,20078,19053,34749,23455,34745,23456,34747,23457,23458) order by 1;
\echo == Q6c __seo_type_vlevel pg 7 : V2 (73) — quels modeles
select tv.model, tv.energy, count(*) n from __seo_type_vlevel tv where pg_id=7 and v_level='V2' group by 1,2 order by 3 desc, 1 limit 30;
\echo == Q6d top 15 mots-cles pg 7 par volume
select keyword, type, v_level, model, energy, volume, type_id, source from __seo_keywords where pg_id=7 order by volume desc nulls last limit 15;
\echo == Q6e top 20 V3 pg 7 (champions) par volume
select keyword, model, energy, volume, type_id, v2_repetitions from __seo_keywords where pg_id=7 and v_level='V3' order by volume desc nulls last, keyword limit 20;
