\echo == Q2a __seo_keywords par source x v_level
select coalesce(source,'(null)') src, coalesce(v_level,'(null)') vl, count(*), count(type_id) with_type_id, min(collected_at)::date, max(collected_at)::date, min(updated_at)::date, max(updated_at)::date
from __seo_keywords group by 1,2 order by 1,2;
\echo == Q2b __seo_keywords par type x v_level
select coalesce(type,'(null)'), coalesce(v_level,'(null)'), count(*), count(type_id) from __seo_keywords group by 1,2 order by 1,2;
\echo == Q2c __seo_type_vlevel par source x v_level
select coalesce(source,'(null)'), coalesce(v_level,'(null)'), count(*), count(distinct pg_id) n_pg, min(updated_at), max(updated_at) from __seo_type_vlevel group by 1,2 order by 1,2;
\echo == Q2d gammes couvertes
select 'kw' t, count(distinct pg_id) from __seo_keywords union all select 'tv', count(distinct pg_id) from __seo_type_vlevel union all select 'kw_and_tv', count(*) from (select distinct pg_id from __seo_keywords intersect select distinct pg_id from __seo_type_vlevel) x;
