-- Mandat DG 6.4/6.5a — cible du CTA conseil (ba_cta_link, contenu en base) vs règle indexable
-- (pg_display = pg_relfollow = pg_level = '1'). SELECT seul, aucune donnée client.
select ba.ba_alias,
       ba.ba_pg_id,
       g.pg_alias,
       g.pg_display, g.pg_relfollow, g.pg_level,
       (g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1') as indexable,
       ba.ba_cta_anchor,
       ba.ba_cta_link,
       case
         when coalesce(ba.ba_cta_link,'') = '' then 'vide'
         when ba.ba_cta_link ~ ('/pieces/' || g.pg_alias || '-' || g.pg_id || '\.html$') then 'R1_meme_gamme'
         when ba.ba_cta_link ~ '/pieces/[a-z0-9-]+-[0-9]+\.html$' then 'R1_autre_gamme'
         else 'autre'
       end as cta_cible,
       ba.ba_create, ba.ba_update, ba.ba_content_type,
       length(ba.ba_content) as len_content
from __blog_advice ba
left join pieces_gamme g on g.pg_id::text = ba.ba_pg_id
order by ba.ba_alias;
