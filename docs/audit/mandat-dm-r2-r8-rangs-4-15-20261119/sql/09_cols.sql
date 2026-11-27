select column_name, data_type from information_schema.columns where table_name='__sitemap_p_link' order by ordinal_position;
select count(*), count(*) filter (where map_has_item>20) from __sitemap_p_link;
select id, status, action, baseline from crawl_budget_experiments where status='running';
