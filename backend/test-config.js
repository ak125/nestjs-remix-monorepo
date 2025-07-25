// Test rapide de configuration
require('dotenv').config();
const { ConfigModule, ConfigService } = require('@nestjs/config');

console.log('=== TEST CONFIGURATION ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'PRESENT' : 'MISSING');

// Test ConfigService
async function testConfigService() {
  try {
    const config = new ConfigService();
    console.log('ConfigService SUPABASE_URL:', config.get('SUPABASE_URL'));
    console.log('ConfigService REDIS_URL:', config.get('REDIS_URL'));
  } catch (error) {
    console.error('Erreur ConfigService:', error.message);
  }
}

testConfigService();
