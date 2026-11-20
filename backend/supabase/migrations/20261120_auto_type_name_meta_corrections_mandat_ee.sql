-- =============================================================================
-- Migration : corriger type_name_meta des motorisations classées « erreur »
-- Date      : 2026-11-20 (mandat EE, « 07 Pages et SEO »)
-- Scope     : public.auto_type.type_name_meta de 163 types affichés, et rien
--             d'autre. Ni type_name, ni modele_name_meta, ni marque_name_meta,
--             ni URL, ni alias. Aucun DELETE, aucun DDL.
-- Généré par docs/audit/mandat-ee-noms-motorisation-20261120/06-generer-migration.py
-- depuis classement.tsv (verdict « erreur ») moins exclusions-6-6.tsv (correction
-- qui rendrait identique un nom R8 ou un titre R2), restreint par le mandat EH aux
-- cas confirmés sur sources extérieures (decisions.tsv, migration = « affichage ») :
-- ne pas éditer à la main, régénérer.
-- =============================================================================
--
-- POURQUOI : type_name_meta alimente le <title>, la description et les mots-clés
-- des pages R8 (frontend/app/components/vehicle/r8/r8-transform.ts:133-148 et
-- build_vehicle_page_payload). Ces 163 valeurs nomment une autre motorisation
-- ou changent la désignation du moteur (EcoBoost -> Econetic, VVTi -> VTi,
-- 520 i -> 523 i…). Preuves par ligne : classement.tsv (mandat EE) et, pour les
-- sources extérieures, docs/audit/mandat-eh-sources-noms-motorisation-20261120/verdicts-sources.tsv.
--
-- APPLICATION : acte réservé à Marwane, après validation de la liste. Retirer
-- d'abord du bloc VALUES (ici ET dans le .down.sql) toute ligne non validée.
-- Workflow apply-supabase-migrations.yml : dry run, puis application, puis le
-- SELECT de contrôle en fin de fichier.
--
-- GARDE : chaque type doit exister et porter exactement la valeur erronée
-- relevée le 2026-11-20, ou déjà la valeur corrigée (rejeu). Toute autre valeur
-- lève une exception avant toute écriture : rien n'est écrit.
-- REJOUABLE : au second passage, 0 ligne écrite, 0 page invalidée.
-- CACHE : __vehicle_page_cache n'a de déclencheur que sur type_display ; les
-- pages R8 des types modifiés sont donc invalidées et reconstruites par la
-- fonction canonique mark_stale_with_followup_rebuild (INC-2026-007). Le cache
-- Redis applicatif (TTL 1 h, vehicle-rpc.service.ts) expire de lui-même.
-- RETOUR : 20261120_auto_type_name_meta_corrections_mandat_ee.down.sql remet les valeurs d'origine, avec la même garde.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $mandat_ee$
DECLARE
  v_ecarts   text;
  v_a_ecrire integer[];
  v_ecrits   integer;
  v_marques  integer;
BEGIN
  CREATE TEMP TABLE mandat_ee_corrections (
    type_id          integer PRIMARY KEY,
    valeur_erronee      text NOT NULL,
    valeur_corrigee      text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO mandat_ee_corrections (type_id, valeur_erronee, valeur_corrigee) VALUES
    (   68, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | C-MAX II | brut « 1.6 EcoBoost 16V » | R7
    (   69, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | C-MAX II | brut « 1.6 EcoBoost 16V » | R7
    (   74, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | GRAND C-MAX | brut « 1.6 EcoBoost 16V » | R7
    (   75, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | GRAND C-MAX | brut « 1.6 EcoBoost 16V » | R7
    ( 5530, '2.2 MRZ CD', '2.2 MZR-CD'),  -- MAZDA | 6 II Break | brut « 2.2 MZR-CD » | R7
    ( 5544, '250 TD', '250 D'),  -- MERCEDES | CLASSE E Break (S210) | brut « 250 D » | R2
    ( 6915, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | S-MAX I | brut « 1.6 EcoBoost 16V » | R7
    ( 6921, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | S-MAX I | brut « 2.0 EcoBoost 16V » | R7
    ( 6932, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | GALAXY III | brut « 1.6 EcoBoost 16V » | R7
    ( 6939, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | MONDEO IV | brut « 1.6 EcoBoost 16V » | R7
    ( 6951, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | MONDEO IV | brut « 2.0 EcoBoost 16V » | R7
    ( 7015, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | MONDEO IV Break | brut « 1.6 EcoBoost 16V » | R7
    ( 7019, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | MONDEO IV Break | brut « 2.0 EcoBoost 16V » | R7
    ( 7761, '1.3 VTi', '1.3 VVTi'),  -- TOYOTA | YARIS II | brut « 1.3 VVTi » | R7
    ( 7969, '1.6 Econetic 16V', '1.6 EcoBoost 16V'),  -- FORD | FOCUS III Berline | brut « 1.6 EcoBoost 16V » | R7
    ( 7970, '1.6 Econetic 16V', '1.6 EcoBoost 16V'),  -- FORD | FOCUS III Berline | brut « 1.6 EcoBoost 16V » | R7
    ( 8019, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | FOCUS III | brut « 1.6 EcoBoost 16V » | R7
    ( 8022, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | FOCUS III | brut « 1.6 EcoBoost 16V » | R7
    ( 8151, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | FOCUS III Break | brut « 1.6 EcoBoost 16V » | R7
    ( 8165, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | FOCUS III Break | brut « 1.6 EcoBoost 16V » | R7
    ( 8241, '1.7 TD', '1.8 TD'),  -- PEUGEOT | 205 II | brut « 1.8 TD » | R3
    ( 9030, '1.4', '1.3'),  -- DAEWOO | LANOS | brut « 1.3 » | R3
    ( 9129, '3.0 JTD', '3.0 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 3.0 D Multijet » | R7
    ( 9257, '1.33 VTi', '1.33 VVTi'),  -- TOYOTA | YARIS II | brut « 1.33 VVTi » | R7
    ( 9619, '1.4 16V', '1.4 T-Jet 16V'),  -- FIAT | GRANDE PUNTO | brut « 1.4 T-Jet 16V » | R2
    (10201, '2.0 JTD', '2.0 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.0 D Multijet » | R7
    (10205, '2.3 JTD Extralongo', '2.3 D Multijet Extralongo'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet Extralongo » | R7
    (10206, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (10209, '3.0 JTD', '3.0 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 3.0 D Multijet » | R7
    (10362, '1.9 TDi', '1.9 dTi'),  -- RENAULT | ESPACE III | brut « 1.9 dTi » | R7
    (11832, '523 i', '520 i'),  -- BMW | Série 5 (F10-F18) | brut « 520 i » | R2
    (11838, '535 d', '530 d'),  -- BMW | Série 5 (F10-F18) | brut « 530 d » | R2
    (12028, '2.3 JTD 4x4', '2.3 D Multijet 4x4'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.3 D Multijet 4x4 » | R7
    (12470, '320i', '328 i'),  -- BMW | Série 3 (F30-F35) | brut « 328 i » | R2,R7
    (14826, '313 CDI', '311 CDI'),  -- MERCEDES | SPRINTER 3-t (B903) | brut « 311 CDI » | R2
    (15490, '2.0 16V TDi TDCi', '2.0 DI-TDDI-TDCI'),  -- FORD | MONDEO III | brut « 2.0 DI-TDDI-TDCI » | R7
    (15491, '2.0 16V TDi TDCi', '2.0 DI- TDDI-TDCI'),  -- FORD | MONDEO III Break | brut « 2.0 DI- TDDI-TDCI » | R7
    (15492, '2.0 16V TDi TDCi', '2.0 TDDI-TDCI'),  -- FORD | MONDEO III | brut « 2.0 TDDI-TDCI » | R7
    (15493, '2.0 16V TDi TDCi', '2.0 TDDI-TDCI'),  -- FORD | MONDEO III Break | brut « 2.0 TDDI-TDCI » | R7
    (15957, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (19254, '1.0 VTi', '1.0 VVTi'),  -- TOYOTA | YARIS II | brut « 1.0 VVTi » | R7
    (19974, '2.2 JTD', '2.2 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.2 D Multijet » | R7
    (19975, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (19976, '3.0 JTD', '3.0 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 3.0 D Multijet » | R7
    (22475, '1.8 VTi', '1.8 VVTi (Phase 2)'),  -- TOYOTA | YARIS II | brut « 1.8 VVTi (Phase 2) » | R7
    (23358, '2.0 JTD', '2.0 D Multijet'),  -- LANCIA | PHEDRA | brut « 2.0 D Multijet » | R2,R7
    (24472, '2.0 TFSI Quattro', '2.0 TTS Quattro'),  -- AUDI | TT II | brut « 2.0 TTS Quattro » | R2,R7
    (26765, '260', '250 4-Matic'),  -- MERCEDES | CLASSE CLA Coupé (C117) | brut « 250 4-Matic » | R7
    (29566, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III | brut « 1.0 EcoBoost » | R7
    (29567, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III | brut « 1.0 EcoBoost » | R7
    (30438, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III Break | brut « 1.0 EcoBoost » | R7
    (30487, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III Break | brut « 1.0 EcoBoost » | R7
    (30845, '1.33 VTi', '1.33 VVTi'),  -- TOYOTA | YARIS II | brut « 1.33 VVTi » | R7
    (31094, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III Berline | brut « 1.0 EcoBoost » | R7
    (31095, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III Berline | brut « 1.0 EcoBoost » | R7
    (31115, '1.33 Dual-VTi', '1.33 Dual VVTi'),  -- TOYOTA | AURIS I | brut « 1.33 Dual VVTi » | R7
    (32741, '1.4 TB', '1.4 TURBO MultiAir'),  -- ALFA ROMEO | MITO | brut « 1.4 TURBO MultiAir » | R7
    (33251, '1.2 TSI', '1.2 TFSI'),  -- AUDI | A3 II | brut « 1.2 TFSI » | R7
    (33252, '1.2 TSI', '1.2 TFSI'),  -- AUDI | A3 II Sportback | brut « 1.2 TFSI » | R7
    (33778, 'xDrive 28 d', '20 d xDrive'),  -- BMW | X3 (F25) | brut « 20 d xDrive » | R2
    (47547, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | TOURNEO CONNECT II | brut « 1.6 EcoBoost 16V » | R7
    (53336, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | TOURNEO CONNECT II | brut « 1.0 EcoBoost » | R7
    (53394, '1.6 Econetic 16V', '1.6 EcoBoost 16V'),  -- FORD | TRANSIT CONNECT II | brut « 1.6 EcoBoost 16V » | R7
    (53399, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | TRANSIT CONNECT II | brut « 1.0 EcoBoost » | R7
    (55105, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | B-MAX | brut « 1.0 EcoBoost » | R7
    (55106, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | B-MAX | brut « 1.0 EcoBoost » | R7
    (55928, '2.8 CRDi 4WD', '2.8 CRD 4x4'),  -- JEEP | CHEROKEE IV | brut « 2.8 CRD 4x4 » | R7
    (57446, '3.0 JTD', '3.0 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 3.0 D Multijet » | R7
    (58546, '1.6 Econetic', '1.6 EcoBoost 16V'),  -- FORD | KUGA II | brut « 1.6 EcoBoost 16V » | R7
    (58967, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FIESTA VI | brut « 1.0 EcoBoost » | R7
    (58968, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FIESTA VI | brut « 1.0 EcoBoost » | R7
    (59492, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | B-MAX | brut « 1.0 EcoBoost » | R7
    (59494, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | GALAXY III | brut « 2.0 EcoBoost 16V » | R7
    (59495, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | S-MAX I | brut « 2.0 EcoBoost 16V » | R7
    (59928, '3.0 JTD', '3.0 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 3.0 D Multijet » | R7
    (61907, 'sDrive 18 i', '20 i sDrive'),  -- BMW | X3 (F25) | brut « 20 i sDrive » | R2
    (65057, '1.6 BlueHDi', '1.6 HDi-BlueHDi'),  -- CITROËN | BERLINGO II - BERLINGO MULTISPACE (B9) | brut « 1.6 HDi-BlueHDi » | R2
    (65090, '1.2 VTi', '1.2 THP'),  -- CITROËN | C3 II | brut « 1.2 THP » | R2,R7
    (65167, '1.2 VTi', '1.2 THP'),  -- CITROËN | DS3 | brut « 1.2 THP » | R2,R7
    (65168, '1.6 HDi', '1.6 BlueHDi'),  -- CITROËN | DS3 | brut « 1.6 BlueHDi » | R2,R7
    (65173, '1.2 VTi', '1.2 THP'),  -- CITROËN | DS3 Décapotable | brut « 1.2 THP » | R2,R7
    (65963, '1.6 JTD', '1.6 D Multijet'),  -- FIAT | DOBLO Cargo II | brut « 1.6 D Multijet » | R7
    (65967, '1.6 JTD', '1.6 D Multijet'),  -- FIAT | DOBLO II | brut « 1.6 D Multijet » | R7
    (65972, '2.2 JTD', '2.2 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.2 D Multijet » | R7
    (65973, '2.2 JTD', '2.2 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.2 D Multijet » | R7
    (65974, '2.2 JTD', '2.2 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.2 D Multijet » | R7
    (65975, '2.2 JTD', '2.2 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.2 D Multijet » | R7
    (65978, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.3 D Multijet » | R7
    (65979, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.3 D Multijet » | R7
    (65980, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.3 D Multijet » | R7
    (65981, '2.3 JTD 4x4', '2.3 D Multijet 4x4'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.3 D Multijet 4x4 » | R7
    (65982, '2.3 JTD 4x4', '2.3 D Multijet 4x4'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 2.3 D Multijet 4x4 » | R7
    (65983, '3.0 JTD 4x4', '3.0 D Multijet 4x4'),  -- FIAT | DUCATO V Fourgon (250-290) | brut « 3.0 D Multijet 4x4 » | R7
    (66132, '1.3 JTD', '1.3 D Multijet'),  -- FIAT | 500 | brut « 1.3 D Multijet » | R7
    (66324, '2.2 JTD', '2.2 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.2 D Multijet » | R7
    (66325, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (66326, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (66327, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (66328, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (66329, '2.3 JTD', '2.3 D Multijet'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet » | R7
    (66330, '2.3 JTD 4x4', '2.3 D Multijet 4x4'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet 4x4 » | R7
    (66331, '2.3 JTD 4x4', '2.3 D Multijet 4x4'),  -- FIAT | DUCATO V (250) | brut « 2.3 D Multijet 4x4 » | R7
    (66332, '3.0 JTD 4x4', '3.0 D Multijet 4x4'),  -- FIAT | DUCATO V (250) | brut « 3.0 D Multijet 4x4 » | R7
    (66618, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | B-MAX | brut « 1.0 EcoBoost » | R7
    (66628, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | C-MAX II | brut « 1.5 EcoBoost 16V » | R7
    (66629, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | C-MAX II | brut « 1.5 EcoBoost 16V » | R7
    (66723, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III | brut « 1.0 EcoBoost » | R7
    (66725, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | FOCUS III | brut « 1.5 EcoBoost 16V » | R7
    (66726, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | FOCUS III | brut « 1.5 EcoBoost 16V » | R7
    (66743, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III Break | brut « 1.0 EcoBoost » | R7
    (66744, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | FOCUS III Break | brut « 1.5 EcoBoost 16V » | R7
    (66745, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | FOCUS III Break | brut « 1.5 EcoBoost 16V » | R7
    (66759, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | GRAND C-MAX | brut « 1.5 EcoBoost 16V » | R7
    (66760, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | GRAND C-MAX | brut « 1.5 EcoBoost 16V » | R7
    (66769, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | KUGA II | brut « 1.5 EcoBoost 16V » | R7
    (66770, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | KUGA II | brut « 1.5 EcoBoost 16V » | R7
    (66774, '1.5 Econetic 4x4', '1.5 EcoBoost 4x4 16V'),  -- FORD | KUGA II | brut « 1.5 EcoBoost 4x4 16V » | R7
    (66788, '2.0 Econetic 4x4 16V', '2.0 EcoBoost 4x4 16V'),  -- FORD | KUGA II | brut « 2.0 EcoBoost 4x4 16V » | R7
    (66841, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | TOURNEO COURIER Combi | brut « 1.0 EcoBoost » | R7
    (66884, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | TRANSIT COURIER | brut « 1.0 EcoBoost » | R7
    (66889, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | TRANSIT COURIER Combi | brut « 1.0 EcoBoost » | R7
    (66959, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | GALAXY IV | brut « 1.5 EcoBoost 16V » | R7
    (66967, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | GALAXY IV | brut « 2.0 EcoBoost 16V » | R7
    (67007, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | MONDEO V Berline | brut « 1.0 EcoBoost » | R7
    (67011, '1.5 Econetic 16V', '1.5 EcoBoost 16V'),  -- FORD | MONDEO V Berline | brut « 1.5 EcoBoost 16V » | R7
    (67019, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | MONDEO V Berline | brut « 2.0 EcoBoost 16V » | R7
    (67040, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | MONDEO V | brut « 1.0 EcoBoost » | R7
    (67041, '1.5 Econetic 16V', '1.5 EcoBoost 16V'),  -- FORD | MONDEO V | brut « 1.5 EcoBoost 16V » | R7
    (67042, '1.5 Econetic 16V', '1.5 EcoBoost 16V'),  -- FORD | MONDEO V | brut « 1.5 EcoBoost 16V » | R7
    (67049, '2.0 Econetic 16V', '2.0 EcoBoost 16V'),  -- FORD | MONDEO V | brut « 2.0 EcoBoost 16V » | R7
    (67050, '2.0 Econetic 16V', '2.0 EcoBoost 16V'),  -- FORD | MONDEO V | brut « 2.0 EcoBoost 16V » | R7
    (67056, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | MONDEO V Break | brut « 1.0 EcoBoost » | R7
    (67065, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | MONDEO V Break | brut « 2.0 EcoBoost 16V » | R7
    (67066, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | MONDEO V Break | brut « 2.0 EcoBoost 16V » | R7
    (67074, '1.5 Econetic', '1.5 EcoBoost 16V'),  -- FORD | S-MAX II | brut « 1.5 EcoBoost 16V » | R7
    (67082, '2.0 Econetic', '2.0 EcoBoost 16V'),  -- FORD | S-MAX II | brut « 2.0 EcoBoost 16V » | R7
    (67112, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FIESTA VII | brut « 1.0 EcoBoost » | R7
    (67114, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FIESTA VII | brut « 1.0 EcoBoost » | R7
    (67115, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FIESTA VII | brut « 1.0 EcoBoost » | R7
    (67128, '1.5 ST Econetic', '1.5 ST EcoBoost'),  -- FORD | FIESTA VII | brut « 1.5 ST EcoBoost » | R7
    (67133, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS III Berline | brut « 1.0 EcoBoost » | R7
    (67135, '1.5 Econetic 16V', '1.5 EcoBoost 16V'),  -- FORD | FOCUS III Berline | brut « 1.5 EcoBoost 16V » | R7
    (67136, '1.5 Econetic 16V', '1.5 EcoBoost 16V'),  -- FORD | FOCUS III Berline | brut « 1.5 EcoBoost 16V » | R7
    (67148, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS IV | brut « 1.0 EcoBoost » | R7
    (67149, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS IV | brut « 1.0 EcoBoost » | R7
    (67150, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS IV | brut « 1.0 EcoBoost » | R7
    (67156, '1.5 Econetic', '1.5 EcoBoost'),  -- FORD | FOCUS IV | brut « 1.5 EcoBoost » | R7
    (67157, '1.5 Econetic', '1.5 EcoBoost'),  -- FORD | FOCUS IV | brut « 1.5 EcoBoost » | R7
    (67169, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS IV Break | brut « 1.0 EcoBoost » | R7
    (67170, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS IV Break | brut « 1.0 EcoBoost » | R7
    (67171, '1.0 Econetic', '1.0 EcoBoost'),  -- FORD | FOCUS IV Break | brut « 1.0 EcoBoost » | R7
    (67176, '1.5 Econetic', '1.5 EcoBoost'),  -- FORD | FOCUS IV Break | brut « 1.5 EcoBoost » | R7
    (67177, '1.5 Econetic', '1.5 EcoBoost'),  -- FORD | FOCUS IV Break | brut « 1.5 EcoBoost » | R7
    (67190, '1.6 Econetic 16V', '1.6 EcoBoost 16V'),  -- FORD | MONDEO IV Berline | brut « 1.6 EcoBoost 16V » | R7
    (67193, '2.0 Econetic 16V', '2.0 EcoBoost 16V'),  -- FORD | MONDEO IV Berline | brut « 2.0 EcoBoost 16V » | R7
    (70010, '2.2  II', '2.2 Multijet II'),  -- JEEP | WRANGLER IV | brut « 2.2 Multijet II » | R1
    (73446, '200 D', '220 D'),  -- MERCEDES | CLASSE C Coupé (C205) | brut « 220 D » | R2
    (73534, '300', '250 4-Matic'),  -- MERCEDES | CALSSE GLC (X253) | brut « 250 4-Matic » | R2
    (73557, '300 D', '250 D 4-Matic'),  -- MERCEDES | CLASSE GLE (W166) | brut « 250 D 4-Matic » | R7
    (76570, '1.6 BlueHDi', '1.6 HDI-BlueHDI'),  -- PEUGEOT | PARTNER II | brut « 1.6 HDI-BlueHDI » | R2
    (76577, '1.6 BlueHDi', '1.6 HDI- BlueHDI'),  -- PEUGEOT | PARTNER II Tepee | brut « 1.6 HDI- BlueHDI » | R2
    (78179, '2.0 TDI 4x4', '2.0 TDI RS 4x4'),  -- SKODA | OCTAVIA III | brut « 2.0 TDI RS 4x4 » | R2
    (78195, '2.0 TDI 4x4', '2.0 TDI RS 4x4')  -- SKODA | OCTAVIA III Combi | brut « 2.0 TDI RS 4x4 » | R2
    ;

  -- Garde : existence et valeur exacte, sinon exception et rien d'écrit.
  SELECT string_agg(format('%s : %L', c.type_id,
                           coalesce(t.type_name_meta, CASE WHEN t.type_id IS NULL THEN '<type absent>' ELSE '<NULL>' END)),
                    ' ; ' ORDER BY c.type_id)
    INTO v_ecarts
    FROM mandat_ee_corrections c
    LEFT JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_id IS NULL
      OR t.type_name_meta IS NULL
      OR t.type_name_meta NOT IN (c.valeur_erronee, c.valeur_corrigee);
  IF v_ecarts IS NOT NULL THEN
    RAISE EXCEPTION 'mandat EE : valeur actuelle différente de la valeur relevée, rien n''est écrit. %', v_ecarts;
  END IF;

  SELECT array_agg(c.type_id ORDER BY c.type_id)
    INTO v_a_ecrire
    FROM mandat_ee_corrections c
    JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_name_meta = c.valeur_erronee;

  IF v_a_ecrire IS NULL THEN
    RAISE NOTICE 'mandat EE : déjà appliqué, 0 ligne écrite';
    RETURN;
  END IF;

  UPDATE public.auto_type t
     SET type_name_meta = c.valeur_corrigee
    FROM mandat_ee_corrections c
   WHERE t.type_id = c.type_id::text
     AND t.type_name_meta = c.valeur_erronee;
  GET DIAGNOSTICS v_ecrits = ROW_COUNT;
  IF v_ecrits <> cardinality(v_a_ecrire) THEN
    RAISE EXCEPTION 'mandat EE : % lignes écrites pour % attendues', v_ecrits, cardinality(v_a_ecrire);
  END IF;

  v_marques := public.mark_stale_with_followup_rebuild(v_a_ecrire, 'mandat EE 2026-11-20 : correction de auto_type.type_name_meta (cas confirmés par sources extérieures, mandat EH)', true);
  RAISE NOTICE 'mandat EE : % valeurs écrites, % pages R8 invalidées et reconstruites', v_ecrits, v_marques;
END
$mandat_ee$;

-- Contrôle après application (lecture seule ; attendu : 0 ligne) :
-- docs/audit/mandat-ee-noms-motorisation-20261120/07-controle-apres.sql
