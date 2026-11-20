-- Fixture de scripts/db/test-supplier-fiche-columns.sh
-- Forme relevée en lecture seule le 2026-11-18 sur la base partagée : colonnes,
-- clés, CHECK, RLS, politiques et droits de ___xtr_supplier,
-- ___xtr_supplier_link_pm et supplier_price_profiles. Données synthétiques :
-- noms de fournisseurs fictifs, aucune ligne réelle.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Comme Supabase : toute fonction nouvelle du schéma est exécutable par les
-- trois rôles tant que sa migration ne le révoque pas.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.___xtr_supplier (
  spl_id      text PRIMARY KEY,
  spl_name    text,
  spl_alias   text,
  spl_display text,
  spl_sort    text
);
ALTER TABLE public.___xtr_supplier ENABLE ROW LEVEL SECURITY;
CREATE POLICY ___xtr_supplier_service_role_all ON public.___xtr_supplier
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.___xtr_supplier FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.___xtr_supplier TO service_role;

CREATE TABLE public.___xtr_supplier_link_pm (
  slpm_id      text PRIMARY KEY,
  slpm_pm_id   text,
  slpm_spl_id  text,
  slpm_display text
);
ALTER TABLE public.___xtr_supplier_link_pm ENABLE ROW LEVEL SECURITY;
CREATE POLICY ___xtr_supplier_link_pm_service_role_all ON public.___xtr_supplier_link_pm
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.___xtr_supplier_link_pm FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.___xtr_supplier_link_pm TO service_role;

CREATE TABLE public.supplier_price_profiles (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id    text NOT NULL,
  scope_level    text NOT NULL CHECK (scope_level = ANY (ARRAY['SUPPLIER','BRAND','FAMILY','SUBFAMILY'])),
  scope_code     text,
  price_basis    text NOT NULL CHECK (price_basis = ANY (ARRAY['NET','BRUT','PUBLIC','NET_GROSSISTE'])),
  derivation     text NOT NULL CHECK (derivation = ANY (ARRAY['DIRECT_NET','REMISE_ON_BRUT','REMISE_ON_PUBLIC','MARGE_ON_NET'])),
  column_mapping jsonb NOT NULL,
  key_field      text NOT NULL CHECK (key_field = ANY (ARRAY['REF','EAN'])),
  version        bigint NOT NULL DEFAULT 1,
  effective_from timestamptz,
  effective_to   timestamptz,
  active         boolean NOT NULL DEFAULT true,
  created_by     text,
  change_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_price_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_price_profiles_service_role_all ON public.supplier_price_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.supplier_price_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.supplier_price_profiles TO service_role;

INSERT INTO public.___xtr_supplier VALUES
  ('1',  'FOURNISSEUR A', 'fournisseur-a', '1', '1'),
  ('26', 'PLATEFORME B',  'plateforme-b',  '1', '2'),
  ('71', 'PLATEFORME B ', 'pb',            '0', NULL);
INSERT INTO public.___xtr_supplier_link_pm VALUES
  ('1', '100', '26', '1'), ('2', '101', '26', '0');
INSERT INTO public.supplier_price_profiles
  (supplier_id, scope_level, price_basis, derivation, column_mapping, key_field, created_by)
VALUES ('71', 'SUPPLIER', 'NET', 'DIRECT_NET', '{"ref":"A"}', 'REF', 'fixture');
