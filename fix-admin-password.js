const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Configuration PostgreSQL (locale car c'est un dev container)
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'autoparts_db',
  user: 'postgres',
  password: 'password'
});

async function fixAdminPassword() {
  try {
    console.log('🔧 Réinitialisation du mot de passe super admin...');
    
    const email = 'superadmin@autoparts.com';
    const password = 'superadmin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('🔐 Nouveau hash:', hashedPassword);
    
    // Mettre à jour ou insérer l'admin
    const query = `
      INSERT INTO ___config_admin (adm_login, adm_pass, adm_nom, adm_prenom, adm_level, adm_email, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (adm_login) 
      DO UPDATE SET 
        adm_pass = EXCLUDED.adm_pass,
        adm_nom = EXCLUDED.adm_nom,
        adm_prenom = EXCLUDED.adm_prenom,
        adm_level = EXCLUDED.adm_level,
        adm_email = EXCLUDED.adm_email,
        is_active = EXCLUDED.is_active
      RETURNING *;
    `;
    
    const result = await pool.query(query, [
      email,           // adm_login
      hashedPassword,  // adm_pass
      'Super',         // adm_nom
      'Admin',         // adm_prenom
      9,               // adm_level
      email,           // adm_email
      true             // is_active
    ]);
    
    console.log('✅ Admin mis à jour:', result.rows[0]);
    console.log('📧 Email: superadmin@autoparts.com');
    console.log('🔑 Mot de passe: superadmin123');
    console.log('📊 Niveau: 9 (Super Admin)');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

fixAdminPassword();
