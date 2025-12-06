#!/usr/bin/env node
/**
 * 🔍 VÉRIFICATION DES IMAGES SUPABASE
 * 
 * Vérifie que les images existent bien dans les buckets Supabase
 * Teste les 3 formats d'URLs stockées en BDD
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * URLs de test (9 formats découverts)
 */
const TEST_URLS = [
  // FORMAT 1: Images produits /rack/
  { 
    original: '/rack/101/34407_1.JPG',
    bucket: 'rack-images',
    path: '101/34407_1.JPG',
    type: 'RACK - Produits'
  },
  
  // FORMAT 2: Images gammes-produits
  {
    original: '/upload/articles/gammes-produits/catalogue/filtre-a-huile.webp',
    bucket: 'uploads',
    path: 'articles/gammes-produits/catalogue/filtre-a-huile.webp',
    type: 'GAMME - Catalogue'
  },
  
  // FORMAT 3: Images familles-produits
  {
    original: '/upload/articles/familles-produits/Filtres.webp',
    bucket: 'uploads',
    path: 'articles/familles-produits/Filtres.webp',
    type: 'FAMILLE - Catégories'
  },
  
  // FORMAT 4: Logos constructeurs (icons)
  {
    original: '/upload/constructeurs-automobiles/icon/bmw.webp',
    bucket: 'uploads',
    path: 'constructeurs-automobiles/icon/bmw.webp',
    type: 'CONSTRUCTEUR - Icon'
  },
  
  // FORMAT 5: Logos constructeurs (icon-50)
  {
    original: '/upload/constructeurs-automobiles/icon-50/bmw.webp',
    bucket: 'uploads',
    path: 'constructeurs-automobiles/icon-50/bmw.webp',
    type: 'CONSTRUCTEUR - Icon 50px'
  },
  
  // FORMAT 6: Logos marques
  {
    original: '/upload/constructeurs-automobiles/marques-logos/bmw.webp',
    bucket: 'uploads',
    path: 'constructeurs-automobiles/marques-logos/bmw.webp',
    type: 'MARQUE - Logo'
  },
  
  // FORMAT 7: Logos équipementiers
  {
    original: '/upload/equipementiers-automobiles/bosch.webp',
    bucket: 'uploads',
    path: 'equipementiers-automobiles/bosch.webp',
    type: 'ÉQUIPEMENTIER - Logo'
  },
  
  // FORMAT 8: Blog/Conseils
  {
    original: '/upload/blog/conseils/20190819125821.jpg',
    bucket: 'uploads',
    path: 'blog/conseils/20190819125821.jpg',
    type: 'BLOG - Articles'
  },
  
  // FORMAT 9: Assets/Favicon
  {
    original: '/upload/upload/favicon/favicon-32x32.png',
    bucket: 'uploads',
    path: 'upload/favicon/favicon-32x32.png',
    type: 'ASSETS - Favicon'
  }
];

async function checkImageExists(bucket, path) {
  try {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .list(path.split('/').slice(0, -1).join('/'), {
        limit: 100,
        search: path.split('/').pop()
      });

    if (error) {
      return { exists: false, error: error.message };
    }

    const filename = path.split('/').pop();
    const fileExists = data?.some(file => file.name === filename);
    
    return { exists: fileExists, data };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function listBuckets() {
  console.log('\n📦 LISTE DES BUCKETS DISPONIBLES:\n');
  const { data, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  data.forEach(bucket => {
    console.log(`   ✓ ${bucket.name} (${bucket.public ? 'public' : 'privé'})`);
  });
}

async function verifyImages() {
  console.log('🔍 VÉRIFICATION DES IMAGES SUPABASE\n');
  console.log(`📍 URL: ${SUPABASE_URL}\n`);

  await listBuckets();

  console.log('\n\n🧪 TEST DES 3 FORMATS D\'URLS:\n');

  for (const test of TEST_URLS) {
    console.log(`\n[${ test.type}]`);
    console.log(`   URL originale: ${test.original}`);
    console.log(`   Bucket: ${test.bucket}`);
    console.log(`   Chemin: ${test.path}`);

    const result = await checkImageExists(test.bucket, test.path);

    if (result.exists) {
      console.log(`   ✅ Image trouvée`);
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${test.bucket}/${test.path}`;
      console.log(`   🔗 URL publique: ${publicUrl}`);
    } else {
      console.log(`   ❌ Image introuvable`);
      if (result.error) {
        console.log(`   💥 Erreur: ${result.error}`);
      }
      if (result.data && result.data.length > 0) {
        console.log(`   📁 Fichiers trouvés dans le dossier (${result.data.length}):`);
        result.data.slice(0, 5).forEach(f => {
          console.log(`      - ${f.name}`);
        });
      }
    }
  }

  console.log('\n\n📊 STATISTIQUES DES BUCKETS:\n');

  // Statistiques rack-images
  try {
    const { data: rackFiles } = await supabase.storage.from('rack-images').list('', { limit: 1000 });
    console.log(`   rack-images: ${rackFiles?.length || 0} dossiers`);
  } catch (err) {
    console.log(`   rack-images: Erreur - ${err.message}`);
  }

  // Statistiques uploads
  try {
    const { data: uploadFiles } = await supabase.storage.from('uploads').list('articles', { limit: 100 });
    console.log(`   uploads/articles: ${uploadFiles?.length || 0} sous-dossiers`);
  } catch (err) {
    console.log(`   uploads: Erreur - ${err.message}`);
  }

  console.log('\n✨ Vérification terminée\n');
}

verifyImages().catch(console.error);
