-- Schema du banc de rejeu JETABLE. Calque sur le DDL reel de MassDoc PROD
-- (information_schema, releve 2026-09-08). N'est JAMAIS applique a PROD.
CREATE SCHEMA IF NOT EXISTS tecdoc_raw;
CREATE SCHEMA IF NOT EXISTS tecdoc_map;

-- t400 : 8 colonnes metier + 5 colonnes de provenance.
-- `_loaded_at DEFAULT now()` est reproduit a l'identique : c'est le defaut que le
-- loader historique neutralisait en poussant un NULL explicite.
CREATE TABLE IF NOT EXISTS tecdoc_raw.t400 (
  col_1 text, col_2 text, col_3 text, col_4 text,
  col_5 text, col_6 text, col_7 text, col_8 text,
  _source_filename text,
  _batch_id        text,
  _loaded_at       timestamptz DEFAULT now(),
  _source_row_no   integer,
  _raw_hash        text
);
CREATE INDEX IF NOT EXISTS t400_batch_idx ON tecdoc_raw.t400 (_batch_id);
CREATE INDEX IF NOT EXISTS t400_dlnr_idx  ON tecdoc_raw.t400 (col_2);

CREATE TABLE IF NOT EXISTS tecdoc_raw.t232 (
  artnr text NOT NULL, dlnr text NOT NULL, sa text, sortnr text, lkz text,
  exclude_flag text, bildnr text NOT NULL, dokumentenart text, losch_flag text,
  _source_filename text, _batch_id text, _loaded_at text,
  _source_row_no text, _raw_hash text
);
CREATE INDEX IF NOT EXISTS t232_batch_idx ON tecdoc_raw.t232 (_batch_id);

-- Registres d'identite proteges (ADR : jamais de renumerotation).
CREATE TABLE IF NOT EXISTS tecdoc_map.type_id_remap          (old_id text PRIMARY KEY, new_id text NOT NULL);
CREATE TABLE IF NOT EXISTS tecdoc_map.article_registry       (piece_id bigint PRIMARY KEY, source_artnr text, source_dlnr text);
CREATE TABLE IF NOT EXISTS tecdoc_map.linkage_target_registry(id bigint PRIMARY KEY, target_key text);
CREATE TABLE IF NOT EXISTS tecdoc_map.gamme_registry         (pg_id_source text PRIMARY KEY, pg_id integer);
CREATE TABLE IF NOT EXISTS tecdoc_map.modele_id_remap        (old_id text PRIMARY KEY, new_id text NOT NULL);
CREATE TABLE IF NOT EXISTS tecdoc_map.pg_id_remap            (old_id text PRIMARY KEY, new_id text NOT NULL);
