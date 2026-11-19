-- Mandat DG 6.3 — ce que le marquage permet de mesurer du passage conseil → R1 / R2 / panier.
-- SELECT seul, agrégats uniquement : aucun session_id, user_id, adresse ni agent utilisateur détaillé en sortie.
-- Fenêtre 90 j = 2026-08-19 → 2026-11-18 (inclus) pour les tables d'événements.
-- Une requête par bloc (statement_timeout court) ; sortie CSV concaténée.

-- a. funnel __seo_event_log : événements, clés de payload, catégories de referrer, marquage humain
  select 'a_event_log' as bloc, event_type::text as k1,
         coalesce(payload->>'referrer','(absent)') as k2,
         coalesce(payload->>'traffic_class','(absent)') as k3,
         count(*)::text as n, min(created_at)::text as debut, max(created_at)::text as fin
  from __seo_event_log
  where event_type in ('r2_view','r2_add_to_cart','r2_order_placed')
  group by 1,2,3,4;

-- b. seo_link_clicks par type de lien et type de page source
  select 'b_link_clicks' as bloc, coalesce(link_type::text,'(null)') as k1,
         case when source_url ~ '/blog-pieces-auto/conseils/' then 'source_conseil'
              when source_url ~ '/pieces/[^/]+/[^/]+/[^/]+/' then 'source_R2'
              when source_url ~ '/pieces/[a-z0-9-]+-[0-9]+\.html' then 'source_R1'
              else 'source_autre' end as k2,
         case when destination_url ~ '/pieces/[^/]+/[^/]+/[^/]+/' then 'dest_R2'
              when destination_url ~ '/pieces/[a-z0-9-]+-[0-9]+\.html' then 'dest_R1'
              when destination_url ~ '/blog-pieces-auto/' then 'dest_blog'
              else 'dest_autre' end as k3,
         count(*)::text as n, min(clicked_at)::text as debut, max(clicked_at)::text as fin
  from seo_link_clicks group by 1,2,3,4;

-- c. clics conseil → R1 sur 90 j, avec part d'agents « robot » (motif simple)
  select 'c_conseil_vers_R1_90j' as bloc, coalesce(link_type::text,'(null)') as k1,
         case when user_agent ~* '(bot|crawl|spider|headless|lighthouse)' then 'ua_robot' else 'ua_autre' end as k2,
         '' as k3, count(*)::text as n, min(clicked_at)::text, max(clicked_at)::text
  from seo_link_clicks
  where source_url ~ '/blog-pieces-auto/conseils/'
    and destination_url ~ '/pieces/[a-z0-9-]+-[0-9]+\.html'
    and clicked_at >= '2026-08-19' and clicked_at < '2026-11-19'
  group by 1,2,3;

-- d. seo_link_impressions sur pages conseil, par type de lien
  select 'd_link_impressions_conseil' as bloc, coalesce(link_type::text,'(null)') as k1, '' as k2, '' as k3,
         count(*)::text as n, min(viewed_at)::text, max(viewed_at)::text
  from seo_link_impressions
  where page_url ~ '/blog-pieces-auto/conseils/'
  group by 1,2;

-- e. seo_link_impressions : volume total et dernière ligne
  select 'e_link_impressions_total' as bloc, '' as k1, '' as k2, '' as k3,
         count(*)::text, min(viewed_at)::text, max(viewed_at)::text
  from seo_link_impressions;

-- f. GA4 : sessions par type de page et canal, 90 j GSC/GA4 (2026-08-19 → 2026-11-16)
  select 'f_ga4_sessions' as bloc,
         case when page ~ '^/blog-pieces-auto/conseils/[a-z0-9-]+/?$' then 'conseil'
              when page ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' then 'R2'
              when page ~ '^/pieces/[a-z0-9-]+-[0-9]+\.html$' then 'R1'
              else 'autre' end as k1,
         coalesce(channel::text,'(null)') as k2, count(distinct page)::text as k3,
         sum(sessions)::text, min(date)::text, max(date)::text
  from __seo_ga4_daily
  where date between '2026-08-19' and '2026-11-16'
  group by 1,2,3;
