/**
 * 🧪 Test Complet - Service Email + Actions Commandes
 * 
 * Ce script teste l'envoi d'emails pour différentes actions
 * sur une commande fictive (pas besoin de DB)
 */

const { Resend } = require('resend');

const resend = new Resend('re_hVVVLJC8_CX8cYeKyF2YnYX7Dbxqduh7R');

// Données fictives pour test
const fakeOrder = {
  ord_id: 'TEST-001',
  ord_total_ttc: '149.99',
  ord_date: new Date().toISOString(),
  ord_ords_id: '3',
};

const fakeCustomer = {
  cst_id: 1,
  cst_fname: 'John',
  cst_name: 'Doe',
  cst_mail: 'automecanik.seo@gmail.com',
};

async function testOrderConfirmation() {
  console.log('\n📧 Test 1/4 : Email de confirmation de commande...');
  
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: fakeCustomer.cst_mail,
      subject: `✅ Commande ${fakeOrder.ord_id} confirmée`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .box { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;">✅ Commande Confirmée</h1>
            </div>
            <div class="content">
              <p>Bonjour <strong>${fakeCustomer.cst_fname} ${fakeCustomer.cst_name}</strong>,</p>
              <p>Votre commande a été validée et est en cours de préparation. 🎉</p>
              
              <div class="box">
                <h3>📦 Détails de votre commande</h3>
                <p><strong>Numéro :</strong> #${fakeOrder.ord_id}</p>
                <p><strong>Montant :</strong> ${fakeOrder.ord_total_ttc} €</p>
                <p><strong>Statut :</strong> <span style="color: #10b981;">✓ En préparation</span></p>
              </div>
              
              <p>Vous recevrez un email dès l'expédition de votre colis.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log('   ✅ Envoyé avec succès !', result.data);
  } catch (error) {
    console.error('   ❌ Erreur:', error.message);
  }
}

async function testShippingNotification() {
  console.log('\n📦 Test 2/4 : Email d\'expédition...');
  
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: fakeCustomer.cst_mail,
      subject: `📦 Commande ${fakeOrder.ord_id} expédiée`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .tracking { background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #10b981; }
            .tracking-number { font-size: 24px; font-weight: bold; color: #059669; letter-spacing: 2px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;">📦 Colis Expédié</h1>
            </div>
            <div class="content">
              <p>Bonjour <strong>${fakeCustomer.cst_fname} ${fakeCustomer.cst_name}</strong>,</p>
              <p>Votre commande <strong>#${fakeOrder.ord_id}</strong> a été expédiée ! 🚚</p>
              
              <div class="tracking">
                <p style="margin:0; font-weight:600;">Numéro de suivi</p>
                <div class="tracking-number">FR1234567890</div>
              </div>
              
              <p>💡 Délai de livraison estimé : 2 à 5 jours ouvrés</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log('   ✅ Envoyé avec succès !', result.data);
  } catch (error) {
    console.error('   ❌ Erreur:', error.message);
  }
}

async function testPaymentReminder() {
  console.log('\n💳 Test 3/4 : Email de rappel de paiement...');
  
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: fakeCustomer.cst_mail,
      subject: `💳 Rappel : Commande ${fakeOrder.ord_id} en attente de paiement`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .warning { background: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; text-align: center; }
            .amount { font-size: 32px; font-weight: bold; color: #d97706; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;">💳 Paiement en Attente</h1>
            </div>
            <div class="content">
              <p>Bonjour <strong>${fakeCustomer.cst_fname} ${fakeCustomer.cst_name}</strong>,</p>
              <p>Nous n'avons pas encore reçu le paiement pour votre commande.</p>
              
              <div class="warning">
                <p style="margin:0; font-weight:600;">Montant à régler</p>
                <div class="amount">${fakeOrder.ord_total_ttc} €</div>
              </div>
              
              <p>Pour finaliser votre commande, veuillez procéder au paiement.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log('   ✅ Envoyé avec succès !', result.data);
  } catch (error) {
    console.error('   ❌ Erreur:', error.message);
  }
}

async function testCancellation() {
  console.log('\n❌ Test 4/4 : Email d\'annulation...');
  
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: fakeCustomer.cst_mail,
      subject: `❌ Commande ${fakeOrder.ord_id} annulée`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .info { background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;">❌ Commande Annulée</h1>
            </div>
            <div class="content">
              <p>Bonjour <strong>${fakeCustomer.cst_fname} ${fakeCustomer.cst_name}</strong>,</p>
              <p>Votre commande <strong>#${fakeOrder.ord_id}</strong> a été annulée.</p>
              
              <div class="info">
                <p style="margin:0; font-weight:600;">📋 Raison de l'annulation</p>
                <p style="margin:10px 0 0 0;">Produit temporairement indisponible</p>
              </div>
              
              <p>💰 Si vous avez déjà payé, vous serez remboursé sous 5 à 7 jours ouvrés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log('   ✅ Envoyé avec succès !', result.data);
  } catch (error) {
    console.error('   ❌ Erreur:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Démarrage des tests d\'envoi d\'emails...');
  console.log('📬 Destination:', fakeCustomer.cst_mail);
  console.log('━'.repeat(60));
  
  await testOrderConfirmation();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Pause 1s
  
  await testShippingNotification();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testPaymentReminder();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testCancellation();
  
  console.log('\n' + '━'.repeat(60));
  console.log('✅ Tous les tests terminés !');
  console.log('\n📧 Vérifiez votre boîte email: ' + fakeCustomer.cst_mail);
  console.log('📊 Dashboard Resend: https://resend.com/emails');
  console.log('\n💡 Vous devriez avoir reçu 4 emails différents.');
}

runAllTests();
