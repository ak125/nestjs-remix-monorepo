-- Mandat DG 6.6 — origine du corps servi par page conseil (règle de r3-guide.service.ts
-- resolveCanonicalSections : sections __seo_gamme_conseil hors S1/META présentes => mode
-- « conseil » ; sinon mode « article » = sections h2/h3 historiques de __blog_advice).
-- La projection WIKI (canary sous drapeau) n'est pas lisible ici. SELECT seul.
with sgc as (
  select sgc_pg_id,
         count(*) filter (where sgc_section_type is not null and sgc_section_type not in ('S1','META')) n_corps,
         count(*) n_total,
         count(*) filter (where sgc_section_type is not null and sgc_section_type not in ('S1','META') and sgc_enriched_by is null) n_corps_sans_trace,
         string_agg(distinct coalesce(sgc_enriched_by,'∅'), ',') enriched_by,
         max(sgc_enriched_at) last_enriched
  from __seo_gamme_conseil group by 1
), h2 as (
  select ba2_ba_id, count(*) n_h2 from __blog_advice_h2 group by 1
)
select g.pg_alias, ba.ba_pg_id, ba.ba_create, ba.ba_update,
       coalesce(sgc.n_corps,0) sgc_corps, coalesce(sgc.n_total,0) sgc_total, coalesce(sgc.n_corps_sans_trace,0) sgc_corps_sans_trace,
       sgc.enriched_by, sgc.last_enriched,
       coalesce(h2.n_h2,0) legacy_h2,
       case when coalesce(sgc.n_corps,0) > 0 then 'conseil(__seo_gamme_conseil)'
            else 'article(__blog_advice h2/h3 2024)' end as corps_servi_hors_canary
from __blog_advice ba
left join pieces_gamme g on g.pg_id::text = ba.ba_pg_id
left join sgc on sgc.sgc_pg_id = ba.ba_pg_id
left join h2 on h2.ba2_ba_id = ba.ba_id
order by g.pg_alias;
