/**
 * Tests d'intégration ultra-poussés pour le module Users
 * Basés sur l'analyse legacy complète des 20 fichiers PHP
 * Reproduit tous les workflows identifiés dans users_FICHE_TECHNIQUE.md
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UsersService } from '../../src/modules/users/users.service';
import { UsersController } from '../../src/modules/users/users.controller';
import { SupabaseRestService } from '../../src/database/supabase-rest.service';
import * as request from 'supertest';

describe('👥 MODULE USERS - Tests Ultra-Poussés Legacy Complete', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let prismaService: PrismaService;
  let supabaseService: SupabaseRestService;

  // Variables globales pour les tests
  let testUserId: string;
  let testUserEmail: string;
  let testUserPassword: string;
  let sessionToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [/* Module imports */],
      controllers: [UsersController],
      providers: [UsersService, PrismaService, SupabaseRestService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    supabaseService = moduleFixture.get<SupabaseRestService>(SupabaseRestService);

    // Configuration pour tests
    testUserEmail = `test.user.${Date.now()}@legacy-tests.com`;
    testUserPassword = 'TestPassword123!';
  });

  afterAll(async () => {
    // Nettoyage complet des données de test
    if (testUserId) {
      await prismaService.user.deleteMany({
        where: { email: testUserEmail }
      });
    }
    await app.close();
  });

  describe('🔐 WORKFLOW 1: Authentification utilisateur (myspace.connect.php)', () => {
    it('1.1 - Doit afficher la page de connexion', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/login')
        .expect(200);

      expect(response.text).toContain('Connexion');
      expect(response.text).toContain('email');
      expect(response.text).toContain('password');
    });

    it('1.2 - Doit rejeter les identifiants vides', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: '',
          password: ''
        })
        .expect(400);

      expect(response.body.message).toContain('Email requis');
    });

    it('1.3 - Doit rejeter les identifiants incorrects', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'inexistant@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.message).toContain('Identifiants incorrects');
    });

    it('1.4 - Doit valider l\'authentification avec MD5+crypt (legacy)', async () => {
      // D'abord créer un utilisateur avec hash legacy
      const legacyUser = await usersService.createUserWithLegacyPassword({
        email: testUserEmail,
        password: testUserPassword,
        firstName: 'Test',
        lastName: 'User'
      });

      testUserId = legacyUser.id;

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword
        })
        .expect(200);

      expect(response.body.user.email).toBe(testUserEmail);
      expect(response.body.token).toBeDefined();
      sessionToken = response.body.token;
    });

    it('1.5 - Doit créer une session PHP native (legacy compat)', async () => {
      const sessionData = await usersService.getSessionData(sessionToken);
      
      expect(sessionData).toMatchObject({
        userId: testUserId,
        email: testUserEmail,
        isActive: true,
        sessionStart: expect.any(Date),
        legacyCompatible: true
      });
    });

    it('1.6 - Doit rediriger vers myspace.account.index.php après connexion', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/dashboard')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(response.body.redirectUrl).toBe('/myspace/account');
    });
  });

  describe('👤 WORKFLOW 2: Création de compte (myspace.subscribe.php)', () => {
    const newUserData = {
      email: `new.user.${Date.now()}@legacy-tests.com`,
      password: 'NewPassword123!',
      firstName: 'Nouveau',
      lastName: 'Utilisateur',
      tel: '0123456789',
      address: '123 Rue de Test',
      city: 'Paris',
      zipCode: '75001',
      country: 'FR'
    };

    it('2.1 - Doit afficher le formulaire d\'inscription', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/register')
        .expect(200);

      expect(response.text).toContain('Inscription');
      expect(response.text).toContain('Prénom');
      expect(response.text).toContain('Nom');
      expect(response.text).toContain('Email');
    });

    it('2.2 - Doit valider les données côté serveur', async () => {
      const invalidData = { ...newUserData, email: 'invalid-email' };
      
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toContain('Email invalide');
    });

    it('2.3 - Doit créer un utilisateur dans ___XTR_CUSTOMER (legacy)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUserData)
        .expect(201);

      expect(response.body.user.email).toBe(newUserData.email);
      
      // Vérifier insertion dans la table legacy
      const legacyUser = await supabaseService.getUserByEmail(newUserData.email);
      expect(legacyUser).toMatchObject({
        cst_mail: newUserData.email,
        cst_fname: newUserData.firstName,
        cst_name: newUserData.lastName
      });
    });

    it('2.4 - Doit créer l\'adresse de facturation dans ___XTR_CUSTOMER_BILLING_ADDRESS', async () => {
      const user = await usersService.getUserByEmail(newUserData.email);
      const billingAddress = await supabaseService.getBillingAddressByCustomerId(user.id);

      expect(billingAddress).toMatchObject({
        cba_address: newUserData.address,
        cba_city: newUserData.city,
        cba_zip_code: newUserData.zipCode,
        cba_country: newUserData.country
      });
    });

    it('2.5 - Doit envoyer un email de confirmation', async () => {
      // Mock du service email
      const emailService = app.get('EmailService');
      const sendEmailSpy = jest.spyOn(emailService, 'sendWelcomeEmail');

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...newUserData,
          email: `confirm.${Date.now()}@legacy-tests.com`
        })
        .expect(201);

      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: expect.stringContaining('confirm.'),
          firstName: newUserData.firstName
        })
      );
    });

    it('2.6 - Doit empêcher la création de comptes en double', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUserData) // Même email que le test 2.3
        .expect(409);

      expect(response.body.message).toContain('Email déjà utilisé');
    });
  });

  describe('🔑 WORKFLOW 3: Changement mot de passe (myspace.account.change.pswrd.php)', () => {
    it('3.1 - Doit exiger une authentification', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/change-password')
        .send({
          oldPassword: 'old',
          newPassword: 'new'
        })
        .expect(401);

      expect(response.body.message).toContain('Token requis');
    });

    it('3.2 - Doit valider l\'ancien mot de passe (MD5+crypt)', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          oldPassword: 'wrongpassword',
          newPassword: 'NewPassword456!'
        })
        .expect(400);

      expect(response.body.message).toContain('Ancien mot de passe incorrect');
    });

    it('3.3 - Doit valider la force du nouveau mot de passe', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          oldPassword: testUserPassword,
          newPassword: '123' // Trop faible
        })
        .expect(400);

      expect(response.body.message).toContain('Mot de passe trop faible');
    });

    it('3.4 - Doit changer le mot de passe avec succès', async () => {
      const newPassword = 'SuperNewPassword789!';
      
      const response = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          oldPassword: testUserPassword,
          newPassword: newPassword
        })
        .expect(200);

      expect(response.body.message).toContain('Mot de passe modifié');
      
      // Mettre à jour pour les tests suivants
      testUserPassword = newPassword;
    });

    it('3.5 - Doit mettre à jour le hash dans ___XTR_CUSTOMER', async () => {
      const legacyUser = await supabaseService.getUserByEmail(testUserEmail);
      
      // Vérifier que le hash a changé (legacy MD5+crypt format)
      expect(legacyUser.cst_password).toMatch(/^\$1\$/); // MD5 crypt format
      expect(legacyUser.cst_password).not.toBe(''); // Pas vide
    });

    it('3.6 - Doit forcer la déconnexion après changement', async () => {
      // L'ancien token ne doit plus être valide
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401);

      expect(response.body.message).toContain('Token expiré');
    });

    it('3.7 - Doit permettre la reconnexion avec le nouveau mot de passe', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword
        })
        .expect(200);

      expect(response.body.user.email).toBe(testUserEmail);
      sessionToken = response.body.token; // Nouveau token
    });
  });

  describe('🏠 WORKFLOW 4: Gestion des adresses (myspace.account.change.adr.*.php)', () => {
    describe('4A - Adresse de facturation (myspace.account.change.adr.f.php)', () => {
      const newBillingAddress = {
        address: '456 Nouvelle Rue',
        city: 'Lyon',
        zipCode: '69001',
        country: 'FR'
      };

      it('4A.1 - Doit afficher le formulaire adresse facturation', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/billing-address')
          .set('Authorization', `Bearer ${sessionToken}`)
          .expect(200);

        expect(response.body.address).toBeDefined();
        expect(response.body.formFields).toContain('address');
        expect(response.body.formFields).toContain('zipCode');
      });

      it('4A.2 - Doit valider le format des codes postaux français', async () => {
        const invalidAddress = { ...newBillingAddress, zipCode: '1234' }; // Invalide
        
        const response = await request(app.getHttpServer())
          .put('/users/billing-address')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send(invalidAddress)
          .expect(400);

        expect(response.body.message).toContain('Code postal invalide');
      });

      it('4A.3 - Doit mettre à jour l\'adresse de facturation', async () => {
        const response = await request(app.getHttpServer())
          .put('/users/billing-address')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send(newBillingAddress)
          .expect(200);

        expect(response.body.address).toMatchObject(newBillingAddress);
      });

      it('4A.4 - Doit synchroniser avec ___XTR_CUSTOMER_BILLING_ADDRESS', async () => {
        const user = await usersService.getUserByEmail(testUserEmail);
        const billingAddress = await supabaseService.getBillingAddressByCustomerId(user.id);

        expect(billingAddress).toMatchObject({
          cba_address: newBillingAddress.address,
          cba_city: newBillingAddress.city,
          cba_zip_code: newBillingAddress.zipCode,
          cba_country: newBillingAddress.country
        });
      });
    });

    describe('4B - Adresses de livraison (myspace.account.change.adr.l.php)', () => {
      const deliveryAddress1 = {
        name: 'Domicile',
        address: '789 Rue de Livraison',
        city: 'Marseille',
        zipCode: '13001',
        country: 'FR'
      };

      const deliveryAddress2 = {
        name: 'Bureau',
        address: '321 Avenue du Travail',
        city: 'Toulouse',
        zipCode: '31000',
        country: 'FR'
      };

      it('4B.1 - Doit permettre d\'ajouter une première adresse de livraison', async () => {
        const response = await request(app.getHttpServer())
          .post('/users/delivery-addresses')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send(deliveryAddress1)
          .expect(201);

        expect(response.body.address).toMatchObject(deliveryAddress1);
        expect(response.body.id).toBeDefined();
      });

      it('4B.2 - Doit permettre d\'ajouter plusieurs adresses de livraison', async () => {
        const response = await request(app.getHttpServer())
          .post('/users/delivery-addresses')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send(deliveryAddress2)
          .expect(201);

        expect(response.body.address.name).toBe(deliveryAddress2.name);
      });

      it('4B.3 - Doit lister toutes les adresses de livraison', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/delivery-addresses')
          .set('Authorization', `Bearer ${sessionToken}`)
          .expect(200);

        expect(response.body.addresses).toHaveLength(2);
        expect(response.body.addresses[0].name).toBe(deliveryAddress1.name);
        expect(response.body.addresses[1].name).toBe(deliveryAddress2.name);
      });

      it('4B.4 - Doit synchroniser avec ___XTR_CUSTOMER_DELIVERY_ADDRESS', async () => {
        const user = await usersService.getUserByEmail(testUserEmail);
        const deliveryAddresses = await supabaseService.getDeliveryAddressesByCustomerId(user.id);

        expect(deliveryAddresses).toHaveLength(2);
        expect(deliveryAddresses[0]).toMatchObject({
          cda_name: deliveryAddress1.name,
          cda_address: deliveryAddress1.address
        });
      });

      it('4B.5 - Doit permettre de modifier une adresse existante', async () => {
        const addresses = await request(app.getHttpServer())
          .get('/users/delivery-addresses')
          .set('Authorization', `Bearer ${sessionToken}`)
          .expect(200);

        const addressId = addresses.body.addresses[0].id;
        const updatedAddress = { ...deliveryAddress1, city: 'Nice' };

        const response = await request(app.getHttpServer())
          .put(`/users/delivery-addresses/${addressId}`)
          .set('Authorization', `Bearer ${sessionToken}`)
          .send(updatedAddress)
          .expect(200);

        expect(response.body.address.city).toBe('Nice');
      });

      it('4B.6 - Doit permettre de supprimer une adresse de livraison', async () => {
        const addresses = await request(app.getHttpServer())
          .get('/users/delivery-addresses')
          .set('Authorization', `Bearer ${sessionToken}`)
          .expect(200);

        const addressId = addresses.body.addresses[1].id;

        await request(app.getHttpServer())
          .delete(`/users/delivery-addresses/${addressId}`)
          .set('Authorization', `Bearer ${sessionToken}`)
          .expect(200);

        // Vérifier que l'adresse a été supprimée
        const updatedAddresses = await request(app.getHttpServer())
          .get('/users/delivery-addresses')
          .set('Authorization', `Bearer ${sessionToken}`)
          .expect(200);

        expect(updatedAddresses.body.addresses).toHaveLength(1);
      });
    });
  });

  describe('📋 WORKFLOW 5: Historique des commandes (myspace.account.order.php)', () => {
    let testOrderId: string;

    beforeAll(async () => {
      // Créer une commande de test
      const orderData = {
        customerId: testUserId,
        items: [
          { productId: 'PROD001', quantity: 2, price: 29.99 }
        ],
        billingAddress: { /* adresse */ },
        deliveryAddress: { /* adresse */ }
      };

      const order = await usersService.createTestOrder(orderData);
      testOrderId = order.id;
    });

    it('5.1 - Doit afficher l\'historique des commandes', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/orders')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(response.body.orders).toBeInstanceOf(Array);
      expect(response.body.orders[0]).toMatchObject({
        id: testOrderId,
        customerId: testUserId,
        status: expect.any(String),
        totalAmountTTC: expect.any(Number),
        createdAt: expect.any(String)
      });
    });

    it('5.2 - Doit récupérer depuis ___XTR_ORDER avec jointures', async () => {
      const legacyOrders = await supabaseService.getOrdersByCustomerId(testUserId);
      
      expect(legacyOrders).toHaveLength(1);
      expect(legacyOrders[0]).toMatchObject({
        ord_cst_id: testUserId,
        ord_total_ttc: expect.any(Number),
        ord_ords_id: expect.any(String), // Status ID
        ord_date: expect.any(String)
      });
    });

    it('5.3 - Doit joindre avec ___XTR_ORDER_STATUS pour les libellés', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/orders')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      const order = response.body.orders[0];
      expect(order.statusLabel).toBeDefined();
      expect(order.statusLabel).not.toBe(order.status); // Label != ID
    });

    it('5.4 - Doit afficher le lien vers la facture si payée', async () => {
      // Marquer la commande comme payée
      await usersService.updateOrderStatus(testOrderId, 'PAID');

      const response = await request(app.getHttpServer())
        .get('/users/orders')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      const order = response.body.orders[0];
      expect(order.invoiceUrl).toBeDefined();
      expect(order.invoiceUrl).toContain('/invoices/');
    });

    it('5.5 - Doit permettre le téléchargement de facture', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('💬 WORKFLOW 6: Messages utilisateur (myspace.account.msg.fil.php)', () => {
    it('6.1 - Doit récupérer les messages depuis ___XTR_MSG', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/messages')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(response.body.messages).toBeInstanceOf(Array);
    });

    it('6.2 - Doit marquer les messages comme lus', async () => {
      // Créer un message de test
      await supabaseService.createMessage({
        msg_cst_id: testUserId,
        msg_content: 'Message de test',
        msg_read: false
      });

      const messages = await request(app.getHttpServer())
        .get('/users/messages')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      const messageId = messages.body.messages[0].id;

      await request(app.getHttpServer())
        .put(`/users/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      // Vérifier que le message est marqué comme lu
      const updatedMessage = await supabaseService.getMessageById(messageId);
      expect(updatedMessage.msg_read).toBe(true);
    });
  });

  describe('🚪 WORKFLOW 7: Déconnexion (myspace.account.out.php)', () => {
    it('7.1 - Doit permettre la déconnexion', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(response.body.message).toContain('Déconnecté');
    });

    it('7.2 - Doit invalider le token de session', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401);

      expect(response.body.message).toContain('Token invalide');
    });

    it('7.3 - Doit nettoyer la session PHP (legacy)', async () => {
      const sessionExists = await usersService.checkSessionExists(sessionToken);
      expect(sessionExists).toBe(false);
    });
  });

  describe('🔒 WORKFLOW 8: Réinitialisation mot de passe (myspace.pswd.*.php)', () => {
    it('8.1 - Doit permettre la demande de réinitialisation', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: testUserEmail })
        .expect(200);

      expect(response.body.message).toContain('Email envoyé');
    });

    it('8.2 - Doit générer un token sécurisé', async () => {
      const user = await usersService.getUserByEmail(testUserEmail);
      const resetToken = await supabaseService.getPasswordResetToken(user.id);

      expect(resetToken).toBeDefined();
      expect(resetToken.length).toBeGreaterThan(32);
      expect(resetToken).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('8.3 - Doit valider et exécuter la réinitialisation', async () => {
      const user = await usersService.getUserByEmail(testUserEmail);
      const resetToken = await supabaseService.getPasswordResetToken(user.id);
      const newPassword = 'ResetPassword123!';

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword
        })
        .expect(200);

      expect(response.body.message).toContain('Mot de passe réinitialisé');

      // Vérifier la connexion avec le nouveau mot de passe
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUserEmail,
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body.user.email).toBe(testUserEmail);
    });
  });

  describe('📊 TESTS DE PERFORMANCE ET CHARGE', () => {
    it('PERF.1 - Doit gérer 100 connexions simultanées', async () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword
          });
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(95); // 95% de succès minimum
    });

    it('PERF.2 - Doit maintenir des temps de réponse < 500ms', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('🛡️ TESTS DE SÉCURITÉ LEGACY', () => {
    it('SEC.1 - Doit résister aux attaques par injection SQL', async () => {
      const maliciousEmail = "'; DROP TABLE users; --";
      
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: maliciousEmail,
          password: 'password'
        })
        .expect(401);

      // Vérifier que la table existe toujours
      const usersCount = await prismaService.user.count();
      expect(usersCount).toBeGreaterThan(0);
    });

    it('SEC.2 - Doit limiter les tentatives de connexion (brute force)', async () => {
      const promises = Array.from({ length: 10 }, () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUserEmail,
            password: 'wrongpassword'
          });
      });

      await Promise.all(promises);

      // La 11ème tentative doit être bloquée
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUserEmail,
          password: 'wrongpassword'
        })
        .expect(429);

      expect(response.body.message).toContain('Trop de tentatives');
    });

    it('SEC.3 - Doit valider la compatibilité MD5+crypt legacy', async () => {
      // Créer un utilisateur avec hash legacy MD5+crypt
      const legacyHash = '$1$salt$encrypted_hash_here';
      const legacyUser = await supabaseService.createUserWithLegacyHash({
        email: 'legacy@example.com',
        password: legacyHash,
        firstName: 'Legacy',
        lastName: 'User'
      });

      // Vérifier que le hash est conservé
      expect(legacyUser.cst_password).toBe(legacyHash);
      expect(legacyUser.cst_password).toMatch(/^\$1\$/);
    });
  });

  describe('🔄 TESTS DE SYNCHRONISATION LEGACY', () => {
    it('SYNC.1 - Doit synchroniser Prisma ↔ SupabaseRest', async () => {
      // Modifier dans Prisma
      await prismaService.user.update({
        where: { id: testUserId },
        data: { firstName: 'Modified' }
      });

      // Vérifier sync vers legacy
      const legacyUser = await supabaseService.getUserById(testUserId);
      expect(legacyUser.cst_fname).toBe('Modified');
    });

    it('SYNC.2 - Doit maintenir l\'intégrité référentielle', async () => {
      // Supprimer un utilisateur
      await usersService.deleteUser(testUserId);

      // Vérifier que les données liées sont aussi supprimées
      const billingAddresses = await supabaseService.getBillingAddressByCustomerId(testUserId);
      const deliveryAddresses = await supabaseService.getDeliveryAddressesByCustomerId(testUserId);
      
      expect(billingAddresses).toBeNull();
      expect(deliveryAddresses).toHaveLength(0);
    });
  });

  describe('📈 TESTS DE COMPATIBILITÉ ASCENDANTE', () => {
    it('COMPAT.1 - Doit supporter les anciennes URLs (v7.myspace.*.php)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v7/myspace/connect')
        .expect(200);

      expect(response.text).toContain('Connexion');
    });

    it('COMPAT.2 - Doit maintenir les formats de données legacy', async () => {
      const user = await usersService.getUserByEmail(testUserEmail);
      const legacyFormat = await usersService.formatForLegacy(user);

      expect(legacyFormat).toMatchObject({
        cst_id: expect.any(String),
        cst_mail: testUserEmail,
        cst_fname: expect.any(String),
        cst_name: expect.any(String),
        cst_date_add: expect.any(String),
        cst_activ: '1' // Format legacy boolean
      });
    });
  });
});
