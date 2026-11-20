\echo == Q12a regle V3 : un seul champion par groupe [pg, modele, energie] (lignes vehicule)
select pg_id, count(*) groupes, count(*) filter (where n_v3>1) groupes_plusieurs_v3, count(*) filter (where n_v3=0) groupes_sans_v3
from (select pg_id, lower(model) m, coalesce(energy,'') e, count(*) filter (where v_level='V3') n_v3 from __seo_keywords where type='vehicle' and model is not null group by 1,2,3) x
group by 1 order by groupes_plusieurs_v3 desc, 1 limit 30;
\echo == Q12b regle V2 <= 10 par gamme (__seo_keywords vs __seo_type_vlevel)
select coalesce(a.pg_id,b.pg_id) pg, a.v2_kw, b.v2_tvl from
 (select pg_id, count(*) v2_kw from __seo_keywords where v_level='V2' group by 1) a
 full join (select pg_id, count(*) v2_tvl from __seo_type_vlevel where v_level='V2' group by 1) b on a.pg_id=b.pg_id order by 1;
\echo == Q12c V3 dont le type_id est absent ou non affiche (display<>1)
select k.pg_id, count(*) v3, count(*) filter (where k.type_id is null) sans_tid, count(*) filter (where t.type_display::text<>'1') tid_non_affiche
from __seo_keywords k left join auto_type t on t.type_id=k.type_id::text where k.v_level='V3' group by 1 order by 1;
\echo == Q12d google-ads-kp : lignes typees generic qui citent pourtant un modele (motif modele + chiffre/cylindree)
select pg_id, count(*) generic, count(*) filter (where keyword ~* '(clio|megane|scenic|twingo|kangoo|laguna|captur|10[0-9]|20[0-9]|30[0-9]|40[0-9]|50[0-9]|2008|3008|5008|c[1-5]\M|golf|polo|passat|a[1-6]\M|corsa|astra|fiesta|focus|yaris|punto|berlingo|partner|picasso|xsara|saxo|kadjar|qashqai|juke|sandero|logan|duster)') cite_modele
from __seo_keywords where source='google-ads-kp' and type='generic' group by 1 order by 3 desc limit 15;
\echo == Q12e decision 48 : mots-cles vehicule google-ads-kp avec type_id -> page R2 (pg x type) presente au sitemap et type affiche
select k.source, count(*) kw_veh, count(*) filter (where k.type_id is not null) avec_tid,
 count(*) filter (where k.type_id is not null and exists (select 1 from __sitemap_p_link s where s.map_pg_id=k.pg_id and s.map_type_id=k.type_id)) au_sitemap,
 count(*) filter (where k.type_id is not null and exists (select 1 from __sitemap_p_link s where s.map_pg_id=k.pg_id and s.map_type_id=k.type_id) and exists (select 1 from auto_type t where t.type_id=k.type_id::text and t.type_display::text='1')) au_sitemap_affiche
from __seo_keywords k where k.type='vehicle' group by 1 order by 1;
\echo == Q12f idem tous types (vehicle+generic) a volume >0 : combien ont une page R2 identifiable
select k.source, count(*) filter (where volume>0) kw_vol, count(*) filter (where volume>0 and type_id is not null) avec_tid from __seo_keywords k group by 1 order by 1;
