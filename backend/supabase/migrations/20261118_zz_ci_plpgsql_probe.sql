-- fichier de preuve temporaire, mandat CG, ne pas fusionner
-- (mandat CN : sonde CI du step « Compilation PL/pgSQL des blocs DO » de #2179 ;
--  bloc DO sain, sans aucun effet ; retiré avant la fusion)
DO $$
BEGIN
  IF 1 = 1 THEN
    RAISE NOTICE 'sonde plpgsql saine';
  END IF;
END
$$;
