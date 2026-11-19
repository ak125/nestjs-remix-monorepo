insert into t_out
select :'phase', g, t, 'v3', (get_pieces_for_type_gamme_v3(t, g) - 'duration')::text from t_pairs
union all
select :'phase', g, t, 'filtered', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from get_listing_products_extended_filtered(g, t::bigint, 200) x), '[]')::text from t_pairs;
