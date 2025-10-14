-- Script SQL SIMPLIFIÉ pour créer des données de test pour monia123@gmail.com
-- Compatible PostgreSQL/Supabase
-- Date: 6 octobre 2025

-- ═══════════════════════════════════════════════════════════════
-- CONFIGURATION - REMPLACEZ CES VALEURS
-- ═══════════════════════════════════════════════════════════════

-- Trouvez d'abord le CST_ID:
-- SELECT cst_id FROM ___xtr_customer WHERE cst_mail = 'monia123@gmail.com';

-- REMPLACEZ 999 par le vrai CST_ID
DO $$
DECLARE
  v_cst_id INT := 999;  -- ⚠️ REMPLACEZ PAR LE VRAI CST_ID
  v_cba_id INT;
  v_cda_id INT;
  v_order1_id INT;
  v_order2_id INT;
  v_order3_id INT;
  v_order4_id INT;
  v_order5_id INT;
  v_order6_id INT;
BEGIN

  RAISE NOTICE '🚀 Début création données test pour CST_ID: %', v_cst_id;

  -- ═══════════════════════════════════════════════════════════════
  -- ÉTAPE 1: ADRESSES
  -- ═══════════════════════════════════════════════════════════════
  
  RAISE NOTICE '📍 Création adresses...';
  
  -- Adresse de facturation (génération manuelle de l'ID)
  SELECT COALESCE(MAX(cba_id), 0) + 1 INTO v_cba_id FROM ___xtr_customer_billing_address;
  
  INSERT INTO ___xtr_customer_billing_address 
  (cba_id, cba_cst_id, cba_civility, cba_name, cba_fname, cba_address, cba_zip_code, cba_city, cba_country, cba_mail)
  VALUES
  (v_cba_id, v_cst_id, 'Mme', 'Test', 'Monia', '123 Avenue des Tests', '75001', 'Paris', 'France', 'monia123@gmail.com');
  
  RAISE NOTICE '  ✅ Adresse facturation créée: ID=%', v_cba_id;
  
  -- Adresse de livraison
  SELECT COALESCE(MAX(cda_id), 0) + 1 INTO v_cda_id FROM ___xtr_customer_delivery_address;
  
  INSERT INTO ___xtr_customer_delivery_address 
  (cda_id, cda_cst_id, cda_civility, cda_name, cda_fname, cda_address, cda_zip_code, cda_city, cda_country)
  VALUES
  (v_cda_id, v_cst_id, 'Mme', 'Test', 'Monia', '456 Rue de la Livraison', '75002', 'Paris', 'France');
  
  RAISE NOTICE '  ✅ Adresse livraison créée: ID=%', v_cda_id;

  -- ═══════════════════════════════════════════════════════════════
  -- ÉTAPE 2: COMMANDES
  -- ═══════════════════════════════════════════════════════════════
  
  RAISE NOTICE '📦 Création commandes...';
  
  -- Commande 1: En attente de paiement
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (v_cst_id, NOW(), '0', 0, NULL, 
   v_cba_id, v_cda_id, 121.70, 0, 
   15.00, 136.70, 'Commande test en attente de paiement', 1)
  RETURNING ord_id INTO v_order1_id;
  
  INSERT INTO ___xtr_order_line 
  (orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
  VALUES
  (v_order1_id, 'Filtre à huile Bosch Premium', 15.90, 2, 31.80),
  (v_order1_id, 'Plaquettes de frein avant Brembo', 89.90, 1, 89.90);
  
  RAISE NOTICE '  ✅ Commande 1 créée: ID=%, Statut=En attente', v_order1_id;
  
  -- Commande 2: Payée en préparation
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (v_cst_id, NOW() - INTERVAL '3 days', '0', 1, NOW() - INTERVAL '3 days', 
   v_cba_id, v_cda_id, 245.80, 0, 
   15.00, 260.80, 'Commande payée en cours de préparation', 2)
  RETURNING ord_id INTO v_order2_id;
  
  INSERT INTO ___xtr_order_line 
  (orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
  VALUES
  (v_order2_id, 'Kit distribution Bosch', 189.90, 1, 189.90),
  (v_order2_id, 'Huile moteur 5W30 Castrol 5L', 27.95, 2, 55.90);
  
  RAISE NOTICE '  ✅ Commande 2 créée: ID=%, Statut=Payée/Préparation', v_order2_id;
  
  -- Commande 3: Expédiée
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (v_cst_id, NOW() - INTERVAL '7 days', '0', 1, NOW() - INTERVAL '7 days', 
   v_cba_id, v_cda_id, 156.50, 0, 
   12.00, 168.50, 'Commande expédiée - Tracking: 3S123456789FR', 4)
  RETURNING ord_id INTO v_order3_id;
  
  INSERT INTO ___xtr_order_line 
  (orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
  VALUES
  (v_order3_id, 'Balai d''essuie-glace Bosch Aerotwin 650mm', 28.90, 2, 57.80),
  (v_order3_id, 'Ampoules H7 Philips WhiteVision', 24.90, 4, 99.60);
  
  RAISE NOTICE '  ✅ Commande 3 créée: ID=%, Statut=Expédiée', v_order3_id;
  
  -- Commande 4: Livrée (avec facture)
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (v_cst_id, NOW() - INTERVAL '15 days', '0', 1, NOW() - INTERVAL '15 days', 
   v_cba_id, v_cda_id, 478.90, 25.00, 
   18.00, 521.90, 'Commande livrée avec succès', 6)
  RETURNING ord_id INTO v_order4_id;
  
  INSERT INTO ___xtr_order_line 
  (orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
  VALUES
  (v_order4_id, 'Disques de frein avant Brembo (x2)', 89.90, 1, 89.90),
  (v_order4_id, 'Plaquettes de frein avant Ferodo', 78.50, 1, 78.50),
  (v_order4_id, 'Kit embrayage Valeo', 285.00, 1, 285.00),
  (v_order4_id, 'Consigne échange standard (embrayage)', 25.00, 1, 25.00);
  
  RAISE NOTICE '  ✅ Commande 4 créée: ID=%, Statut=Livrée/Facture dispo', v_order4_id;
  
  -- Commande 5: Supplément non payé (rattaché à commande 4)
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (v_cst_id, NOW() - INTERVAL '10 days', v_order4_id::text, 0, NULL, 
   v_cba_id, v_cda_id, 45.90, 0, 
   8.00, 53.90, 'Supplément pièce manquante - Butée embrayage', 1)
  RETURNING ord_id INTO v_order5_id;
  
  INSERT INTO ___xtr_order_line 
  (orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
  VALUES
  (v_order5_id, 'Butée embrayage hydraulique Valeo', 45.90, 1, 45.90);
  
  RAISE NOTICE '  ✅ Commande 5 créée: ID=%, Supplément de #% (NON PAYÉ)', v_order5_id, v_order4_id;
  
  -- Commande 6: Ancienne commande 2024
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (v_cst_id, '2024-11-15 10:30:00', '0', 1, '2024-11-15 10:45:00', 
   v_cba_id, v_cda_id, 312.50, 0, 
   15.00, 327.50, 'Ancienne commande historique 2024', 6)
  RETURNING ord_id INTO v_order6_id;
  
  INSERT INTO ___xtr_order_line 
  (orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
  VALUES
  (v_order6_id, 'Filtre à air Mann Filter', 18.90, 2, 37.80),
  (v_order6_id, 'Filtre habitacle charbon actif', 24.90, 1, 24.90),
  (v_order6_id, 'Kit courroie accessoires Gates', 124.90, 2, 249.80);
  
  RAISE NOTICE '  ✅ Commande 6 créée: ID=%, Ancienne commande 2024', v_order6_id;

  -- ═══════════════════════════════════════════════════════════════
  -- ÉTAPE 3: MESSAGES
  -- ═══════════════════════════════════════════════════════════════
  
  RAISE NOTICE '💬 Création messages...';
  
  -- Message 1: Non lu - Confirmation commande 2
  INSERT INTO ___xtr_msg 
  (msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
  VALUES
  (v_cst_id, v_order2_id, 'Confirmation de commande', 
   '<p>Bonjour Monia,</p><p>Votre commande a bien été reçue et est en cours de préparation.</p><p>Vous recevrez un email dès son expédition.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
   0, NOW() - INTERVAL '3 days', 'order');
  
  -- Message 2: Lu - Expédition commande 3
  INSERT INTO ___xtr_msg 
  (msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
  VALUES
  (v_cst_id, v_order3_id, 'Expédition de votre commande', 
   '<p>Bonjour Monia,</p><p>Bonne nouvelle ! Votre commande a été expédiée.</p><p><strong>Numéro de suivi:</strong> 3S123456789FR</p><p>Vous pouvez suivre votre colis sur le site de Colissimo.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
   1, NOW() - INTERVAL '5 days', 'shipping');
  
  -- Message 3: Non lu - Urgent commande 4
  INSERT INTO ___xtr_msg 
  (msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
  VALUES
  (v_cst_id, v_order4_id, 'URGENT: Complément d''information requis', 
   '<p>Bonjour Monia,</p><p><strong style="color: red;">Information importante</strong></p><p>Nous avons détecté qu''il manque la butée hydraulique pour compléter votre kit embrayage.</p><p>Nous avons créé un supplément de commande pour cette pièce manquante.</p><p>Montant: 53.90€ TTC (livraison incluse)</p><p>Merci de procéder au règlement pour que nous puissions finaliser votre commande.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
   0, NOW() - INTERVAL '10 days', 'system');
  
  -- Message 4: Lu - Message système bienvenue
  INSERT INTO ___xtr_msg 
  (msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
  VALUES
  (v_cst_id, NULL, 'Bienvenue sur AutoMecanik', 
   '<p>Bonjour Monia,</p><p>Bienvenue sur AutoMecanik, votre spécialiste en pièces auto !</p><p>Nous sommes ravis de vous compter parmi nos clients.</p><p>N''hésitez pas à nous contacter si vous avez des questions.</p><ul><li>📞 Téléphone: 01 77 69 58 92</li><li>📧 Email: contact@automecanik.com</li><li>🕐 Horaires: Lun-Ven 9h-18h</li></ul><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
   1, NOW() - INTERVAL '30 days', 'system');
  
  -- Message 5: Non lu - Retour consigne disponible
  INSERT INTO ___xtr_msg 
  (msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
  VALUES
  (v_cst_id, v_order4_id, 'Retour de consigne disponible', 
   '<p>Bonjour Monia,</p><p>Vous avez payé une consigne de 25.00€ pour l''échange standard de votre embrayage.</p><p>Vous pouvez désormais retourner votre ancienne pièce pour récupérer cette consigne.</p><p>Procédure:</p><ol><li>Emballez soigneusement votre ancienne pièce</li><li>Téléchargez l''étiquette de retour dans votre espace client</li><li>Déposez le colis en point relais</li></ol><p>Le remboursement sera effectué sous 5 jours ouvrés après réception.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
   0, NOW() - INTERVAL '12 days', 'system');
  
  RAISE NOTICE '  ✅ 5 messages créés';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ CRÉATION TERMINÉE AVEC SUCCÈS !';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CST_ID: %', v_cst_id;
  RAISE NOTICE 'Adresses: Facturation ID=%, Livraison ID=%', v_cba_id, v_cda_id;
  RAISE NOTICE 'Commandes créées:';
  RAISE NOTICE '  - Commande 1 (En attente): %', v_order1_id;
  RAISE NOTICE '  - Commande 2 (Payée/Préparation): %', v_order2_id;
  RAISE NOTICE '  - Commande 3 (Expédiée): %', v_order3_id;
  RAISE NOTICE '  - Commande 4 (Livrée/Facture): %', v_order4_id;
  RAISE NOTICE '  - Commande 5 (Supplément NON PAYÉ de #%): %', v_order4_id, v_order5_id;
  RAISE NOTICE '  - Commande 6 (2024): %', v_order6_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
END $$;

-- Vérification finale
SELECT '✅ RÉSUMÉ' AS status;

SELECT 'Commandes' AS type, COUNT(*) AS count, 
       SUM(CASE WHEN ord_is_pay = 0 THEN 1 ELSE 0 END) AS non_payees,
       SUM(CASE WHEN ord_is_pay = 1 THEN 1 ELSE 0 END) AS payees
FROM ___xtr_order 
WHERE ord_cst_id = 999;  -- ⚠️ REMPLACEZ PAR LE VRAI CST_ID

SELECT 'Messages' AS type, COUNT(*) AS count,
       SUM(CASE WHEN msg_open = 0 THEN 1 ELSE 0 END) AS non_lus,
       SUM(CASE WHEN msg_open = 1 THEN 1 ELSE 0 END) AS lus
FROM ___xtr_msg 
WHERE msg_cst_id = 999;  -- ⚠️ REMPLACEZ PAR LE VRAI CST_ID
