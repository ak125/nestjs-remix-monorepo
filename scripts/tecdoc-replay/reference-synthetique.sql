-- Base de REFERENCE synthetique du banc de rejeu.
--
-- Le banc doit pouvoir tourner en CI sans MassDoc PROD et sans aucun secret. Cette
-- base joue le role de « ce qui est servi aujourd'hui » face auquel les controles
-- d'identite, de conservation et de reconciliation sont eprouves.
--
-- Les volumes sont minuscules et FIGES : les empreintes de `manifeste-synthetique.json`
-- en decoulent. Modifier une ligne ici sans regenerer le manifeste fait echouer le banc
-- — c'est voulu, c'est exactement ce que le controle de conservation doit detecter.
CREATE DATABASE reference;
\c reference

CREATE SCHEMA IF NOT EXISTS tecdoc_raw;
CREATE SCHEMA IF NOT EXISTS tecdoc_map;

CREATE TABLE tecdoc_raw.t400 (
  col_1 text, col_2 text, col_3 text, col_4 text,
  col_5 text, col_6 text, col_7 text, col_8 text,
  _source_filename text, _batch_id text, _loaded_at timestamptz DEFAULT now(),
  _source_row_no integer, _raw_hash text
);

CREATE TABLE public.auto_type    (type_id_i integer PRIMARY KEY);
CREATE TABLE public.auto_modele  (modele_id integer PRIMARY KEY, modele_is_new text);
CREATE TABLE public.pieces       (piece_id integer PRIMARY KEY, piece_year text, piece_display boolean);
CREATE TABLE public.pieces_gamme (pg_id integer PRIMARY KEY);

CREATE TABLE tecdoc_map.type_id_remap           (old_id text PRIMARY KEY, new_id text NOT NULL);
CREATE TABLE tecdoc_map.modele_id_remap         (old_id text PRIMARY KEY, new_id text NOT NULL);
CREATE TABLE tecdoc_map.pg_id_remap             (old_id text PRIMARY KEY, new_id text NOT NULL);
CREATE TABLE tecdoc_map.gamme_registry          (pg_id_source text PRIMARY KEY, pg_id integer);
CREATE TABLE tecdoc_map.linkage_target_registry (id bigint PRIMARY KEY, target_key text);
CREATE TABLE tecdoc_map.article_registry        (piece_id bigint PRIMARY KEY, source_artnr text, source_dlnr text);

INSERT INTO public.auto_type    SELECT generate_series(60000, 60009);
INSERT INTO public.auto_modele  SELECT generate_series(1, 5), '1';
INSERT INTO public.pieces       SELECT g, '2025', (g <= 5) FROM generate_series(1, 8) g;
INSERT INTO public.pieces_gamme SELECT generate_series(60000, 60004);

INSERT INTO tecdoc_map.type_id_remap  VALUES ('100001','60001'), ('100002','60002');
INSERT INTO tecdoc_map.gamme_registry VALUES ('2', 60000), ('10', 60001), ('1000', 60002);
INSERT INTO tecdoc_map.linkage_target_registry SELECT g, 'cible_'||g FROM generate_series(1, 4) g;
INSERT INTO tecdoc_map.article_registry VALUES (1,'H1 656','4523'), (2,'H1 657','4523'), (3,'X','30');
