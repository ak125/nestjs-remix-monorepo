-- Mandat DM 6.6 — gabarits title/H1 R2 en vigueur (__seo_gamme_car, source seo_raw de rm_page_v2). Lecture seule.
select sgc_pg_id, left(sgc_title, 160) sgc_title, left(sgc_h1, 160) sgc_h1
from __seo_gamme_car where sgc_pg_id::int in (10,316,247,7,1260,12,3213,458,689,3894,3939,592,13,158,402,412,115,249,3922,74,467,310,686)
order by 1;
select count(*) gammes_avec_gabarit, count(*) filter (where sgc_title ~ '#MinPrice#|%MinPrice%|MinPrice') avec_prix,
       count(*) filter (where sgc_title ~* 'fuel') avec_carburant from __seo_gamme_car;
