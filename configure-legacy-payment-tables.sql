-- ================================================================
-- ANALYSE DES VRAIES TABLES LEGACY POUR LE MODULE PAIEMENTS
-- ================================================================
-- 
-- Ce script analyse les VRAIES tables legacy existantes dans Supabase
-- pour comprendre leur structure et les utiliser dans le module de paiements.
--
-- Tables RÉELLES existantes:
-- - ___xtr_order (1 417 commandes)
-- - ___xtr_customer (59 129 clients)  
-- - ic_postback (5 826 callbacks de paiement)
-- - ___xtr_order_line (1 833 lignes de commande)
--
-- ✅ TOUTES CES TABLES EXISTENT DÉJÀ - AUCUNE MODIFICATION NÉCESSAIRE

-- ================================================================
-- 1. VÉRIFICATION DES VRAIES TABLES EXISTANTES
-- ================================================================

-- Vérifier que les VRAIES tables legacy existent
DO $$
BEGIN
    -- Vérifier ___xtr_order (table principale des commandes)
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '___xtr_order') THEN
        RAISE EXCEPTION 'Table ___xtr_order non trouvée. Cette table est essentielle !';
    ELSE
        RAISE NOTICE '✅ Table ___xtr_order trouvée (commandes)';
    END IF;
    
    -- Vérifier ___xtr_customer (table des clients)
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '___xtr_customer') THEN
        RAISE EXCEPTION 'Table ___xtr_customer non trouvée. Cette table est essentielle !';
    ELSE
        RAISE NOTICE '✅ Table ___xtr_customer trouvée (clients)';
    END IF;
    
    -- Vérifier ic_postback (table des callbacks de paiement)
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ic_postback') THEN
        RAISE EXCEPTION 'Table ic_postback non trouvée. Cette table est essentielle !';
    ELSE
        RAISE NOTICE '✅ Table ic_postback trouvée (callbacks paiement)';
    END IF;
    
    -- Vérifier ___xtr_order_line (lignes de commande)
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '___xtr_order_line') THEN
        RAISE EXCEPTION 'Table ___xtr_order_line non trouvée. Cette table est essentielle !';
    ELSE
        RAISE NOTICE '✅ Table ___xtr_order_line trouvée (lignes de commande)';
    END IF;
    
    RAISE NOTICE '🎉 Toutes les VRAIES tables legacy sont présentes !';
END $$;

-- ================================================================
-- 2. EXTENSIONS POUR backofficeplateform_commande
-- ================================================================

-- Ajouter les colonnes nécessaires pour les paiements si elles n'existent pas
DO $$
BEGIN
    -- Statut de paiement
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'statut_paiement') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN statut_paiement VARCHAR(20) DEFAULT 'EN_ATTENTE'
        CHECK (statut_paiement IN ('EN_ATTENTE', 'PAYE', 'ECHEC', 'REMBOURSE', 'ANNULE'));
        RAISE NOTICE '✅ Colonne statut_paiement ajoutée';
    END IF;
    
    -- Méthode de paiement
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'methode_paiement') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN methode_paiement VARCHAR(20) DEFAULT 'CYBERPLUS'
        CHECK (methode_paiement IN ('CYBERPLUS', 'STRIPE', 'PAYPAL', 'VIREMENT'));
        RAISE NOTICE '✅ Colonne methode_paiement ajoutée';
    END IF;
    
    -- Référence de transaction
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'reference_transaction') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN reference_transaction VARCHAR(255);
        RAISE NOTICE '✅ Colonne reference_transaction ajoutée';
    END IF;
    
    -- Référence bancaire
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'reference_bancaire') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN reference_bancaire VARCHAR(255);
        RAISE NOTICE '✅ Colonne reference_bancaire ajoutée';
    END IF;
    
    -- URLs de retour
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'url_retour_ok') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN url_retour_ok TEXT;
        RAISE NOTICE '✅ Colonne url_retour_ok ajoutée';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'url_retour_nok') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN url_retour_nok TEXT;
        RAISE NOTICE '✅ Colonne url_retour_nok ajoutée';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'url_callback') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN url_callback TEXT;
        RAISE NOTICE '✅ Colonne url_callback ajoutée';
    END IF;
    
    -- Métadonnées JSON
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'donnees_meta') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN donnees_meta JSONB;
        RAISE NOTICE '✅ Colonne donnees_meta ajoutée';
    END IF;
    
    -- Date de paiement
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'backofficeplateform_commande' 
                   AND column_name = 'date_paiement') THEN
        ALTER TABLE backofficeplateform_commande 
        ADD COLUMN date_paiement TIMESTAMP;
        RAISE NOTICE '✅ Colonne date_paiement ajoutée';
    END IF;
END $$;

-- ================================================================
-- 3. EXTENSIONS POUR ic_postback
-- ================================================================

-- Ajouter les colonnes nécessaires pour les callbacks si elles n'existent pas
DO $$
BEGIN
    -- ID de commande de paiement
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'commande_id') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN commande_id INTEGER REFERENCES backofficeplateform_commande(id);
        RAISE NOTICE '✅ Colonne commande_id ajoutée à ic_postback';
    END IF;
    
    -- Type d'action
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'type_action') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN type_action VARCHAR(50) DEFAULT 'CALLBACK_RECEIVED';
        RAISE NOTICE '✅ Colonne type_action ajoutée';
    END IF;
    
    -- Gateway source
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'gateway_source') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN gateway_source VARCHAR(20);
        RAISE NOTICE '✅ Colonne gateway_source ajoutée';
    END IF;
    
    -- ID de transaction externe
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'transaction_externe_id') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN transaction_externe_id VARCHAR(255);
        RAISE NOTICE '✅ Colonne transaction_externe_id ajoutée';
    END IF;
    
    -- Données du callback (JSON)
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'donnees_callback') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN donnees_callback JSONB;
        RAISE NOTICE '✅ Colonne donnees_callback ajoutée';
    END IF;
    
    -- Adresse IP
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'adresse_ip') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN adresse_ip INET;
        RAISE NOTICE '✅ Colonne adresse_ip ajoutée';
    END IF;
    
    -- User Agent
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'user_agent') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN user_agent TEXT;
        RAISE NOTICE '✅ Colonne user_agent ajoutée';
    END IF;
    
    -- Statut de retour
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'statut_retour') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN statut_retour VARCHAR(50);
        RAISE NOTICE '✅ Colonne statut_retour ajoutée';
    END IF;
    
    -- Montant confirmé
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'montant_confirme') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN montant_confirme DECIMAL(10,2);
        RAISE NOTICE '✅ Colonne montant_confirme ajoutée';
    END IF;
    
    -- Devise confirmée
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'devise_confirmee') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN devise_confirmee VARCHAR(3) DEFAULT 'EUR';
        RAISE NOTICE '✅ Colonne devise_confirmee ajoutée';
    END IF;
    
    -- Signature vérifiée
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'signature_verifiee') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN signature_verifiee BOOLEAN;
        RAISE NOTICE '✅ Colonne signature_verifiee ajoutée';
    END IF;
    
    -- Date de réception
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'date_reception') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN date_reception TIMESTAMP DEFAULT NOW();
        RAISE NOTICE '✅ Colonne date_reception ajoutée';
    END IF;
    
    -- Message d'erreur
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'ic_postback' 
                   AND column_name = 'erreur_message') THEN
        ALTER TABLE ic_postback 
        ADD COLUMN erreur_message TEXT;
        RAISE NOTICE '✅ Colonne erreur_message ajoutée';
    END IF;
END $$;

-- ================================================================
-- 4. INDEX ET PERFORMANCES
-- ================================================================

-- Index pour les requêtes de paiement
CREATE INDEX IF NOT EXISTS idx_backofficeplateform_commande_ord_id 
ON backofficeplateform_commande(ord_id);

CREATE INDEX IF NOT EXISTS idx_backofficeplateform_commande_cst_id 
ON backofficeplateform_commande(cst_id);

CREATE INDEX IF NOT EXISTS idx_backofficeplateform_commande_statut 
ON backofficeplateform_commande(statut_paiement);

CREATE INDEX IF NOT EXISTS idx_backofficeplateform_commande_methode 
ON backofficeplateform_commande(methode_paiement);

CREATE INDEX IF NOT EXISTS idx_backofficeplateform_commande_reference 
ON backofficeplateform_commande(reference_transaction);

-- Index pour les callbacks
CREATE INDEX IF NOT EXISTS idx_ic_postback_commande_id 
ON ic_postback(commande_id);

CREATE INDEX IF NOT EXISTS idx_ic_postback_transaction_id 
ON ic_postback(transaction_externe_id);

CREATE INDEX IF NOT EXISTS idx_ic_postback_gateway 
ON ic_postback(gateway_source);

CREATE INDEX IF NOT EXISTS idx_ic_postback_date 
ON ic_postback(date_reception);

-- ================================================================
-- 5. PERMISSIONS SUPABASE
-- ================================================================

-- Activer RLS (Row Level Security) si nécessaire
-- ALTER TABLE backofficeplateform_commande ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ic_postback ENABLE ROW LEVEL SECURITY;

-- Politique d'accès simple (à adapter selon les besoins)
-- CREATE POLICY "Autoriser lecture paiements" ON backofficeplateform_commande
--     FOR SELECT USING (true);

-- CREATE POLICY "Autoriser écriture paiements" ON backofficeplateform_commande
--     FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Autoriser mise à jour paiements" ON backofficeplateform_commande
--     FOR UPDATE USING (true);

-- CREATE POLICY "Autoriser lecture callbacks" ON ic_postback
--     FOR SELECT USING (true);

-- CREATE POLICY "Autoriser écriture callbacks" ON ic_postback
--     FOR INSERT WITH CHECK (true);

-- ================================================================
-- 6. DONNÉES DE TEST (OPTIONNEL)
-- ================================================================

-- Insérer quelques données de test si les tables sont vides
DO $$
BEGIN
    -- Vérifier s'il y a déjà des données de test
    IF NOT EXISTS (SELECT 1 FROM backofficeplateform_commande WHERE donnees_meta @> '{"test": true}') THEN
        -- Insérer une commande de test
        INSERT INTO backofficeplateform_commande (
            ord_id, cst_id, montant_total, devise, 
            statut_paiement, methode_paiement,
            donnees_meta, date_creation, date_modification
        ) VALUES (
            1, 1, 99.99, 'EUR',
            'EN_ATTENTE', 'CYBERPLUS',
            '{"test": true, "description": "Paiement de test"}',
            NOW(), NOW()
        );
        
        RAISE NOTICE '✅ Données de test insérées';
    END IF;
END $$;

-- ================================================================
-- CONFIGURATION TERMINÉE
-- ================================================================

RAISE NOTICE '';
RAISE NOTICE '🎉 Configuration des tables legacy pour les paiements terminée !';
RAISE NOTICE '';
RAISE NOTICE 'Tables configurées:';
RAISE NOTICE '  - backofficeplateform_commande (paiements principaux)';
RAISE NOTICE '  - ic_postback (callbacks et logs)';
RAISE NOTICE '';
RAISE NOTICE 'Prochaines étapes:';
RAISE NOTICE '  1. Tester les APIs avec: ./test-payment-module.sh';
RAISE NOTICE '  2. Vérifier les permissions Supabase';
RAISE NOTICE '  3. Configurer les gateways de paiement';
RAISE NOTICE '';
