-- Mandat EN — fragments de suffixe du H1 actuel (__seo_gamme_car_switch,
-- alias 2), dans l'ordre de lecture PostgREST sans ORDER BY (ordre physique,
-- comme loadCompSwitches). Lecture seule.
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
SELECT sgcs_pg_id, sgcs_id, sgcs_alias, replace(replace(sgcs_content, E'\t', ' '), E'\n', ' ') AS content
  FROM __seo_gamme_car_switch WHERE sgcs_alias = '2';
