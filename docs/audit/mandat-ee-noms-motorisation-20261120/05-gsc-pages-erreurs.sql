-- Mandat EE, 6.3 et 6.4 : trafic GSC (90 jours) des pages R8 et R2 des 205 types classés « erreur ».
-- Lecture seule. Le type_id est le dernier nombre de l'URL (-<type_id>.html), R8 et R2.
\o gsc-pages-erreurs.tsv
copy (
with fen as (select max(date) as fin, max(date) - 89 as debut from __seo_gsc_daily),
ids(type_id) as (select unnest('{28249,32741,33251,33252,60342,11364,11365,24472,12472,57293,12470,59406,33010,11832,11838,11853,33773,11857,55354,62033,33778,61907,21691,65057,65090,65167,65168,65173,9030,66132,66212,5260,65963,65967,10201,19974,66324,10206,15957,19975,66325,66326,66327,66328,66329,66330,66331,10205,9129,10209,19976,59928,66332,65972,65973,65974,65975,65978,65979,65980,12028,65981,65982,57446,65983,9619,13620,55105,55106,59492,66618,56757,56760,66628,66629,68,69,38703,66655,66656,58967,58968,66951,67112,67113,67114,67115,67128,29566,29567,66723,66725,66726,8019,8022,31094,31095,67133,67135,67136,7969,7970,30438,30487,66743,66744,66745,8151,8165,67148,67149,67150,67156,67157,67169,67170,67171,67176,67177,6932,59494,66959,66967,56758,56761,66759,66760,74,75,66769,66770,66771,66774,58546,58547,66781,66788,15490,15492,15491,15493,6939,6951,67190,67193,7015,7019,67040,67041,67042,67049,67050,67007,67011,67019,29807,67056,67057,67058,67065,67066,12605,6915,6921,59495,67074,67082,53336,47547,66841,53399,53394,66884,66889,68897,55786,55928,70010,23358,33593,5530,73531,73532,73534,73442,73446,26765,5544,33063,73557,14826,74115,56172,8241,76570,76577,10362,78179,78195,31115,19254,7761,9257,30845,22475}'::int[])),
d as (
  select (substring(d.page from '-(\d+)\.html$'))::int as type_id,
         case when d.page like '%/constructeurs/%' then 'R8' when d.page like '%/pieces/%' then 'R2' else 'autre' end as role,
         d.page, d.impressions, d.clicks
  from __seo_gsc_daily d, fen
  where d.date between fen.debut and fen.fin and d.page ~ '-\d+\.html$'
)
select i.type_id,
       coalesce(sum(d.impressions) filter (where d.role='R8'),0) as imp_r8,
       coalesce(sum(d.clicks) filter (where d.role='R8'),0) as clics_r8,
       count(distinct d.page) filter (where d.role='R2') as pages_r2_vues,
       coalesce(sum(d.impressions) filter (where d.role='R2'),0) as imp_r2,
       coalesce(sum(d.clicks) filter (where d.role='R2'),0) as clics_r2
from ids i left join d on d.type_id = i.type_id
group by i.type_id order by 2 desc, 5 desc
) to stdout with (format csv, delimiter E'\t', header);
\o
\o gsc-fenetre.tsv
copy (
select min(date) as premier_jour_present, max(date) as derniere_date,
       (select sum(impressions) from __seo_gsc_daily where date > (select max(date)-90 from __seo_gsc_daily)) as imp_avec_requete,
       (select sum(impressions) from __seo_gsc_daily_property_total where date > (select max(date)-90 from __seo_gsc_daily)) as imp_propriete
from __seo_gsc_daily
) to stdout with (format csv, delimiter E'\t', header);
\o
