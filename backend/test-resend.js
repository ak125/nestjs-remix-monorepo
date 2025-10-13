/**
 * 📧 Test Resend - Premier Email
 * 
 * Script simple pour tester l'envoi d'email avec Resend
 */

const { Resend } = require('resend');

const resend = new Resend('re_hVVVLJC8_CX8cYeKyF2YnYX7Dbxqduh7R');

async function sendTestEmail() {
  try {
    console.log('📧 Envoi du premier email de test...');
    
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'automecanik.seo@gmail.com',
      subject: '✅ Test Email - AutoParts',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 12px;
            }
            .success {
              background: #10b981;
              color: white;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
              font-weight: bold;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Premier Email avec Resend</h1>
          </div>
          <div class="content">
            <p><strong>Félicitations !</strong></p>
            <p>Vous avez réussi à envoyer votre premier email avec <strong>Resend</strong>.</p>
            
            <div class="success">
              ✅ Configuration Resend Réussie
            </div>
            
            <h3>📋 Prochaines étapes :</h3>
            <ul>
              <li>✅ Resend configuré et fonctionnel</li>
              <li>📧 Service email prêt pour les commandes</li>
              <li>🚀 Intégration avec NestJS en cours</li>
            </ul>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              <strong>Informations techniques :</strong><br>
              API Key: re_hVVVLJC8_***<br>
              From: onboarding@resend.dev<br>
              To: automecanik.seo@gmail.com
            </p>
          </div>
        </body>
        </html>
      `
    });

    console.log('✅ Email envoyé avec succès !');
    console.log('📊 Résultat:', data);
    console.log('');
    console.log('🎯 Vérifiez votre boîte email: automecanik.seo@gmail.com');
    console.log('📧 Dashboard Resend: https://resend.com/emails');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi:', error);
  }
}

sendTestEmail();
