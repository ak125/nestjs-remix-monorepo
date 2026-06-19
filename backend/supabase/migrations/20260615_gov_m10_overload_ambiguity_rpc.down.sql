-- Rollback for 20260615_gov_m10_overload_ambiguity_rpc.sql
-- Drops the read-only introspection RPC. The rpc-overload-ambiguity runner then
-- reports health_status=UNKNOWN (RPC absent) instead of consuming stale data.
drop function if exists public.__gov_m10_overload_ambiguity();
