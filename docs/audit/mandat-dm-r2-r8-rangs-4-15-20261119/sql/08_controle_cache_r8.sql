-- Contrôle : nombre de gammes du catalogue en cache R8 vs liens R2 servis (relevé PROD).
with e(n, type_id) as (values (1,25470),(2,23829),(3,32825),(4,16102),(5,34241),(6,17258),(7,20034),(8,59438),(9,14818),(10,5371),(11,15890),(12,13365),(13,9465),(14,57721),(15,58650),(16,33866),(17,16669),(18,14908),(19,28769),(20,2113),(21,2114),(22,18781),(23,16554),(24,54957),(25,59067))
select e.n, e.type_id, (select count(*) from jsonb_array_elements(c.payload->'catalog'->'families') f, jsonb_array_elements(f->'gammes') g) as gammes_cache
from e left join __vehicle_page_cache c using (type_id) order by 1;
