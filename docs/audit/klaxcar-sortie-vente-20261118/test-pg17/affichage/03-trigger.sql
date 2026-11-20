CREATE OR REPLACE FUNCTION public.update_pieces_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.search_vector :=
        to_tsvector('french', coalesce(NEW.piece_name, '')) ||
        to_tsvector('french', coalesce(NEW.piece_des, '')) ||
        to_tsvector('french', coalesce(NEW.piece_ref, '')) ||
        to_tsvector('french', coalesce(NEW.piece_fil_name, ''));
    RETURN NEW;
END;
$function$

;
CREATE TRIGGER pieces_search_vector_update BEFORE INSERT OR UPDATE ON public.pieces FOR EACH ROW EXECUTE FUNCTION update_pieces_search_vector()
;
