select table_name, string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
where table_name in ('auto_type','auto_modele','auto_marque','__seo_r8_pages') group by 1;
