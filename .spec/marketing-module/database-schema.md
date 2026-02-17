# Database Schema - Module Marketing

## Tables

### 1. `__marketing_campaigns`

Container pour les campagnes marketing (backlinks, guest posts, outreach, linkbait).

```sql
CREATE TABLE __marketing_campaigns (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('backlink', 'guest_post', 'outreach', 'linkbait')),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  goal_backlinks integer DEFAULT 0,
  goal_da_min   integer DEFAULT 0,
  start_date    date,
  end_date      date,
  budget_euros  numeric(10,2) DEFAULT 0,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

### 2. `__marketing_backlinks`

Suivi individuel des backlinks (acquis, cibles, perdus).

```sql
CREATE TABLE __marketing_backlinks (
  id              serial PRIMARY KEY,
  campaign_id     integer REFERENCES __marketing_campaigns(id) ON DELETE SET NULL,
  source_url      text NOT NULL,
  source_domain   text NOT NULL,
  target_url      text NOT NULL,
  anchor_text     text,
  anchor_type     text CHECK (anchor_type IN ('brand', 'product', 'instructional', 'url', 'generic')),
  link_type       text DEFAULT 'dofollow' CHECK (link_type IN ('dofollow', 'nofollow', 'ugc', 'sponsored')),
  status          text DEFAULT 'live' CHECK (status IN ('live', 'lost', 'pending', 'broken')),
  da_score        integer,
  dr_score        integer,
  first_seen      date,
  last_checked    timestamptz,
  source_category text CHECK (source_category IN ('forum', 'blog', 'annuaire', 'media', 'garage', 'other')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_marketing_backlinks_domain ON __marketing_backlinks(source_domain);
CREATE INDEX idx_marketing_backlinks_status ON __marketing_backlinks(status);
CREATE INDEX idx_marketing_backlinks_campaign ON __marketing_backlinks(campaign_id);
```

### 3. `__marketing_outreach`

Tracking des emails de prospection (templates, envois, reponses).

```sql
CREATE TABLE __marketing_outreach (
  id              serial PRIMARY KEY,
  campaign_id     integer REFERENCES __marketing_campaigns(id) ON DELETE SET NULL,
  target_site     text NOT NULL,
  contact_name    text,
  contact_email   text,
  template_type   text NOT NULL CHECK (template_type IN ('guest_post', 'broken_link', 'resource_page', 'partnership')),
  subject_line    text,
  status          text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'follow_up', 'responded', 'accepted', 'declined', 'no_response')),
  sent_at         timestamptz,
  followup_at     timestamptz,
  responded_at    timestamptz,
  target_da       integer,
  proposed_title  text,
  result_url      text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_marketing_outreach_status ON __marketing_outreach(status);
CREATE INDEX idx_marketing_outreach_campaign ON __marketing_outreach(campaign_id);
```

### 4. `__marketing_guest_posts`

Articles invites (lies aux campagnes et outreach).

```sql
CREATE TABLE __marketing_guest_posts (
  id                    serial PRIMARY KEY,
  campaign_id           integer REFERENCES __marketing_campaigns(id) ON DELETE SET NULL,
  outreach_id           integer REFERENCES __marketing_outreach(id) ON DELETE SET NULL,
  title                 text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  target_site           text NOT NULL,
  status                text DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'submitted', 'published', 'rejected')),
  content_md            text,
  word_count            integer DEFAULT 0,
  target_url_in_article text,
  anchor_text_used      text,
  published_url         text,
  published_at          date,
  da_score              integer,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_marketing_guest_posts_status ON __marketing_guest_posts(status);
```

### 5. `__marketing_content_roadmap`

Planification du contenu a creer (glossaire, guides, articles, diagnostics).

```sql
CREATE TABLE __marketing_content_roadmap (
  id                serial PRIMARY KEY,
  title             text NOT NULL,
  slug              text,
  content_type      text NOT NULL CHECK (content_type IN ('glossary', 'guide', 'advice', 'diagnostic', 'linkbait')),
  priority          text DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status            text DEFAULT 'planned' CHECK (status IN ('planned', 'writing', 'review', 'published', 'cancelled')),
  target_family     text,
  pg_id             integer,
  blog_advice_id    integer,
  seo_observable_id integer,
  seo_reference_id  integer,
  estimated_words   integer DEFAULT 1500,
  assigned_to       text,
  deadline          date,
  ga4_traffic       integer,
  backlink_potential text CHECK (backlink_potential IN ('high', 'medium', 'low')),
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_marketing_roadmap_type ON __marketing_content_roadmap(content_type);
CREATE INDEX idx_marketing_roadmap_priority ON __marketing_content_roadmap(priority);
CREATE INDEX idx_marketing_roadmap_status ON __marketing_content_roadmap(status);
CREATE INDEX idx_marketing_roadmap_pg_id ON __marketing_content_roadmap(pg_id);
```

### 6. `__marketing_kpi_snapshots`

Snapshots periodiques des KPIs marketing pour suivi historique.

```sql
CREATE TABLE __marketing_kpi_snapshots (
  id                    serial PRIMARY KEY,
  snapshot_date         date NOT NULL UNIQUE,
  referring_domains     integer DEFAULT 0,
  total_backlinks       integer DEFAULT 0,
  backlinks_da30plus    integer DEFAULT 0,
  organic_traffic       integer DEFAULT 0,
  diagnostic_anchors    integer DEFAULT 0,
  indexed_pages         integer DEFAULT 0,
  avg_position          numeric(5,2),
  content_coverage_pct  numeric(5,2),
  outreach_sent         integer DEFAULT 0,
  outreach_accepted     integer DEFAULT 0,
  guest_posts_published integer DEFAULT 0,
  notes                 text,
  created_at            timestamptz DEFAULT now()
);
```

## RLS

Toutes les tables ont RLS active. Le backend utilise la `service_role` key qui bypass RLS (pattern existant).

```sql
ALTER TABLE __marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE __marketing_backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE __marketing_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE __marketing_guest_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE __marketing_content_roadmap ENABLE ROW LEVEL SECURITY;
ALTER TABLE __marketing_kpi_snapshots ENABLE ROW LEVEL SECURITY;
```

## Relations

```
__marketing_campaigns (1) ──→ (N) __marketing_backlinks
__marketing_campaigns (1) ──→ (N) __marketing_outreach
__marketing_campaigns (1) ──→ (N) __marketing_guest_posts
__marketing_outreach  (1) ──→ (1) __marketing_guest_posts

__marketing_content_roadmap.pg_id             ──→ pieces_gamme.pg_id
__marketing_content_roadmap.blog_advice_id    ──→ __blog_advice.ba_id
__marketing_content_roadmap.seo_observable_id ──→ __seo_observable.id
__marketing_content_roadmap.seo_reference_id  ──→ __seo_reference.id
```
