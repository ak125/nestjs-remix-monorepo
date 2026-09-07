-- Fixture synthetique pour scripts/tecdoc-mysql-to-csv.py
-- Aucune donnee TecDoc reelle : valeurs inventees, couvrant les cas limites du parseur.
-- Cas couverts : NULL, chaine vide, apostrophe echappee par backslash, apostrophe
-- doublee (echappement MySQL), backslash litteral, virgule dans une chaine (force le
-- quoting CSV), guillemet double (force le quoting + doublement CSV), \n \r \t,
-- date 0000-00-00 conservee telle quelle, valeurs numeriques non quotees,
-- INSERT multi-lignes, second INSERT (le compteur _source_row_no ne repart pas a 1),
-- variante INSERT IGNORE, et presence/absence de la liste de colonnes.
INSERT IGNORE INTO `999` (`A`, `B`, `C`, `D`) VALUES
(1, 'simple', '', NULL),
(2, 'avec, une virgule', 'avec "guillemets"', 'fin'),
(3, 'apostrophe\' backslash', 'double''''quote', 'x'),
(4, 'anti\\slash', 'tab\there', 'nl\nici'),
(5, '0000-00-00', 'retour\rchariot', NULL);
INSERT INTO `999` VALUES
(6, 'second statement', 'compteur continue', ''),
(7, NULL, NULL, NULL);
