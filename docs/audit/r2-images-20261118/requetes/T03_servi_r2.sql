-- T03 : pour chaque pièce vendable, existe-t-il une relation servie en R2 ?
-- Exécuté par lots de 8 000 piece_id (:ids), 53 lots, STATEMENT_TIMEOUT_MS=58000, lecture seule.
\copy (select v.id, exists (select 1 from pieces_relation_type r join auto_type t on t.type_id_i=r.rtp_type_id join pieces_gamme g on g.pg_id=r.rtp_pg_id where r.rtp_piece_id=v.id and t.type_display='1' and g.pg_display='1') from unnest(:'ids'::int[]) v(id)) to '<DIR>/data/served/<lot>.csv' csv
