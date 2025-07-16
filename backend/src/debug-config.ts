import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export function debugConfiguration(configService: ConfigService) {
  console.log('🔍 DEBUG CONFIGURATION:');
  console.log('---------------------------');
  
  // Vérifier l'existence du fichier .env
  const envPath = path.join(process.cwd(), '.env');
  console.log('📂 Chemin .env:', envPath);
  console.log('📄 Fichier .env existe:', fs.existsSync(envPath));
  
  if (fs.existsSync(envPath)) {
    console.log('📝 Contenu .env:');
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log(envContent);
  }
  
  // Vérifier les variables d'environnement
  console.log('🌍 Variables d\'environnement:');
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  console.log('  - SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...');
  
  // Vérifier ConfigService
  console.log('⚙️  ConfigService:');
  console.log('  - SUPABASE_URL:', configService.get<string>('SUPABASE_URL'));
  console.log('  - SUPABASE_SERVICE_ROLE_KEY:', configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 30) + '...');
  
  console.log('---------------------------');
}
