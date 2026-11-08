-- =============================================================================
-- Fixture — tables du sélecteur de véhicules (auto_marque, auto_modele,
-- auto_type) dans l'état d'accès de la PROD avant
-- 20261026_vehicle_api_definer_reads.sql
--
-- Banc : scripts/db/test-vehicle-api-definer-reads.sh, sur l'image
-- supabase/postgres (rôles, appartenances et privilèges par défaut Supabase).
-- Ce n'est PAS une copie des données : les colonnes et leur ordre reprennent les
-- réponses PostgREST enregistrées (select=*) ; les données sont synthétiques et
-- déterministes. Types connus du dépôt : modele_marque_id smallint (erreur 22003
-- enregistrée), marque_id smallint et modele_id integer
-- (20260907_tecdoc_api_surface_lockdown.sql, resolve_type_id_remap),
-- type_id et type_modele_id text.
--
-- État d'accès reproduit : RLS active avec politique service_role
-- (20251231_enable_rls_auto_type.sql, 20260423 l. 174), lecture retirée à anon et
-- authenticated (20260423 l. 242-249). row_security=off est posé par le banc au
-- niveau base.
--
-- S'applique en `postgres` sur une base jetable. Ne cible JAMAIS la production.
-- =============================================================================

CREATE TABLE public.auto_marque (
  marque_id              smallint PRIMARY KEY,
  marque_alias           text,
  marque_name            text,
  marque_name_url        text,
  marque_name_meta       text,
  marque_name_meta_title text,
  marque_logo            text,
  marque_wall            text,
  marque_relfollow       integer,
  marque_sitemap         integer,
  marque_display         integer,
  marque_sort            integer,
  marque_top             integer
);

CREATE TABLE public.auto_modele (
  modele_id          integer PRIMARY KEY,
  modele_parent      integer,
  modele_marque_id   smallint,
  modele_mdg_id      integer,
  modele_alias       varchar(40),
  modele_name        text,
  modele_name_url    text,
  modele_name_meta   text,
  modele_ful_name    text,
  modele_month_from  integer,
  modele_year_from   integer,
  modele_month_to    integer,
  modele_year_to     integer,
  modele_body        text,
  modele_pic         text,
  modele_relfollow   integer,
  modele_sitemap     integer,
  modele_display     integer,
  modele_display_v1  integer,
  modele_sort        integer,
  modele_is_new      integer
);
CREATE INDEX auto_modele_marque_idx ON public.auto_modele (modele_marque_id);

CREATE TABLE public.auto_type (
  type_id           text PRIMARY KEY,
  type_tmf_id       text,
  type_alias        text,
  type_modele_id    text,
  type_marque_id    text,
  type_name         text,
  type_name_url     text,
  type_name_meta    text,
  type_engine       text,
  type_fuel         text,
  type_power_ps     text,
  type_power_kw     text,
  type_liter        text,
  type_month_from   text,
  type_year_from    text,
  type_month_to     text,
  type_year_to      text,
  type_body         text,
  type_relfollow    text,
  type_display      text,
  type_sort         text,
  type_id_i         integer,
  type_tmf_id_i     integer,
  type_modele_id_i  integer,
  type_marque_id_i  integer,
  type_month_from_i integer,
  type_year_from_i  integer,
  type_month_to_i   integer,
  type_year_to_i    integer
);
CREATE INDEX auto_type_modele_idx ON public.auto_type (type_modele_id);

-- --- Marques -------------------------------------------------------------------
-- Couvre : marque masquée (display 0), marque sans modèle, casse et accents pour
-- le tri, identifiant à la borne smallint.
INSERT INTO public.auto_marque VALUES
  (1,     'alfa-romeo',  'ALFA ROMEO',   'alfa-romeo',  'Alfa Romeo',  'Pièces Alfa Romeo',  'alfa.webp',  NULL,       1, 1, 1, 1, 1),
  (2,     'audi',        'AUDI',         'audi',        'Audi',        'Pièces Audi',        'audi.webp',  'audi.jpg', 1, 1, 1, 2, 1),
  (3,     'citroen',     'CITROËN',      'citroen',     'Citroën',     'Pièces Citroën',     'cit.webp',   NULL,       1, 1, 1, 3, 0),
  (4,     'citroen-ds',  'CITROEN DS',   'citroen-ds',  'DS',          'Pièces DS',          'ds.webp',    NULL,       1, 1, 1, 4, 0),
  (5,     'bmw',         'BMW',          'bmw',         'BMW',         'Pièces BMW',         'bmw.webp',   NULL,       1, 1, 1, 5, 1),
  (6,     'bmw-alpina',  'bmw alpina',   'bmw-alpina',  'Alpina',      'Pièces Alpina',      'alp.webp',   NULL,       0, 0, 1, 6, 0),
  (7,     'masquee',     'ZZ MASQUÉE',   'masquee',     'Masquée',     'Masquée',            'zz.webp',    NULL,       0, 0, 0, 7, 0),
  (8,     'sans-modele', 'SANS MODELE',  'sans-modele', 'Sans modèle', 'Sans modèle',        'sm.webp',    NULL,       1, 1, 1, 8, 0),
  (32767, 'borne',       'BORNE SMALLINT','borne',      'Borne',       'Borne',              'b.webp',     NULL,       1, 1, 1, 9, 0);

-- --- Modèles -------------------------------------------------------------------
-- Marque 1 : modèle masqué avec types (103), modèle sans type (104), modèle dont
-- tous les types sont masqués (105), homonymes (101/106), années vides ou nulles
-- (108), alias contenant une virgule (107, sans type).
INSERT INTO public.auto_modele VALUES
  (101, 0, 1, 10, 'mito',        'MITO',        'mito',        NULL, 'ALFA ROMEO MITO',      9, 2008, 12,   2018, 'Berline', 'mito.webp', 1, 1, 1, 1,    1, 0),
  (102, 0, 1, 11, 'giulietta',   'GIULIETTA',   'giulietta',   'G',  'ALFA ROMEO GIULIETTA', 4, 2010, NULL, NULL, 'Berline', 'giu.webp',  1, 1, 1, NULL, 2, 1),
  (103, 0, 1, 12, '147',         '147',         '147',         NULL, 'ALFA ROMEO 147',       1, 2000, 12,   2010, NULL,      '147.webp',  0, 0, 0, 0,    3, 0),
  (104, 0, 1, 13, 'sans-types',  'SANS TYPES',  'sans-types',  NULL, 'ALFA ROMEO SANS',      1, 2020, NULL, NULL, NULL,      'st.webp',   1, 1, 1, 1,    4, 0),
  (105, 0, 1, 14, 'giulia',      'GIULIA',      'giulia',      NULL, 'ALFA ROMEO GIULIA',    1, 2016, NULL, NULL, 'Berline', 'gia.webp',  1, 1, 1, 1,    5, 1),
  (106, 0, 1, 10, 'mito-ii',     'MITO',        'mito-ii',     NULL, 'ALFA ROMEO MITO II',   1, 2016, NULL, NULL, 'Berline', 'mito2.webp',1, 1, 1, 1,    6, 0),
  (107, 0, 1, 15, 'a,b',         'A,B',         'a-b',         NULL, 'ALFA ROMEO A,B',       1, 1990, 12,   1995, NULL,      'ab.webp',   1, 1, 1, 1,    7, 0),
  (108, 0, 1, 16, 'giulia-sprint','GIULIA',     'giulia-sprint',NULL,'ALFA ROMEO GIULIA SP', 1, 1962, 12,   1977, 'Coupé',   'gs.webp',   1, 1, 1, 1,    8, 0),
  (501, 0, 5, 50, 'serie-1',     'SERIE 1',     'serie-1',     NULL, 'BMW SERIE 1',          1, 2004, NULL, NULL, NULL,      's1.webp',   1, 1, 1, 1,    1, 0),
  (502, 0, 5, 51, 'serie-3',     'SERIE 3',     'serie-3',     NULL, 'BMW SERIE 3',          1, 1990, NULL, NULL, NULL,      's3.webp',   1, 1, 1, 1,    2, 1),
  (503, 0, 5, 52, 'serie-5',     'série 5',     'serie-5',     NULL, 'BMW SERIE 5',          1, 1995, NULL, NULL, NULL,      's5.webp',   1, 1, 1, 1,    3, 0),
  (504, 0, 5, 53, 'z1',          'Z1',          'z1',          NULL, 'BMW Z1',               1, 1989, 12,   1991, NULL,      'z1.webp',   0, 0, 0, 0,    4, 0),
  (601, 0, 6, 60, 'b3',          'B3',          'b3',          NULL, 'ALPINA B3',            1, 2013, NULL, NULL, NULL,      'b3.webp',   1, 1, 1, 1,    1, 0),
  (701, 0, 7, 70, 'cache',       'CACHE',       'cache',       NULL, 'MASQUEE CACHE',        1, 2001, NULL, NULL, NULL,      'c.webp',    1, 1, 1, 1,    1, 0),
  (90001, 0, 32767, 90, 'borne', 'BORNE',       'borne',       NULL, 'BORNE',                1, 2021, NULL, NULL, NULL,      'b.webp',    1, 1, 1, 1,    1, 0);

-- --- Types ---------------------------------------------------------------------
-- Une ligne écrite par motorisation remarquable, puis 1 200 types générés pour la
-- marque 5 (pagination de 1 000 lignes de l'étape 2, plafond db-max-rows).
INSERT INTO public.auto_type
  (type_id, type_tmf_id, type_alias, type_modele_id, type_marque_id, type_name, type_name_url,
   type_name_meta, type_engine, type_fuel, type_power_ps, type_power_kw, type_liter,
   type_month_from, type_year_from, type_month_to, type_year_to, type_body, type_relfollow,
   type_display, type_sort, type_id_i, type_tmf_id_i, type_modele_id_i, type_marque_id_i,
   type_month_from_i, type_year_from_i, type_month_to_i, type_year_to_i)
VALUES
  ('10101', '1', '1-4-tb',     '101', '1', '1.4 TB',      '1-4-tb',     NULL, '955A2000', 'Essence', '120', '88', '1.4', '9', '2008', '12', '2018', 'Berline', '1', '1', '1', 10101, 1, 101, 1, 9, 2008, 12,   2018),
  ('10102', '1', '1-6-jtdm',   '101', '1', '1.6 JTDM',    '1-6-jtdm',   NULL, '955A3000', 'Diesel',  '120', '88', '1.6', '9', '2008', NULL, NULL,   'Berline', '1', '1', '2', 10102, 1, 101, 1, 9, 2008, NULL, NULL),
  ('10103', '1', '1-3-jtdm',   '101', '1', '1.3 JTDM',    '1-3-jtdm',   NULL, NULL,       'Diesel',  '90',  '66', '1.3', '1', '2010', '6',  '2014', 'Berline', '1', '0', '3', 10103, 1, 101, 1, 1, 2010, 6,    2014),
  ('10201', '1', '2-0-jtdm',   '102', '1', '2.0 JTDM',    '2-0-jtdm',   NULL, '940A4000', 'Diesel',  '170', '125','2.0', '4', '2010', NULL, '',     'Berline', '1', '1', '1', 10201, 1, 102, 1, 4, 2010, NULL, NULL),
  ('10202', '1', '1-750-tbi',  '102', '1', '1750 TBi',    '1750-tbi',   NULL, NULL,       'Essence', '235', '173','1.7', '4', '2010', NULL, NULL,   'Berline', '1', '1', '2', 10202, 1, 102, 1, 4, 2010, NULL, NULL),
  ('10301', '1', '1-9-jtd',    '103', '1', '1.9 JTD',     '1-9-jtd',    NULL, NULL,       'Diesel',  '115', '85', '1.9', '1', '2000', '12', '2010', NULL,      '1', '1', '1', 10301, 1, 103, 1, 1, 2000, 12,   2010),
  ('10501', '1', '2-2-jtd',    '105', '1', '2.2 JTD',     '2-2-jtd',    NULL, NULL,       'Diesel',  '150', '110','2.2', '1', '2016', NULL, NULL,   'Berline', '1', '0', '1', 10501, 1, 105, 1, 1, 2016, NULL, NULL),
  ('10502', '1', '2-0-t',      '105', '1', '2.0 T',       '2-0-t',      NULL, NULL,       'Essence', '200', '147','2.0', '1', '2016', NULL, NULL,   'Berline', '1', '0', '2', 10502, 1, 105, 1, 1, 2016, NULL, NULL),
  ('10601', '1', '1-4-tb-ii',  '106', '1', '1.4 TB',      '1-4-tb-ii',  NULL, NULL,       'GPL',     '120', '88', '1.4', '1', '2016', NULL, NULL,   'Berline', '1', '1', '1', 10601, 1, 106, 1, 1, 2016, NULL, NULL),
  ('10801', '1', '1-6-sprint', '108', '1', '1.6 Sprint',  '1-6-sprint', NULL, NULL,       'Essence', '102', '75', '1.6', '1', NULL,   '12', '1977', 'Coupé',   '1', '1', '1', 10801, 1, 108, 1, 1, NULL, 12,   1977),
  ('10802', '1', '1-3-sprint', '108', '1', '1.3 Sprint',  '1-3-sprint', NULL, NULL,       'Essence', '90',  '66', '1.3', '1', '',     '12', '1972', 'Coupé',   '1', '1', '2', 10802, 1, 108, 1, 1, NULL, 12,   1972),
  ('10803', '1', '1-3-ti',     '108', '1', '1.3 TI',      '1-3-ti',     NULL, NULL,       'Essence', '89',  '65', '1.3', '1', '1965', '12', 'abc',  'Coupé',   '1', '1', '3', 10803, 1, 108, 1, 1, 1965, 12,   NULL),
  ('50401', '1', 'z1-2-5',     '504', '5', '2.5',         'z1-2-5',     NULL, NULL,       'Essence', '170', '125','2.5', '1', '1989', '12', '1991', NULL,      '1', '1', '1', 50401, 1, 504, 5, 1, 1989, 12,   1991),
  ('60101', '1', '320d-a',     '601', '6', '320d',        '320d-a',     NULL, 'N47',      'Diesel',  '163', '120','2.0', '1', '2013', NULL, NULL,   NULL,      '1', '1', '3', 60101, 1, 601, 6, 1, 2013, NULL, NULL),
  ('60102', '1', '320d-b',     '601', '6', '320d',        '320d-b',     NULL, 'B47',      'Diesel',  '190', '140','2.0', '1', '2015', NULL, NULL,   NULL,      '1', '1', '1', 60102, 1, 601, 6, 1, 2015, NULL, NULL),
  ('60103', '1', '320d-c',     '601', '6', '320d',        '320d-c',     NULL, NULL,       'Diesel',  '150', '110','2.0', '1', '2013', NULL, NULL,   NULL,      '1', '1', '2', 60103, 1, 601, 6, 1, 2013, NULL, NULL),
  ('60104', '1', 'b3-3-0',     '601', '6', 'B3 3.0',      'b3-3-0',     NULL, NULL,       'Essence', '410', '301','3.0', '1', '2013', NULL, NULL,   NULL,      '1', '0', '4', 60104, 1, 601, 6, 1, 2013, NULL, NULL),
  ('60105', '1', 'b3-s',       '601', '6', 'b3 s',        'b3-s',       NULL, NULL,       'Essence', '370', '272','3.0', '1', '2013', NULL, NULL,   NULL,      '1', '1', '5', 60105, 1, 601, 6, 1, 2013, NULL, NULL),
  ('70101', '1', 'cache-1-6',  '701', '7', '1.6',         'cache-1-6',  NULL, NULL,       'Essence', '100', '74', '1.6', '1', '2001', NULL, NULL,   NULL,      '1', '1', '1', 70101, 1, 701, 7, 1, 2001, NULL, NULL),
  ('9000101','1', 'borne-1-0', '90001','32767','1.0',     'borne-1-0',  NULL, NULL,       'Electrique','80','59', '0.0', '1', '2021', NULL, NULL,   NULL,      '1', '1', '1', 9000101, 1, 90001, 32767, 1, 2021, NULL, NULL);

INSERT INTO public.auto_type
  (type_id, type_tmf_id, type_alias, type_modele_id, type_marque_id, type_name, type_name_url,
   type_engine, type_fuel, type_power_ps, type_power_kw, type_liter, type_month_from,
   type_year_from, type_month_to, type_year_to, type_relfollow, type_display, type_sort,
   type_id_i, type_tmf_id_i, type_modele_id_i, type_marque_id_i, type_month_from_i,
   type_year_from_i)
SELECT (500000 + g)::text, '1', 'gen-' || g, (501 + g % 3)::text, '5',
       'T' || (g % 50), 'gen-' || g,
       CASE WHEN g % 4 = 0 THEN NULL ELSE 'M' || (g % 9) END,
       CASE g % 3 WHEN 0 THEN 'Diesel' WHEN 1 THEN 'Essence' ELSE 'Hybride' END,
       (70 + g % 200)::text, (51 + g % 150)::text, '2.0', '1',
       CASE WHEN g % 97 = 0 THEN NULL ELSE (1990 + g % 30)::text END,
       '12',
       CASE WHEN g % 7 = 0 THEN NULL WHEN g % 11 = 0 THEN '' ELSE (1995 + g % 30)::text END,
       '1',
       CASE WHEN g % 13 = 0 THEN '0' ELSE '1' END,
       (g % 17)::text,
       500000 + g, 1, 501 + g % 3, 5, 1, 1990 + g % 30
FROM generate_series(1, 1200) AS g;

ANALYZE public.auto_marque, public.auto_modele, public.auto_type;

-- --- État d'accès PROD ---------------------------------------------------------
ALTER TABLE public.auto_marque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_modele ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_type   ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_marque_service_role_all ON public.auto_marque AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY auto_modele_service_role_all ON public.auto_modele AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY auto_type_service_role_all   ON public.auto_type   AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.auto_marque FROM anon, authenticated;
REVOKE ALL ON public.auto_modele FROM anon, authenticated;
REVOKE ALL ON public.auto_type   FROM anon, authenticated;
