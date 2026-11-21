-- Mandat DG, 6.1 — gammes et vocabulaires de la règle de classement (marques auto, modèles, équipementiers).
\copy (select pg_id, pg_alias, pg_name, pg_display, pg_relfollow, pg_level, pg_sitemap from pieces_gamme) to 'pieces_gamme.tsv' with (format csv, delimiter E'\t', header)
\copy (select distinct lower(unaccent(marque_name)) from auto_marque where marque_name is not null) to 'vocab_marques_auto.txt'
\copy (select distinct lower(unaccent(modele_name)) from auto_modele where modele_name is not null) to 'vocab_modeles_auto.txt'
\copy (select distinct lower(unaccent(pm_name)) from pieces_marque where pm_name is not null) to 'vocab_equipementiers.txt'
