-- Mandat DG 6.5c — titre servi des pages conseil, reproduit selon la chaîne de
-- r3-guide.service.ts:467 (seo_brief du plan R3 le mieux noté > __blog_advice.ba_title > ba_h1),
-- et getSeoBrief (blog-seo.service.ts:393 : skp_seo_brief non nul, tri skp_quality_score desc).
-- Égalités de score : ordre non garanti côté service ; vérifié contre le HTML PROD (15 pages).
with brief as (
  select distinct on (skp_pg_id) skp_pg_id, skp_seo_brief->>'meta_title' mt, skp_status, skp_quality_score
  from __seo_r3_keyword_plan
  where skp_seo_brief is not null
  order by skp_pg_id, skp_quality_score desc nulls last
)
select g.pg_alias, ba.ba_pg_id,
       coalesce(nullif(b.mt,''), nullif(ba.ba_title,''), ba.ba_h1) as titre_servi_reproduit,
       case when nullif(b.mt,'') is not null then 'seo_brief' when nullif(ba.ba_title,'') is not null then 'ba_title' else 'ba_h1' end as source_titre,
       ba.ba_h1, b.skp_status, b.skp_quality_score
from __blog_advice ba
left join pieces_gamme g on g.pg_id::text = ba.ba_pg_id
left join brief b on b.skp_pg_id::text = ba.ba_pg_id
order by g.pg_alias;
