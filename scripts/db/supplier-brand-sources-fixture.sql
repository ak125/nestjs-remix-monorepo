-- =============================================================================
-- Fixture du rejeu de 20261119_xtr_supplier_link_pm_sources.sql (mandat DQ).
-- Chargée APRÈS scripts/db/supplier-fiche-columns-fixture.sql et la migration
-- 20261118_xtr_supplier_fiche_columns.sql (spl_status existe déjà).
--
-- Forme relevée en lecture seule le 2026-11-19 : pieces_marque.pm_id integer,
-- pm_name text ; ___xtr_supplier_link_pm comme dans la fixture CH. Données
-- SYNTHÉTIQUES : les ids reprennent ceux de la base pour lisibilité des cas,
-- rien n'est importé (le CSV de découverte DL n'est pas lu).
-- =============================================================================

CREATE TABLE public.pieces_marque (
  pm_id   integer PRIMARY KEY,
  pm_name text
);
ALTER TABLE public.pieces_marque ENABLE ROW LEVEL SECURITY;
CREATE POLICY pieces_marque_service_role_all ON public.pieces_marque
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.pieces_marque FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pieces_marque TO service_role;

INSERT INTO public.pieces_marque VALUES
  (1080, 'CEVAM'), (3030, 'MEAT & DORIA'), (4120, 'SASIC'), (5000, 'MARQUE X');

INSERT INTO public.___xtr_supplier (spl_id, spl_name, spl_alias, spl_display, spl_sort, spl_type, spl_status, spl_supply_mode) VALUES
  ('15', 'BG',           'bg',     '1', NULL, 'plateforme',     'actif',       'flux_tendu'),
  ('20', 'CEVAM',        'cevam',  '1', NULL, 'marque_directe', 'actif',       'livraison_france'),
  ('21', 'CS',           'cs',     '1', NULL, 'plateforme',     'actif',       'flux_tendu'),
  ('45', 'MEAT & DORIA', 'md',     '1', NULL, 'marque_directe', 'actif',       NULL),
  ('52', 'OTTOGO',       'ottogo', '1', NULL, 'plateforme',     'actif',       'flux_tendu'),
  ('59', 'SASIC',        'sasic',  '1', NULL, 'marque_directe', 'actif',       NULL),
  ('72', 'EXADIS',       'exadis', '1', NULL, 'plateforme',     'actif',       'flux_tendu'),
  ('73', 'DCA',          'dca',    '1', NULL, 'plateforme',     'actif',       'flux_tendu'),
  ('90', 'ARCHIVÉ',      'arch',   '0', NULL, 'plateforme',     'archive',     NULL),
  ('91', 'À CONFIRMER',  'conf',   '1', NULL, 'plateforme',     'a_confirmer', NULL),
  ('92', 'SANS STATUT',  'nostat', '1', NULL, NULL,             NULL,          NULL);

INSERT INTO public.___xtr_supplier_link_pm VALUES
  ('40', '1080', '20', '1'),
  ('97', '3030', '45', '1'),
  ('73', '4120', '73', '1'),
  ('74', '4120', '15', '1'),
  ('75', '4120', '59', '1'),
  ('80', '5000', '52', '0'),
  ('81', '5000', '90', '1');
