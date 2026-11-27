select column_name, data_type from information_schema.columns where table_name='__vehicle_page_cache' order by ordinal_position;
select count(*) from __vehicle_page_cache;
