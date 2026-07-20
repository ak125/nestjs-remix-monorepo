-- Rollback for 20260705_gov_m11_attribution_columns_rpc.sql
-- Drops the read-only attribution-columns introspection RPC. No data touched.
drop function if exists public.__gov_m11_attribution_columns();
