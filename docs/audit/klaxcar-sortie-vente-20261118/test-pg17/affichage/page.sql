-- rm_get_page_complete_v2 (RPC de la page R2) : count, KLAXCAR dans products, empreinte sans duration_ms
COPY (
  SELECT v.t, v.g, r->>'success' AS success, (r->>'count')::int AS count,
         (SELECT count(*) FROM jsonb_array_elements(r->'products') e WHERE (e->>'pm_id')::int = 2590) AS klaxcar,
         md5((r - 'duration_ms')::text) AS empreinte
    FROM (VALUES (10271,9),(11754,48),(11755,3927),(11792,1260),(11793,854),(11883,1145),(1756,112),(18308,7),(18312,105),(22443,1361),(28199,111),(28568,82),(28569,105),(28569,470),(33338,10),(54959,111),(56761,111),(66764,111),(77411,111),(80873,111)) v(t,g)
    CROSS JOIN LATERAL (SELECT public.rm_get_page_complete_v2(v.g, v.t, 200) AS r) x
   ORDER BY 1, 2
) TO STDOUT WITH CSV;
