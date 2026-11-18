-- Stub de test : rend le gabarit tel quel. Identique avant/après migration ; n'intervient pas dans les URL d'images.
CREATE FUNCTION public.process_seo_template(p_text text, a integer, b integer, c integer, d text, e text, f integer, g text, h text, i integer, j text, k text, l text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p_text $$;
