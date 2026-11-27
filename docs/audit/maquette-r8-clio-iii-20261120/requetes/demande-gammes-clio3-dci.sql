-- Complément n° 14 au mandat DS (décision 157) : requêtes « clio 3 … dci » de __seo_keywords, regroupées par gamme
-- (pg_id), avec volume cumulé. SELECT seulement. Sert à vérifier que les gammes les plus demandées ont un lien
-- dans le HTML servi de la fiche R8 19052.
SELECT k.pg_id,
       pg.pg_name,
       pg.pg_alias,
       count(*)              AS mots_cles,
       sum(coalesce(k.volume, 0)) AS volume,
       (array_agg(k.keyword ORDER BY k.volume DESC NULLS LAST))[1:3] AS exemples
FROM __seo_keywords k
LEFT JOIN pieces_gamme pg ON pg.pg_id::text = k.pg_id::text
WHERE k.keyword_normalized ~ 'clio (3|iii)' AND k.keyword_normalized ~ 'dci'
GROUP BY k.pg_id, pg.pg_name, pg.pg_alias
ORDER BY volume DESC NULLS LAST, mots_cles DESC;
