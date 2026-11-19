select jsonb_typeof(payload->'catalog'), left((payload->'catalog')::text, 600) from __vehicle_page_cache where type_id=57284;
select left((payload->'popular_parts')::text, 300) from __vehicle_page_cache where type_id=57284;
