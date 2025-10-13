-- Script SQL de création de données de test pour monia123@gmail.com
-- Date: 6 octobre 2025
-- User ID dans la session: usr_1759774640723_njikmiz59
-- Base de données: PostgreSQL (Supabase)

-- ⚠️ IMPORTANT: 
-- 1. Trouvez d'abord le CST_ID de monia123@gmail.com:
--    SELECT cst_id FROM ___xtr_customer WHERE cst_mail = 'monia123@gmail.com';
-- 2. Remplacez toutes les occurrences de "1" par le vrai CST_ID dans ce script

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 0: VÉRIFIER L'UTILISATEUR
-- ═══════════════════════════════════════════════════════════════

SELECT 
  cst_id,
  cst_mail,
  cst_name,
  cst_fname
FROM ___xtr_customer 
WHERE cst_mail = 'monia123@gmail.com';

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 1: CRÉER LES ADRESSES
-- ═══════════════════════════════════════════════════════════════

-- Adresse de facturation
INSERT INTO ___xtr_customer_billing_address 
(cba_cst_id, cba_civility, cba_name, cba_fname, cba_address, cba_zip_code, cba_city, cba_country, cba_mail)
VALUES
(1, 'Mme', 'Test', 'Monia', '123 Avenue des Tests', '75001', 'Paris', 'France', 'monia123@gmail.com')
RETURNING cba_id;

-- Notez l'ID retourné (par exemple: 101)

-- Adresse de livraison  
INSERT INTO ___xtr_customer_delivery_address 
(cda_cst_id, cda_civility, cda_name, cda_fname, cda_address, cda_zip_code, cda_city, cda_country)
VALUES
(1, 'Mme', 'Test', 'Monia', '456 Rue de la Livraison', '75002', 'Paris', 'France')
RETURNING cda_id;

-- Notez l'ID retourné (par exemple: 201)

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 2: CRÉER LES COMMANDES
-- ═══════════════════════════════════════════════════════════════
-- ⚠️ REMPLACEZ 101 et 201 par les IDs d'adresses retournés ci-dessus

-- ───────────────────────────────────────────────────────────────
-- Commande 1: En attente de paiement
-- ───────────────────────────────────────────────────────────────

WITH new_order AS (
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (1, NOW(), '0', 0, NULL, 
   101, 201, 121.70, 0, 
   15.00, 136.70, 'Commande test en attente de paiement', 1)
  RETURNING ord_id
)
INSERT INTO ___xtr_order_line 
(orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
SELECT ord_id, 'Filtre à huile Bosch Premium', 15.90, 2, 31.80 FROM new_order
UNION ALL
SELECT ord_id, 'Plaquettes de frein avant Brembo', 89.90, 1, 89.90 FROM new_order;

-- ───────────────────────────────────────────────────────────────
-- Commande 2: Payée en préparation
-- ───────────────────────────────────────────────────────────────

WITH new_order AS (
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (1, NOW() - INTERVAL '3 days', '0', 1, NOW() - INTERVAL '3 days', 
   101, 201, 245.80, 0, 
   15.00, 260.80, 'Commande payée en cours de préparation', 2)
  RETURNING ord_id
)
INSERT INTO ___xtr_order_line 
(orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
SELECT ord_id, 'Kit distribution Bosch', 189.90, 1, 189.90 FROM new_order
UNION ALL
SELECT ord_id, 'Huile moteur 5W30 Castrol 5L', 27.95, 2, 55.90 FROM new_order;

-- ───────────────────────────────────────────────────────────────
-- Commande 3: Expédiée
-- ───────────────────────────────────────────────────────────────

WITH new_order AS (
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (1, NOW() - INTERVAL '7 days', '0', 1, NOW() - INTERVAL '7 days', 
   101, 201, 156.50, 0, 
   12.00, 168.50, 'Commande expédiée - Tracking: 3S123456789FR', 4)
  RETURNING ord_id
)
INSERT INTO ___xtr_order_line 
(orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
SELECT ord_id, 'Balai d''essuie-glace Bosch Aerotwin 650mm', 28.90, 2, 57.80 FROM new_order
UNION ALL
SELECT ord_id, 'Ampoules H7 Philips WhiteVision', 24.90, 4, 99.60 FROM new_order;

-- ───────────────────────────────────────────────────────────────
-- Commande 4: Livrée (avec facture)
-- ───────────────────────────────────────────────────────────────

WITH new_order AS (
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (1, NOW() - INTERVAL '15 days', '0', 1, NOW() - INTERVAL '15 days', 
   101, 201, 478.90, 25.00, 
   18.00, 521.90, 'Commande livrée avec succès', 6)
  RETURNING ord_id
)
INSERT INTO ___xtr_order_line 
(orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
SELECT ord_id, 'Disques de frein avant Brembo (x2)', 89.90, 1, 89.90 FROM new_order
UNION ALL
SELECT ord_id, 'Plaquettes de frein avant Ferodo', 78.50, 1, 78.50 FROM new_order
UNION ALL
SELECT ord_id, 'Kit embrayage Valeo', 285.00, 1, 285.00 FROM new_order
UNION ALL
SELECT ord_id, 'Consigne échange standard (embrayage)', 25.00, 1, 25.00 FROM new_order;

-- Notez l'ord_id de cette commande (par exemple: 304) pour créer le supplément

-- ───────────────────────────────────────────────────────────────
-- Commande 5: Supplément non payé (rattaché à commande 4)
-- ───────────────────────────────────────────────────────────────
-- ⚠️ REMPLACEZ 304 par l'ord_id de la commande 4 ci-dessus

WITH new_order AS (
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (1, NOW() - INTERVAL '10 days', '304', 0, NULL, 
   101, 201, 45.90, 0, 
   8.00, 53.90, 'Supplément pièce manquante - Butée embrayage', 1)
  RETURNING ord_id
)
INSERT INTO ___xtr_order_line 
(orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
SELECT ord_id, 'Butée embrayage hydraulique Valeo', 45.90, 1, 45.90 FROM new_order;

-- ───────────────────────────────────────────────────────────────
-- Commande 6: Ancienne commande 2024
-- ───────────────────────────────────────────────────────────────

WITH new_order AS (
  INSERT INTO ___xtr_order 
  (ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay, 
   ord_cba_id, ord_cda_id, ord_amount_ttc, ord_deposit_ttc, 
   ord_shipping_fee_ttc, ord_total_ttc, ord_info, ord_status)
  VALUES
  (1, '2024-11-15 10:30:00', '0', 1, '2024-11-15 10:45:00', 
   101, 201, 312.50, 0, 
   15.00, 327.50, 'Ancienne commande historique 2024', 6)
  RETURNING ord_id
)
INSERT INTO ___xtr_order_line 
(orl_ord_id, orl_pg_name, orl_art_price_sell_unit_ttc, orl_art_quantity, orl_art_price_sell_ttc)
SELECT ord_id, 'Filtre à air Mann Filter', 18.90, 2, 37.80 FROM new_order
UNION ALL
SELECT ord_id, 'Filtre habitacle charbon actif', 24.90, 1, 24.90 FROM new_order
UNION ALL
SELECT ord_id, 'Kit courroie accessoires Gates', 124.90, 2, 249.80 FROM new_order;

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 3: CRÉER LES MESSAGES
-- ═══════════════════════════════════════════════════════════════
-- ⚠️ Vous devez remplacer les ord_id par les vrais IDs des commandes créées

-- Récupérer les IDs des commandes pour les messages
-- SELECT ord_id, ord_info FROM ___xtr_order WHERE ord_cst_id = 1 ORDER BY ord_date DESC;

-- Message 1: Non lu - Confirmation commande 2
INSERT INTO ___xtr_msg 
(msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
VALUES
(1, 302, 'Confirmation de commande', 
 '<p>Bonjour Monia,</p><p>Votre commande a bien été reçue et est en cours de préparation.</p><p>Vous recevrez un email dès son expédition.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
 0, NOW() - INTERVAL '3 days', 'order');

-- Message 2: Lu - Expédition commande 3
INSERT INTO ___xtr_msg 
(msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
VALUES
(1, 303, 'Expédition de votre commande', 
 '<p>Bonjour Monia,</p><p>Bonne nouvelle ! Votre commande a été expédiée.</p><p><strong>Numéro de suivi:</strong> 3S123456789FR</p><p>Vous pouvez suivre votre colis sur le site de Colissimo.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
 1, NOW() - INTERVAL '5 days', 'shipping');

-- Message 3: Non lu - Urgent commande 4
INSERT INTO ___xtr_msg 
(msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
VALUES
(1, 304, 'URGENT: Complément d''information requis', 
 '<p>Bonjour Monia,</p><p><strong style="color: red;">Information importante</strong></p><p>Nous avons détecté qu''il manque la butée hydraulique pour compléter votre kit embrayage.</p><p>Nous avons créé un supplément de commande pour cette pièce manquante.</p><p>Montant: 53.90€ TTC (livraison incluse)</p><p>Merci de procéder au règlement pour que nous puissions finaliser votre commande.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
 0, NOW() - INTERVAL '10 days', 'system');

-- Message 4: Lu - Message système bienvenue
INSERT INTO ___xtr_msg 
(msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
VALUES
(1, NULL, 'Bienvenue sur AutoMecanik', 
 '<p>Bonjour Monia,</p><p>Bienvenue sur AutoMecanik, votre spécialiste en pièces auto !</p><p>Nous sommes ravis de vous compter parmi nos clients.</p><p>N''hésitez pas à nous contacter si vous avez des questions.</p><ul><li>📞 Téléphone: 01 77 69 58 92</li><li>📧 Email: contact@automecanik.com</li><li>🕐 Horaires: Lun-Ven 9h-18h</li></ul><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
 1, NOW() - INTERVAL '30 days', 'system');

-- Message 5: Non lu - Retour consigne disponible
INSERT INTO ___xtr_msg 
(msg_cst_id, msg_ord_id, msg_subject, msg_content, msg_open, msg_date, msg_type)
VALUES
(1, 304, 'Retour de consigne disponible', 
 '<p>Bonjour Monia,</p><p>Vous avez payé une consigne de 25.00€ pour l''échange standard de votre embrayage.</p><p>Vous pouvez désormais retourner votre ancienne pièce pour récupérer cette consigne.</p><p>Procédure:</p><ol><li>Emballez soigneusement votre ancienne pièce</li><li>Téléchargez l''étiquette de retour dans votre espace client</li><li>Déposez le colis en point relais</li></ol><p>Le remboursement sera effectué sous 5 jours ouvrés après réception.</p><p>Cordialement,<br>L''équipe AutoMecanik</p>', 
 0, NOW() - INTERVAL '12 days', 'system');

-- ═══════════════════════════════════════════════════════════════
-- RÉSUMÉ DES DONNÉES CRÉÉES
-- ═══════════════════════════════════════════════════════════════

SELECT '✅ RÉSUMÉ DES DONNÉES CRÉÉES' AS status;

SELECT 'ADRESSES' AS type, COUNT(*) AS count 
FROM ___xtr_customer_billing_address 
WHERE cba_cst_id = 1;

SELECT 'COMMANDES' AS type, COUNT(*) AS count 
FROM ___xtr_order 
WHERE ord_cst_id = 1;

SELECT 'LIGNES COMMANDE' AS type, COUNT(*) AS count 
FROM ___xtr_order_line ol
JOIN ___xtr_order o ON o.ord_id = ol.orl_ord_id
WHERE o.ord_cst_id = 1;

SELECT 'MESSAGES' AS type, COUNT(*) AS count 
FROM ___xtr_msg 
WHERE msg_cst_id = 1;

-- Afficher les commandes créées
SELECT 
  ord_id AS "ID",
  ord_date AS "Date",
  CASE 
    WHEN ord_parent != '0' THEN 'Supplément de #' || ord_parent
    ELSE 'Commande normale'
  END AS "Type",
  CASE 
    WHEN ord_is_pay = 1 THEN '✅ Payée'
    ELSE '⏳ En attente'
  END AS "Paiement",
  ord_total_ttc AS "Total TTC",
  ord_status AS "Statut",
  ord_info AS "Description"
FROM ___xtr_order 
WHERE ord_cst_id = 1
ORDER BY ord_date DESC;

-- Afficher les messages créés
SELECT 
  msg_id AS "ID",
  msg_date AS "Date",
  CASE 
    WHEN msg_open = 1 THEN '✅ Lu'
    ELSE '📬 Non lu'
  END AS "Statut",
  msg_subject AS "Sujet",
  CASE 
    WHEN msg_ord_id IS NOT NULL THEN 'Commande #' || msg_ord_id
    ELSE 'Message système'
  END AS "Lié à"
FROM ___xtr_msg 
WHERE msg_cst_id = 1
ORDER BY msg_date DESC;

-- Vérifier la commande avec supplément
SELECT 
  o1.ord_id AS "Commande principale",
  o1.ord_total_ttc AS "Montant",
  o2.ord_id AS "Supplément",
  o2.ord_total_ttc AS "Montant supplément",
  CASE 
    WHEN o2.ord_is_pay = 1 THEN 'Supplément payé'
    ELSE 'Supplément NON PAYÉ'
  END AS "Statut supplément"
FROM ___xtr_order o1
LEFT JOIN ___xtr_order o2 ON o2.ord_parent::int = o1.ord_id
WHERE o1.ord_cst_id = 1 AND o1.ord_parent = '0'
  AND o2.ord_id IS NOT NULL;

-- Compter messages non lus
SELECT 
  COUNT(*) AS "Messages non lus"
FROM ___xtr_msg 
WHERE msg_cst_id = 1 AND msg_open = 0;

SELECT '🎉 Script SQL terminé avec succès !' AS status;
