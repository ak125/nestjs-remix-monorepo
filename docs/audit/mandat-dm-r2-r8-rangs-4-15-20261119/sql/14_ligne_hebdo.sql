-- Mandat DM 6.7 — ligne de rapport hebdomadaire : couples R2/R8 en rang 4 à 15 sur requêtes de 3 mots ou plus.
-- PROPOSÉ (rien n'est planifié ni branché). Lecture seule. Une ligne par rôle et par semaine ISO complète
-- (lundi → dimanche), 4 dernières semaines complètes présentes en base.
-- Règles = celles du 6.1 (scripts/analyse_rangs.py) :
--   requête ≠ ^ai[0-9]+$, ≠ requête de marque (automecani|auto mecanik|site:), 3 mots ou plus ;
--   rang = position moyenne pondérée par les impressions sur la semaine, 4 ≤ rang ≤ 15 ;
--   écarté : ordinateur et mobile présents et |pos_ordi − pos_mobile| > 10 ; un seul appareil et 0 clic ;
--   clics gagnables = impressions × max(0, ctr_rang3 − ctr réel), ctr_rang3 = 0,018291 (courbe isotonique
--   r2r8_3mots mesurée le 19 nov. 2026 sur 90 j ; à recalculer chaque trimestre avec sql/00 + analyse_rangs.py).
-- Colonne de contrôle au grain page (__seo_gsc_daily_page_totals, fidèle) : pages R2/R8 en rang 4–15,
--   clics gagnables avec ctr_rang3_page = 0,038956 (même méthode, grain page).
-- Fraîcheur : d_max = dernière date en base, à reporter avec la ligne (alerte si > 3 jours, décision 68).
with params as (
  select (select max(date) from __seo_gsc_daily) d_max, 0.018291::numeric ctr3, 0.038956::numeric ctr3_page
), semaines as (
  select generate_series(date_trunc('week', d_max - 6)::date - 21, date_trunc('week', d_max - 6)::date, interval '7 day')::date lundi
  from params
), s as (  -- semaines complètes seulement
  select lundi, lundi + 6 dimanche from semaines, params where lundi + 6 <= d_max
), c as (
  select s.lundi, case when g.page like '%/pieces/%' then 'R2' else 'R8' end role,
         g.page, g.query,
         sum(g.impressions) impr, sum(g.clicks) clk,
         sum(g.position*g.impressions)/nullif(sum(g.impressions),0) pos,
         sum(g.position*g.impressions) filter (where g.device='desktop') / nullif(sum(g.impressions) filter (where g.device='desktop'),0) pos_d,
         sum(g.position*g.impressions) filter (where g.device='mobile') / nullif(sum(g.impressions) filter (where g.device='mobile'),0) pos_m
  from __seo_gsc_daily g join s on g.date between s.lundi and s.dimanche
  where g.query !~ '^ai[0-9]+$' and g.query !~* '(automecani|auto mecanik|site:)'
    and array_length(regexp_split_to_array(trim(g.query),'\s+'),1) >= 3
    and (g.page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$'
      or g.page ~ '^https?://[^/]+/constructeurs/[^/]+/[^/]+/[^/]+\.html$')
  group by 1,2,3,4
), k as (
  select c.*, case when pos_d is not null and pos_m is not null and abs(pos_d-pos_m) > 10 then 'divergent'
                   when (pos_d is null or pos_m is null) and clk = 0 then 'un_appareil_sans_clic'
                   else 'retenu' end statut
  from c where pos between 4 and 15
), q as (
  select lundi, role,
         count(*) filter (where statut='retenu') couples, count(distinct page) filter (where statut='retenu') pages,
         sum(impr) filter (where statut='retenu') impr, sum(clk) filter (where statut='retenu') clics,
         round(sum(greatest(0, impr*(p.ctr3) - clk)) filter (where statut='retenu'), 1) clics_gagnables,
         count(*) filter (where statut='divergent') couples_divergents,
         count(*) filter (where statut='un_appareil_sans_clic') couples_un_appareil
  from k, params p group by 1,2
), pg as (
  select s.lundi, case when t.page like '%/pieces/%' then 'R2' else 'R8' end role, t.page,
         sum(t.impressions) impr, sum(t.clicks) clk, sum(t.position*t.impressions)/nullif(sum(t.impressions),0) pos
  from __seo_gsc_daily_page_totals t join s on t.date between s.lundi and s.dimanche
  where t.page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$'
     or t.page ~ '^https?://[^/]+/constructeurs/[^/]+/[^/]+/[^/]+\.html$'
  group by 1,2,3
), pq as (
  select lundi, role, count(*) pages_page_4_15, sum(impr) impr_page_4_15, sum(clk) clics_page_4_15,
         round(sum(greatest(0, impr*p.ctr3_page - clk)), 1) clics_gagnables_page_4_15
  from pg, params p where pos between 4 and 15 group by 1,2
)
select to_char(q.lundi,'IYYY-"S"IW') semaine, q.lundi, q.lundi+6 dimanche, (select d_max from params) derniere_donnee, q.role,
       q.couples, q.pages, q.impr, q.clics, round(100.0*q.clics/nullif(q.impr,0),2) ctr_pct, q.clics_gagnables,
       q.couples_divergents, q.couples_un_appareil,
       pq.pages_page_4_15, pq.impr_page_4_15, pq.clics_page_4_15, pq.clics_gagnables_page_4_15
from q left join pq using (lundi, role)
order by q.lundi, q.role;
