const bcrypt = require('bcryptjs');

// Générer le hash bcrypt correct pour le mot de passe
async function generatePasswordHash() {
    const password = 'SuperAdmin2025!';
    const saltRounds = 12;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('🔑 Mot de passe:', password);
        console.log('🔐 Hash bcrypt:', hash);
        console.log('');
        console.log('📋 Script SQL à exécuter dans Supabase:');
        console.log('');
        console.log(`-- Créer le Super Admin niveau 9 avec hash bcrypt correct
INSERT INTO ___config_admin (
    cnfa_id,
    cnfa_login,
    cnfa_pswd,
    cnfa_mail,
    cnfa_keylog,
    cnfa_level,
    cnfa_job,
    cnfa_name,
    cnfa_fname,
    cnfa_tel,
    cnfa_activ
) VALUES (
    'adm_superadmin_' || extract(epoch from now())::text,
    'superadmin',
    '${hash}',
    'superadmin@autoparts.com',
    encode(gen_random_bytes(16), 'hex'),
    '9',
    'Super Administrator',
    'Super',
    'Admin',
    '+33 1 00 00 00 00',
    '1'
);`);
        
        console.log('');
        console.log('✅ Copiez le script ci-dessus dans l\'éditeur SQL de Supabase');
        
        // Test de vérification du hash
        const isValid = await bcrypt.compare(password, hash);
        console.log('');
        console.log('🧪 Test de validation:', isValid ? 'SUCCÈS' : 'ÉCHEC');
        
    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

generatePasswordHash();
