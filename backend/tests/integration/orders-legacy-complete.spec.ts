/**
 * Tests d'intégration ultra-poussés pour le module Orders
 * Basés sur l'analyse legacy complète des 14 fichiers PHP
 * Reproduit tous les workflows identifiés dans orders_FICHE_TECHNIQUE.md
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { OrdersController } from '../../src/modules/orders/orders.controller';
import { AutomotiveOrdersService } from '../../src/modules/automotive/automotive-orders.service';
import { TaxCalculationService } from '../../src/modules/automotive/tax-calculation.service';
import { SupabaseRestService } from '../../src/database/supabase-rest.service';
import * as request from 'supertest';

describe('🛒 MODULE ORDERS - Tests Ultra-Poussés Legacy Complete', () => {
  let app: INestApplication;
  let ordersService: OrdersService;
  let automotiveService: AutomotiveOrdersService;
  let taxService: TaxCalculationService;
  let prismaService: PrismaService;
  let supabaseService: SupabaseRestService;

  // Variables globales pour les tests
  let testCustomerId: string;
  let testOrderId: string;
  let testProductId: string;
  let authToken: string;

  // Données de test complètes
  const testCustomer = {
    email: `order.customer.${Date.now()}@legacy-tests.com`,
    password: 'OrderTest123!',
    firstName: 'Order',
    lastName: 'Customer'
  };

  const testProduct = {
    ref: 'PROD-LEGACY-001',
    name: 'Produit Test Legacy',
    price: 49.99,
    vat_rate: 20.0,
    stock_quantity: 100,
    weight: 1.5,
    category: 'automotive'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [/* Module imports */],
      controllers: [OrdersController],
      providers: [
        OrdersService,
        AutomotiveOrdersService,
        TaxCalculationService,
        PrismaService,
        SupabaseRestService
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    ordersService = moduleFixture.get<OrdersService>(OrdersService);
    automotiveService = moduleFixture.get<AutomotiveOrdersService>(AutomotiveOrdersService);
    taxService = moduleFixture.get<TaxCalculationService>(TaxCalculationService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    supabaseService = moduleFixture.get<SupabaseRestService>(SupabaseRestService);

    // Créer un client et produit de test
    const customer = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testCustomer)
      .expect(201);
    
    testCustomerId = customer.body.user.id;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testCustomer.email, password: testCustomer.password })
      .expect(200);
    
    authToken = login.body.token;

    // Créer un produit de test
    const product = await supabaseService.createProduct(testProduct);
    testProductId = product.id;
  });

  afterAll(async () => {
    // Nettoyage complet
    if (testOrderId) {
      await prismaService.order.deleteMany({
        where: { customerId: testCustomerId }
      });
    }
    if (testCustomerId) {
      await prismaService.user.delete({
        where: { id: testCustomerId }
      });
    }
    await app.close();
  });

  describe('🛍️ WORKFLOW 1: Création de commande (commande.preparation.php)', () => {
    const orderData = {
      customerId: testCustomerId,
      items: [
        {
          productId: testProductId,
          quantity: 2,
          unitPrice: testProduct.price
        }
      ],
      billingAddress: {
        address: '123 Rue de Facturation',
        city: 'Paris',
        zipCode: '75001',
        country: 'FR'
      },
      deliveryAddress: {
        address: '456 Rue de Livraison',
        city: 'Lyon',
        zipCode: '69001',
        country: 'FR'
      },
      paymentMethod: 'carte_bancaire',
      deliveryMethod: 'standard'
    };

    it('1.1 - Doit valider l\'authentification client', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.message).toContain('Token requis');
    });

    it('1.2 - Doit valider la disponibilité des produits', async () => {
      const invalidOrderData = {
        ...orderData,
        items: [
          {
            productId: 'INVALID-PRODUCT-ID',
            quantity: 1,
            unitPrice: 10.00
          }
        ]
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.message).toContain('Produit inexistant');
    });

    it('1.3 - Doit valider les quantités en stock', async () => {
      const overStockOrderData = {
        ...orderData,
        items: [
          {
            productId: testProductId,
            quantity: 1000, // Supérieur au stock
            unitPrice: testProduct.price
          }
        ]
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(overStockOrderData)
        .expect(400);

      expect(response.body.message).toContain('Stock insuffisant');
    });

    it('1.4 - Doit calculer les prix et taxes automatiquement', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(200);

      const calculation = response.body;
      
      expect(calculation).toMatchObject({
        subtotalHT: expect.any(Number),
        taxAmount: expect.any(Number),
        totalTTC: expect.any(Number),
        shippingCost: expect.any(Number),
        items: expect.arrayContaining([
          expect.objectContaining({
            productId: testProductId,
            quantity: 2,
            unitPriceHT: expect.any(Number),
            totalHT: expect.any(Number),
            vatRate: testProduct.vat_rate
          })
        ])
      });

      // Vérifier les calculs
      const expectedSubtotal = testProduct.price * 2;
      const expectedTax = expectedSubtotal * (testProduct.vat_rate / 100);
      
      expect(calculation.subtotalHT).toBeCloseTo(expectedSubtotal, 2);
      expect(calculation.taxAmount).toBeCloseTo(expectedTax, 2);
    });

    it('1.5 - Doit créer la commande dans ___XTR_ORDER', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const order = response.body.order;
      testOrderId = order.id;

      expect(order).toMatchObject({
        id: expect.any(String),
        customerId: testCustomerId,
        status: 'PENDING',
        totalTTC: expect.any(Number),
        createdAt: expect.any(String)
      });

      // Vérifier l'insertion dans la table legacy
      const legacyOrder = await supabaseService.getOrderById(testOrderId);
      expect(legacyOrder).toMatchObject({
        ord_id: testOrderId,
        ord_cst_id: testCustomerId,
        ord_ords_id: 'PENDING',
        ord_total_ttc: order.totalTTC
      });
    });

    it('1.6 - Doit créer les lignes de commande dans ___XTR_ORDER_LINE', async () => {
      const orderLines = await supabaseService.getOrderLinesByOrderId(testOrderId);
      
      expect(orderLines).toHaveLength(1);
      expect(orderLines[0]).toMatchObject({
        orl_ord_id: testOrderId,
        orl_pro_id: testProductId,
        orl_quantity: 2,
        orl_unit_price: testProduct.price,
        orl_total_ht: expect.any(Number),
        orl_vat_rate: testProduct.vat_rate
      });
    });

    it('1.7 - Doit générer un numéro de commande unique', async () => {
      // Créer une seconde commande
      const response2 = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      const order1 = await supabaseService.getOrderById(testOrderId);
      const order2 = await supabaseService.getOrderById(response2.body.order.id);

      expect(order1.ord_number).not.toBe(order2.ord_number);
      expect(order1.ord_number).toMatch(/^ORD-\d{8}-\d{4}$/);
      expect(order2.ord_number).toMatch(/^ORD-\d{8}-\d{4}$/);
    });

    it('1.8 - Doit décrémenter le stock des produits', async () => {
      const product = await supabaseService.getProductById(testProductId);
      const expectedStock = testProduct.stock_quantity - 2; // 2 = quantité commandée
      
      expect(product.pro_stock_quantity).toBe(expectedStock);
    });
  });

  describe('📋 WORKFLOW 2: Gestion des statuts (commande.status.php)', () => {
    it('2.1 - Doit lister tous les statuts disponibles', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/statuses')
        .expect(200);

      expect(response.body.statuses).toContainEqual(
        expect.objectContaining({
          id: 'PENDING',
          label: 'En attente',
          description: expect.any(String)
        })
      );

      // Vérifier les statuts legacy depuis ___XTR_ORDER_STATUS
      const legacyStatuses = await supabaseService.getAllOrderStatuses();
      expect(legacyStatuses.length).toBeGreaterThan(5);
    });

    it('2.2 - Doit permettre de changer le statut de commande', async () => {
      const response = await request(app.getHttpServer())
        .put(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(response.body.order.status).toBe('CONFIRMED');

      // Vérifier la mise à jour dans la table legacy
      const legacyOrder = await supabaseService.getOrderById(testOrderId);
      expect(legacyOrder.ord_ords_id).toBe('CONFIRMED');
    });

    it('2.3 - Doit valider les transitions de statut autorisées', async () => {
      // Tentative de passage direct de CONFIRMED à DELIVERED (non autorisé)
      const response = await request(app.getHttpServer())
        .put(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'DELIVERED' })
        .expect(400);

      expect(response.body.message).toContain('Transition non autorisée');
    });

    it('2.4 - Doit enregistrer l\'historique des changements de statut', async () => {
      // Changer vers SHIPPED
      await request(app.getHttpServer())
        .put(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          status: 'SHIPPED',
          comment: 'Expédié via transporteur X'
        })
        .expect(200);

      // Récupérer l'historique
      const response = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}/status-history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.history).toContainEqual(
        expect.objectContaining({
          status: 'SHIPPED',
          comment: 'Expédié via transporteur X',
          timestamp: expect.any(String)
        })
      );
    });

    it('2.5 - Doit notifier le client par email lors des changements', async () => {
      const emailService = app.get('EmailService');
      const sendEmailSpy = jest.spyOn(emailService, 'sendOrderStatusUpdate');

      await request(app.getHttpServer())
        .put(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: testOrderId,
          customerEmail: testCustomer.email,
          newStatus: 'DELIVERED'
        })
      );
    });
  });

  describe('🔍 WORKFLOW 3: Consultation de commande (commande.consulter.php)', () => {
    it('3.1 - Doit afficher le détail complet d\'une commande', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const order = response.body.order;
      expect(order).toMatchObject({
        id: testOrderId,
        orderNumber: expect.stringMatching(/^ORD-\d{8}-\d{4}$/),
        customer: expect.objectContaining({
          id: testCustomerId,
          email: testCustomer.email
        }),
        items: expect.arrayContaining([
          expect.objectContaining({
            product: expect.objectContaining({
              id: testProductId,
              name: testProduct.name
            }),
            quantity: 2,
            unitPrice: testProduct.price
          })
        ]),
        billingAddress: expect.objectContaining({
          address: expect.any(String),
          city: expect.any(String)
        }),
        deliveryAddress: expect.objectContaining({
          address: expect.any(String),
          city: expect.any(String)
        }),
        totals: expect.objectContaining({
          subtotalHT: expect.any(Number),
          taxAmount: expect.any(Number),
          shippingCost: expect.any(Number),
          totalTTC: expect.any(Number)
        }),
        status: 'DELIVERED',
        statusHistory: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('3.2 - Doit joindre les données des tables legacy', async () => {
      const orderWithLegacy = await ordersService.getOrderWithLegacyData(testOrderId);

      expect(orderWithLegacy.legacy).toMatchObject({
        ord_number: expect.stringMatching(/^ORD-\d{8}-\d{4}$/),
        ord_date: expect.any(String),
        ord_payment_method: expect.any(String),
        ord_delivery_method: expect.any(String),
        customer: expect.objectContaining({
          cst_fname: testCustomer.firstName,
          cst_name: testCustomer.lastName
        }),
        lines: expect.arrayContaining([
          expect.objectContaining({
            orl_pro_ref: testProduct.ref,
            orl_quantity: 2
          })
        ])
      });
    });

    it('3.3 - Doit respecter la sécurité (commande appartient au client)', async () => {
      // Créer un autre client
      const otherCustomer = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `other.customer.${Date.now()}@legacy-tests.com`,
          password: 'Other123!',
          firstName: 'Other',
          lastName: 'Customer'
        })
        .expect(201);

      const otherLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: otherCustomer.body.user.email,
          password: 'Other123!'
        })
        .expect(200);

      // Tentative d'accès à la commande d'un autre client
      const response = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${otherLogin.body.token}`)
        .expect(403);

      expect(response.body.message).toContain('Accès interdit');
    });
  });

  describe('📄 WORKFLOW 4: Génération de facture (commande.facture.php)', () => {
    it('4.1 - Doit générer une facture PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(`invoice-${testOrderId}.pdf`);
    });

    it('4.2 - Doit inclure toutes les informations légales françaises', async () => {
      const invoiceData = await ordersService.generateInvoiceData(testOrderId);

      expect(invoiceData).toMatchObject({
        invoiceNumber: expect.stringMatching(/^FAC-\d{8}-\d{4}$/),
        issueDate: expect.any(String),
        dueDate: expect.any(String),
        seller: expect.objectContaining({
          name: expect.any(String),
          address: expect.any(String),
          siret: expect.stringMatching(/^\d{14}$/),
          vatNumber: expect.stringMatching(/^FR\d{11}$/),
          rcs: expect.any(String)
        }),
        buyer: expect.objectContaining({
          name: `${testCustomer.firstName} ${testCustomer.lastName}`,
          email: testCustomer.email,
          address: expect.any(String)
        }),
        items: expect.arrayContaining([
          expect.objectContaining({
            description: testProduct.name,
            quantity: 2,
            unitPriceHT: expect.any(Number),
            vatRate: testProduct.vat_rate,
            totalHT: expect.any(Number),
            vatAmount: expect.any(Number),
            totalTTC: expect.any(Number)
          })
        ]),
        totals: expect.objectContaining({
          subtotalHT: expect.any(Number),
          totalVAT: expect.any(Number),
          totalTTC: expect.any(Number)
        }),
        paymentTerms: expect.any(String),
        legalMentions: expect.any(String)
      });
    });

    it('4.3 - Doit sauvegarder la facture dans ___XTR_INVOICE', async () => {
      const invoice = await supabaseService.getInvoiceByOrderId(testOrderId);

      expect(invoice).toMatchObject({
        inv_ord_id: testOrderId,
        inv_number: expect.stringMatching(/^FAC-\d{8}-\d{4}$/),
        inv_date: expect.any(String),
        inv_total_ht: expect.any(Number),
        inv_total_ttc: expect.any(Number),
        inv_status: 'GENERATED'
      });
    });

    it('4.4 - Doit permettre la régénération de facture si nécessaire', async () => {
      // Première génération
      const firstResponse = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Régénération
      const secondResponse = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}/invoice?regenerate=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Les deux PDFs doivent être identiques (même numéro de facture)
      expect(firstResponse.headers['content-length'])
        .toBe(secondResponse.headers['content-length']);
    });
  });

  describe('📦 WORKFLOW 5: Gestion des expéditions (commande.expedition.php)', () => {
    it('5.1 - Doit calculer les frais de port selon le poids', async () => {
      const shippingCalculation = await request(app.getHttpServer())
        .post('/orders/shipping/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { productId: testProductId, quantity: 2 }
          ],
          deliveryAddress: {
            zipCode: '69001',
            country: 'FR'
          },
          method: 'standard'
        })
        .expect(200);

      const totalWeight = testProduct.weight * 2; // 1.5kg * 2 = 3kg
      
      expect(shippingCalculation.body).toMatchObject({
        method: 'standard',
        cost: expect.any(Number),
        weight: totalWeight,
        estimatedDelivery: expect.any(String)
      });

      // Vérifier le calcul selon la grille tarifaire legacy
      expect(shippingCalculation.body.cost).toBeGreaterThan(0);
    });

    it('5.2 - Doit supporter différents modes de livraison', async () => {
      const methods = ['standard', 'express', 'pickup'];
      
      for (const method of methods) {
        const response = await request(app.getHttpServer())
          .post('/orders/shipping/calculate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            items: [{ productId: testProductId, quantity: 1 }],
            deliveryAddress: { zipCode: '75001', country: 'FR' },
            method: method
          })
          .expect(200);

        expect(response.body.method).toBe(method);
        expect(response.body.cost).toBeGreaterThan(0);
      }
    });

    it('5.3 - Doit générer une étiquette d\'expédition', async () => {
      const response = await request(app.getHttpServer())
        .post(`/orders/${testOrderId}/shipping/label`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          carrier: 'colissimo',
          serviceType: 'standard'
        })
        .expect(200);

      expect(response.body.label).toMatchObject({
        trackingNumber: expect.stringMatching(/^[A-Z0-9]+$/),
        labelUrl: expect.stringContaining('.pdf'),
        carrier: 'colissimo',
        estimatedDelivery: expect.any(String)
      });
    });

    it('5.4 - Doit enregistrer le suivi dans ___XTR_SHIPPING', async () => {
      const shipping = await supabaseService.getShippingByOrderId(testOrderId);

      expect(shipping).toMatchObject({
        shp_ord_id: testOrderId,
        shp_carrier: 'colissimo',
        shp_tracking_number: expect.any(String),
        shp_status: 'SHIPPED',
        shp_date_shipped: expect.any(String)
      });
    });
  });

  describe('🔙 WORKFLOW 6: Gestion des retours (commande.retour.php)', () => {
    it('6.1 - Doit permettre de demander un retour', async () => {
      const returnRequest = {
        orderId: testOrderId,
        items: [
          {
            orderLineId: 'line-id-here',
            quantity: 1,
            reason: 'DEFECTIVE',
            comment: 'Produit défectueux'
          }
        ]
      };

      const response = await request(app.getHttpServer())
        .post('/orders/returns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(returnRequest)
        .expect(201);

      expect(response.body.return).toMatchObject({
        id: expect.any(String),
        orderId: testOrderId,
        status: 'REQUESTED',
        returnNumber: expect.stringMatching(/^RET-\d{8}-\d{4}$/),
        createdAt: expect.any(String)
      });
    });

    it('6.2 - Doit valider les délais de retour (14 jours)', async () => {
      // Créer une commande ancienne (plus de 14 jours)
      const oldOrderDate = new Date();
      oldOrderDate.setDate(oldOrderDate.getDate() - 20);

      await supabaseService.updateOrderDate(testOrderId, oldOrderDate);

      const returnRequest = {
        orderId: testOrderId,
        items: [
          {
            orderLineId: 'line-id-here',
            quantity: 1,
            reason: 'NOT_SATISFIED'
          }
        ]
      };

      const response = await request(app.getHttpServer())
        .post('/orders/returns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(returnRequest)
        .expect(400);

      expect(response.body.message).toContain('Délai de retour dépassé');

      // Remettre la date normale
      await supabaseService.updateOrderDate(testOrderId, new Date());
    });

    it('6.3 - Doit enregistrer dans ___XTR_RETURN', async () => {
      const returns = await supabaseService.getReturnsByOrderId(testOrderId);
      
      expect(returns[0]).toMatchObject({
        ret_ord_id: testOrderId,
        ret_number: expect.stringMatching(/^RET-\d{8}-\d{4}$/),
        ret_status: 'REQUESTED',
        ret_date_requested: expect.any(String),
        ret_reason: 'DEFECTIVE'
      });
    });
  });

  describe('💰 WORKFLOW 7: Gestion des paiements (commande.paiement.php)', () => {
    it('7.1 - Doit supporter différents moyens de paiement', async () => {
      const paymentMethods = ['carte_bancaire', 'paypal', 'virement', 'cheque'];
      
      for (const method of paymentMethods) {
        const response = await request(app.getHttpServer())
          .post('/orders/payment/methods')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ method })
          .expect(200);

        expect(response.body.method).toMatchObject({
          id: method,
          available: expect.any(Boolean),
          fees: expect.any(Number),
          description: expect.any(String)
        });
      }
    });

    it('7.2 - Doit traiter un paiement par carte bancaire', async () => {
      const paymentData = {
        orderId: testOrderId,
        method: 'carte_bancaire',
        amount: 119.98, // Montant de la commande
        cardDetails: {
          number: '4111111111111111',
          expiry: '12/25',
          cvv: '123',
          holder: 'TEST CUSTOMER'
        }
      };

      const response = await request(app.getHttpServer())
        .post('/orders/payment/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.payment).toMatchObject({
        id: expect.any(String),
        orderId: testOrderId,
        status: 'SUCCESS',
        transactionId: expect.any(String),
        amount: paymentData.amount,
        method: 'carte_bancaire'
      });
    });

    it('7.3 - Doit enregistrer dans ___XTR_PAYMENT', async () => {
      const payment = await supabaseService.getPaymentByOrderId(testOrderId);

      expect(payment).toMatchObject({
        pay_ord_id: testOrderId,
        pay_method: 'carte_bancaire',
        pay_amount: 119.98,
        pay_status: 'SUCCESS',
        pay_transaction_id: expect.any(String),
        pay_date: expect.any(String)
      });
    });

    it('7.4 - Doit mettre à jour le statut de commande après paiement', async () => {
      const order = await supabaseService.getOrderById(testOrderId);
      expect(order.ord_ords_id).toBe('PAID');
    });

    it('7.5 - Doit gérer les échecs de paiement', async () => {
      // Simulation d'un échec avec une carte expirée
      const failedPaymentData = {
        orderId: testOrderId,
        method: 'carte_bancaire',
        amount: 119.98,
        cardDetails: {
          number: '4000000000000002', // Carte test "declined"
          expiry: '01/20', // Expirée
          cvv: '123',
          holder: 'TEST CUSTOMER'
        }
      };

      const response = await request(app.getHttpServer())
        .post('/orders/payment/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(failedPaymentData)
        .expect(400);

      expect(response.body.payment).toMatchObject({
        status: 'FAILED',
        errorCode: expect.any(String),
        errorMessage: expect.any(String)
      });
    });
  });

  describe('📊 WORKFLOW 8: Historique et rapports (archive.order.show.php)', () => {
    it('8.1 - Doit lister l\'historique des commandes du client', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.orders).toBeInstanceOf(Array);
      expect(response.body.orders[0]).toMatchObject({
        id: testOrderId,
        orderNumber: expect.stringMatching(/^ORD-\d{8}-\d{4}$/),
        status: 'PAID',
        totalTTC: expect.any(Number),
        createdAt: expect.any(String)
      });
    });

    it('8.2 - Doit filtrer par période', async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const toDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/customers/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        })
        .expect(200);

      expect(response.body.orders.length).toBeGreaterThan(0);
      
      // Vérifier que toutes les commandes sont dans la période
      response.body.orders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        expect(orderDate).toBeInstanceOf(Date);
        expect(orderDate.getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
        expect(orderDate.getTime()).toBeLessThanOrEqual(toDate.getTime());
      });
    });

    it('8.3 - Doit filtrer par statut', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'PAID' })
        .expect(200);

      expect(response.body.orders.length).toBeGreaterThan(0);
      response.body.orders.forEach(order => {
        expect(order.status).toBe('PAID');
      });
    });

    it('8.4 - Doit générer un rapport de synthèse', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/orders/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary).toMatchObject({
        totalOrders: expect.any(Number),
        totalSpent: expect.any(Number),
        averageOrderValue: expect.any(Number),
        lastOrderDate: expect.any(String),
        favoriteCategory: expect.any(String),
        statusBreakdown: expect.objectContaining({
          PAID: expect.any(Number),
          DELIVERED: expect.any(Number)
        })
      });
    });
  });

  describe('🚗 WORKFLOW 9: Intégration Automotive (spécificités)', () => {
    const automotiveOrderData = {
      customerId: testCustomerId,
      items: [
        {
          productId: testProductId,
          quantity: 1,
          vehicleInfo: {
            make: 'Peugeot',
            model: '308',
            year: 2020,
            engine: '1.6 HDI',
            vin: 'VF3XXXXXXXXXXXX'
          }
        }
      ],
      deliveryAddress: {
        address: '123 Garage Auto',
        city: 'Paris',
        zipCode: '75001',
        country: 'FR'
      }
    };

    it('9.1 - Doit valider la compatibilité véhicule/produit', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders/automotive/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(automotiveOrderData)
        .expect(200);

      expect(response.body.validation).toMatchObject({
        isCompatible: expect.any(Boolean),
        vehicleInfo: expect.objectContaining({
          make: 'Peugeot',
          model: '308',
          year: 2020
        }),
        compatibilityDetails: expect.any(Array)
      });
    });

    it('9.2 - Doit calculer les taxes spécifiques automotive', async () => {
      const taxCalculation = await taxService.calculateAutomotiveTaxes({
        items: automotiveOrderData.items,
        vehicleInfo: automotiveOrderData.items[0].vehicleInfo,
        deliveryCountry: 'FR'
      });

      expect(taxCalculation).toMatchObject({
        baseTax: expect.any(Number),
        ecoTax: expect.any(Number),
        recyclingTax: expect.any(Number),
        totalTax: expect.any(Number),
        breakdown: expect.any(Array)
      });
    });

    it('9.3 - Doit enregistrer les infos véhicule dans ___XTR_ORDER_VEHICLE', async () => {
      const automotiveOrder = await request(app.getHttpServer())
        .post('/orders/automotive')
        .set('Authorization', `Bearer ${authToken}`)
        .send(automotiveOrderData)
        .expect(201);

      const vehicleInfo = await supabaseService.getOrderVehicleInfo(automotiveOrder.body.order.id);

      expect(vehicleInfo).toMatchObject({
        orv_ord_id: automotiveOrder.body.order.id,
        orv_make: 'Peugeot',
        orv_model: '308',
        orv_year: 2020,
        orv_engine: '1.6 HDI',
        orv_vin: 'VF3XXXXXXXXXXXX'
      });
    });
  });

  describe('⚡ TESTS DE PERFORMANCE ORDERS', () => {
    it('PERF.1 - Doit traiter 50 commandes simultanées', async () => {
      const orderPromises = Array.from({ length: 50 }, (_, i) => {
        return request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...orderData,
            items: [
              {
                productId: testProductId,
                quantity: 1,
                unitPrice: testProduct.price
              }
            ]
          });
      });

      const results = await Promise.allSettled(orderPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(45); // 90% de succès minimum
    });

    it('PERF.2 - Doit maintenir des temps de calcul rapides', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/orders/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(200);

      const calculationTime = Date.now() - startTime;
      expect(calculationTime).toBeLessThan(200); // < 200ms
    });

    it('PERF.3 - Doit optimiser les requêtes de listing', async () => {
      // Ajouter plusieurs commandes
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send(orderData);
      }

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/customers/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, page: 1 })
        .expect(200);

      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(300); // < 300ms
      expect(response.body.orders).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });
    });
  });

  describe('🔒 TESTS DE SÉCURITÉ ORDERS', () => {
    it('SEC.1 - Doit empêcher la manipulation des prix', async () => {
      const maliciousOrderData = {
        ...orderData,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 0.01 // Prix manipulé
          }
        ]
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousOrderData)
        .expect(400);

      expect(response.body.message).toContain('Prix produit incorrect');
    });

    it('SEC.2 - Doit valider l\'intégrité des calculs', async () => {
      const calculation = await request(app.getHttpServer())
        .post('/orders/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(200);

      // Recalculer côté serveur et comparer
      const serverCalculation = await ordersService.calculateOrderTotals(orderData);
      
      expect(calculation.body.totalTTC).toBeCloseTo(serverCalculation.totalTTC, 2);
      expect(calculation.body.taxAmount).toBeCloseTo(serverCalculation.taxAmount, 2);
    });

    it('SEC.3 - Doit protéger contre les attaques par énumération', async () => {
      // Tentative d'accès à des commandes avec des IDs séquentiels
      const nonExistentIds = ['order-123', 'order-456', 'order-789'];
      
      for (const id of nonExistentIds) {
        const response = await request(app.getHttpServer())
          .get(`/orders/${id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.message).toBe('Commande non trouvée');
        // Vérifier qu'aucune info n'est leakée
        expect(response.body).not.toHaveProperty('details');
      }
    });
  });

  describe('🔄 TESTS DE SYNCHRONISATION LEGACY ORDERS', () => {
    it('SYNC.1 - Doit maintenir la cohérence Prisma ↔ Legacy', async () => {
      // Modifier dans Prisma
      await prismaService.order.update({
        where: { id: testOrderId },
        data: { 
          notes: 'Note ajoutée via Prisma'
        }
      });

      // Vérifier sync vers legacy
      const legacyOrder = await supabaseService.getOrderById(testOrderId);
      expect(legacyOrder.ord_notes).toBe('Note ajoutée via Prisma');
    });

    it('SYNC.2 - Doit gérer les contraintes d\'intégrité référentielle', async () => {
      // Tentative de suppression d'un produit avec commandes liées
      const response = await request(app.getHttpServer())
        .delete(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('Produit utilisé dans des commandes');
    });

    it('SYNC.3 - Doit maintenir l\'historique des modifications', async () => {
      const auditLog = await supabaseService.getOrderAuditLog(testOrderId);
      
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0]).toMatchObject({
        action: expect.oneOf(['CREATE', 'UPDATE', 'STATUS_CHANGE']),
        timestamp: expect.any(String),
        userId: testCustomerId,
        changes: expect.any(Object)
      });
    });
  });
});
