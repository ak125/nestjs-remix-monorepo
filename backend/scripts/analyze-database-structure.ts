#!/usr/bin/env ts-node
/**
 * 🔍 Script de Diagnostic Détaillé - Structure des Tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeTableStructure() {
  console.log('🔍 ANALYSE DÉTAILLÉE DES TABLES');
  console.log('================================\n');

  // Tables à analyser
  const tablesToCheck = [
    '___xtr_customer',
    '___xtr_order', 
    '___xtr_product',
    '___xtr_msg',
    'cart',
    'cart_items',
    'products',
    'users',
    'orders'
  ];

  for (const tableName of tablesToCheck) {
    await analyzeTable(tableName);
  }
}

async function analyzeTable(tableName: string) {
  console.log(`\n📋 TABLE: ${tableName}`);
  console.log('─'.repeat(50));

  try {
    // 1. Compter les enregistrements
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`❌ Table non accessible: ${countError.message}`);
      return;
    }

    console.log(`📊 Nombre d'enregistrements: ${count}`);

    // 2. Analyser la structure avec un échantillon
    if (count && count > 0) {
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!sampleError && sample && sample.length > 0) {
        const record = sample[0];
        console.log('\n🔧 Structure des colonnes:');
        
        Object.entries(record).forEach(([key, value]) => {
          const type = typeof value;
          const valuePreview = type === 'string' ? 
            `"${String(value).substring(0, 30)}${String(value).length > 30 ? '...' : ''}"` :
            String(value);
          
          console.log(`  • ${key}: ${type} = ${valuePreview}`);
        });

        // 3. Identifier les champs importants
        console.log('\n🎯 Champs identifiés:');
        identifyImportantFields(tableName, Object.keys(record));
      }
    } else {
      console.log('📝 Table vide');
    }

  } catch (error) {
    console.log(`❌ Erreur: ${error}`);
  }
}

function identifyImportantFields(tableName: string, columns: string[]) {
  const patterns = {
    id: ['id', '_id', 'customer_id', 'ord_id', 'prd_id', 'msg_id'],
    email: ['email', '_email', 'customer_email'],
    name: ['name', '_name', 'customer_name', 'firstname', 'lastname'],
    price: ['price', '_price', 'total', '_total', 'amount'],
    status: ['status', '_status', 'state'],
    dates: ['created_at', 'updated_at', '_at', 'date'],
    user_ref: ['user_id', 'customer_id', 'cst_id', 'usr_id'],
    order_ref: ['order_id', 'ord_id']
  };

  Object.entries(patterns).forEach(([category, keywords]) => {
    const found = columns.filter(col => 
      keywords.some(keyword => 
        col.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    if (found.length > 0) {
      console.log(`    ${category}: ${found.join(', ')}`);
    }
  });
}

async function testCRUDOperations() {
  console.log('\n\n🧪 TEST DES OPÉRATIONS CRUD');
  console.log('=============================');

  // Test Users
  await testUsersOperations();
  
  // Test Orders
  await testOrdersOperations();
  
  // Test Products (si la table existe)
  await testProductsOperations();
}

async function testUsersOperations() {
  console.log('\n👤 Test CRUD Users (___xtr_customer):');
  
  try {
    // READ - Récupérer quelques utilisateurs
    const { data: users, error } = await supabase
      .from('___xtr_customer')
      .select('*')
      .limit(3);

    if (error) {
      console.log(`  ❌ Lecture: ${error.message}`);
      return;
    }

    console.log(`  ✅ Lecture: ${users?.length} utilisateurs récupérés`);
    
    if (users && users.length > 0) {
      const user = users[0];
      console.log(`    Premier utilisateur: ID ${user.customer_id || user.id}`);
      
      // Identifier les champs email
      const emailField = Object.keys(user).find(key => 
        key.toLowerCase().includes('email')
      );
      if (emailField) {
        console.log(`    Email: ${user[emailField]}`);
      }
    }

  } catch (error) {
    console.log(`  ❌ Erreur users: ${error}`);
  }
}

async function testOrdersOperations() {
  console.log('\n📦 Test CRUD Orders (___xtr_order):');
  
  try {
    const { data: orders, error } = await supabase
      .from('___xtr_order')
      .select('*')
      .limit(3);

    if (error) {
      console.log(`  ❌ Lecture: ${error.message}`);
      return;
    }

    console.log(`  ✅ Lecture: ${orders?.length} commandes récupérées`);
    
    if (orders && orders.length > 0) {
      const order = orders[0];
      console.log(`    Première commande: ID ${order.ord_id || order.order_id || order.id}`);
      
      // Calculer le total des commandes
      const totalField = Object.keys(order).find(key => 
        key.toLowerCase().includes('total') || key.toLowerCase().includes('amount')
      );
      if (totalField) {
        console.log(`    Total: ${order[totalField]}`);
      }
    }

  } catch (error) {
    console.log(`  ❌ Erreur orders: ${error}`);
  }
}

async function testProductsOperations() {
  console.log('\n📦 Test Products:');
  
  // Tester d'abord ___xtr_product
  try {
    const { data: xtrProducts, error: xtrError } = await supabase
      .from('___xtr_product')
      .select('*')
      .limit(3);

    if (!xtrError && xtrProducts && xtrProducts.length > 0) {
      console.log(`  ✅ ___xtr_product: ${xtrProducts.length} produits trouvés`);
      const product = xtrProducts[0];
      console.log(`    Premier produit: ${product.prd_name || product.name || 'Nom non défini'}`);
    } else {
      console.log(`  ❌ ___xtr_product: Table non trouvée ou vide`);
    }
  } catch (error) {
    console.log(`  ❌ ___xtr_product: ${error}`);
  }

  // Tester ensuite products moderne
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .limit(3);

    if (!error && products && products.length > 0) {
      console.log(`  ✅ products: ${products.length} produits trouvés`);
    } else {
      console.log(`  ❌ products: Table non trouvée ou vide`);
    }
  } catch (error) {
    console.log(`  ❌ products: ${error}`);
  }
}

async function generateServiceCode() {
  console.log('\n\n🚀 GÉNÉRATION DE CODE RECOMMANDÉ');
  console.log('=================================');
  
  console.log(`
✅ SERVICES EXISTANTS À UTILISER:

1. UserDataService (src/database/services/user-data.service.ts)
   → Connecté à ___xtr_customer
   → Prêt à utiliser

2. OrderDataService (src/database/services/order-data.service.ts)  
   → Connecté à ___xtr_order
   → Prêt à utiliser

🔧 SERVICES À CRÉER:

3. CartService → Table de panier manquante
4. ProductService → Vérifier quelle table utiliser

📋 ENDPOINTS À IMPLÉMENTER:

// UserController
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id

// OrderController  
GET    /api/orders
GET    /api/orders/:id
POST   /api/orders
PUT    /api/orders/:id/status

// ProductController
GET    /api/products
GET    /api/products/:id
GET    /api/products/search

// CartController
GET    /api/cart
POST   /api/cart/add
PUT    /api/cart/update
DELETE /api/cart/remove
  `);
}

// Exécution
async function main() {
  await analyzeTableStructure();
  await testCRUDOperations();
  await generateServiceCode();
  process.exit(0);
}

main().catch(console.error);
