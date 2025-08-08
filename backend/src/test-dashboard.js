/**
 * Script de test pour les statistiques du dashboard
 */

const fetch = require('node-fetch');

async function testDashboardStats() {
  try {
    console.log('🔧 Test des APIs individuelles...');
    
    // Test API Orders
    const ordersResponse = await fetch('http://localhost:3000/api/orders/admin/all-relations?page=1&limit=1');
    const ordersData = await ordersResponse.json();
    console.log('📦 Orders API response keys:', Object.keys(ordersData));
    console.log('📦 Orders total found:', ordersData.total || ordersData.totalOrders || 'N/A');
    
    // Test API Users
    const usersResponse = await fetch('http://localhost:3000/api/users?page=1&limit=1');
    const usersData = await usersResponse.json();
    console.log('👥 Users API response keys:', Object.keys(usersData));
    console.log('👥 Users total found:', usersData.total || usersData.totalUsers || 'N/A');
    
    console.log('\n📊 Structure complète ordersData:', JSON.stringify(ordersData, null, 2));
    console.log('\n👥 Structure complète usersData:', JSON.stringify(usersData, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
  }
}

testDashboardStats();
