set max_parallel_workers_per_gather=0;
select classe, count(*) images, count(*) filter (where rn=1) premieres, count(*) filter (where present_after) presentes_apres, count(*) filter (where ci_match) casse_seule, count(*) filter (where recup='inconnu') ref_tecdoc from cls group by 1 order by 2 desc;
select classe, count(*) filter (where ci_match) casse_seule from r2 group by 1;
select lower(substring(name from '\.([A-Za-z0-9]{1,5})$')) ext, classe, count(*) from r2 where classe<>'presente' group by 1,2 order by 3 desc limit 12;
select count(distinct piece_i) pieces_bmp from r2 where classe='absente_extension';
