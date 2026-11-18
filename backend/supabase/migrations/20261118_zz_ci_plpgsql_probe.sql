-- fichier de preuve temporaire, mandat CG, ne pas fusionner
-- (mandat CN : sonde CI du step « Compilation PL/pgSQL des blocs DO » de #2179 ;
--  reproduit le motif du run 44334611333 : IF x IS DISTINCT FROM CASE … THEN ;
--  doit échouer à la compilation ; retiré avant la fusion)
DO $$
DECLARE
  x text := 'a';
BEGIN
  IF x IS DISTINCT FROM CASE WHEN true THEN 'a' ELSE 'b' END THEN
    RAISE NOTICE 'jamais atteint';
  END IF;
END
$$;
