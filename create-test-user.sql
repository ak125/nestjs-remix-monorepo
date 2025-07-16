-- Script pour créer un utilisateur de test
-- Utilisateur: test@example.com
-- Mot de passe: test123

-- Supprimer l'utilisateur existant s'il existe
DELETE FROM ___xtr_customer WHERE cst_mail = 'test@example.com';

-- Insérer un utilisateur avec un hash bcrypt pour 'test123'
INSERT INTO ___xtr_customer (
    cst_id, 
    cst_mail, 
    cst_pswd, 
    cst_fname, 
    cst_name, 
    cst_activ, 
    cst_is_pro,
    cst_tel,
    cst_address,
    cst_city,
    cst_zip_code,
    cst_country
) VALUES (
    'test-user-123',
    'test@example.com',
    '$2b$10$XRuTpPvLjLrIJuP2JGmDC.zdi476MP5Guxg.fIhUPDg7areE0W27G',  -- hash bcrypt pour 'test123'
    'Test',
    'User',
    '1',
    '0',
    '0123456789',
    '123 Test Street',
    'Test City',
    '12345',
    'France'
);

-- Vérifier que l'utilisateur a été créé
SELECT cst_id, cst_mail, cst_fname, cst_name, cst_activ FROM ___xtr_customer WHERE cst_mail = 'test@example.com';
