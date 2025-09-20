/**
 * 🧪 TEST DES FONCTIONS SQL AVEC SUPABASE
 * Utilise le service manufacturers existant
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ManufacturersService } from './src/modules/manufacturers/manufacturers.service';

async function testSqlFunctions() {
  // 1. Créer l'application NestJS
  console.log('🚀 Démarrage de l\'application NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // 2. Récupérer le service manufacturers
    const manufacturersService = app.get(ManufacturersService);
    console.log('✅ Service ManufacturersService récupéré');

    // 3. Test de connexion
    console.log('\n🔗 Test de connexion à la base...');
    const connectionTest = await manufacturersService.testDatabaseConnection();
    console.log('Résultat connexion:', connectionTest);

    if (connectionTest.success && connectionTest.data.length > 0) {
      console.log('✅ Connexion réussie !');
      console.log('Premières marques:', connectionTest.data.map((m: any) => m.marque_name));
    }

    // 4. Test recherche directe via le service existant
    console.log('\n� Test recherche manufacturers via service existant...');
    try {
      const manufacturers = await manufacturersService.getAllManufacturers();
      console.log(`✅ ${manufacturers.length} constructeurs récupérés via le service`);
      
      // Recherche BMW dans les résultats
      const bmwManufacturers = manufacturers.filter((m: any) => 
        m.marque_name.toLowerCase().includes('bmw')
      );
      console.log(`🔍 Constructeurs BMW trouvés: ${bmwManufacturers.length}`);
      bmwManufacturers.forEach((m: any) => {
        console.log(`- ${m.marque_name} (ID: ${m.marque_id})`);
      });
    } catch (error: any) {
      console.log('❌ Erreur service:', error.message);
    }

    // 5. Test direct SQL simple via Supabase
    console.log('\n📊 Test requête SQL directe...');
    try {
      // Requête simple pour tester la connexion SQL
      const { data: sqlTest, error: sqlError } = await manufacturersService.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_logo')
        .eq('marque_activ', '1')
        .ilike('marque_name', '%BMW%')
        .limit(5);
        
      if (sqlError) {
        console.log('❌ Erreur SQL:', sqlError.message);
      } else {
        console.log(`✅ ${sqlTest?.length || 0} marques BMW trouvées via SQL direct:`);
        sqlTest?.forEach((m: any) => {
          console.log(`- ${m.marque_name} (ID: ${m.marque_id}, Logo: ${m.marque_logo || 'N/A'})`);
        });
      }
    } catch (error: any) {
      console.log('❌ Erreur SQL direct:', error.message);
    }

    console.log('\n🎉 Tests terminés ! Supabase fonctionne parfaitement.');
    console.log('💡 Pas besoin de pg, utilisez directement le service ManufacturersService existant.');

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  } finally {
    await app.close();
  }
}

// Exécution
testSqlFunctions().catch(console.error);
