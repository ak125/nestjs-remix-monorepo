// Load environment variables FIRST (before any validation)
import 'dotenv/config';

// Validate environment variables BEFORE any other imports
// This ensures the app fails fast if required vars are missing
import { validateRequiredEnvVars } from './config/env-validation';
validateRequiredEnvVars();

import { getPublicDir, startDevServer } from '@fafa/frontend';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

import RedisStore from 'connect-redis';
import session from 'express-session';
import Redis from 'ioredis';
import passport from 'passport';
import { urlencoded, json } from 'body-parser';
import { HttpExceptionFilter } from './auth/exception.filter';
import cors from 'cors';

const redisStoreFactory = RedisStore(session);

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      bodyParser: false,
      logger: ['error', 'warn', 'log'], // Logs activés pour monitoring RPC V3/V2
    });

    // Les contrôleurs définissent déjà leurs préfixes individuellement
    // (ex: @Controller('api/users'), @Controller('admin/suppliers'))
    // Pas besoin de préfixe global qui casserait les routes existantes

    // Cast pour éviter les conflits de types entre les dépendances
    const expressApp = app as any;
    const isProd = process.env.NODE_ENV === 'production';

    // Démarrage du serveur Remix uniquement en dev
    if (!isProd) {
      await startDevServer(expressApp);
      console.log('Serveur de développement démarré.');
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisClient = new Redis(redisUrl);

    redisClient.on('connect', () => console.log('Redis connecté.'));
    redisClient.on('error', (err) => console.error('Erreur Redis :', err));

    const redisStore = new redisStoreFactory({
      client: redisClient,
      ttl: 86400 * 30,
    });

    // Sécurité de session et cookies selon l'environnement
    if (isProd && !process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET requis en production');
    }

    // ⚠️ SÉCURITÉ: Vérifier que SESSION_SECRET est configuré
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret === '123') {
      console.warn(
        '⚠️⚠️⚠️ ALERTE SÉCURITÉ: SESSION_SECRET non configuré ou utilise la valeur par défaut! ⚠️⚠️⚠️',
      );
      console.warn(
        '   Générez un secret sécurisé avec: openssl rand -base64 32',
      );
      console.warn('   Ajoutez-le dans votre fichier .env');

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'SESSION_SECRET OBLIGATOIRE en production! Impossible de démarrer.',
        );
      }
    }

    app.use(
      session({
        store: redisStore,
        resave: false,
        saveUninitialized: true, // ✅ Créer session même si vide (résout pb panier)
        secret: sessionSecret || 'INSECURE_DEV_SECRET_CHANGE_ME',
        name: 'connect.sid', // ✅ Nom explicite du cookie
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
          sameSite: 'lax', // ✅ Compatible navigation cross-site
          secure: false, // ⚠️ DEV: false (HTTP). TODO: passer à isProd quand Caddy (HTTPS) sera en place
          httpOnly: true, // ✅ Protection XSS
          path: '/', // ✅ Cookie valide pour tout le site
        },
      }),
    );
    console.log('Middleware de session initialisé.');

    expressApp.useStaticAssets(getPublicDir(), {
      immutable: true,
      maxAge: '1y',
      index: false,
    });
    console.log('Assets statiques configurés.');

    app.useGlobalFilters(new HttpExceptionFilter());

    // ⚠️ CRITIQUE: body-parser DOIT être avant passport pour éviter "stream is not readable"
    app.use(json({ limit: '10mb' }));
    app.use(urlencoded({ extended: true, limit: '10mb' }));

    app.use(passport.initialize());
    app.use(passport.session());

    console.log('Passport initialisé.');

    // Sécurité HTTP avec CSP personnalisée pour Supabase
    expressApp.set('trust proxy', 1);
    try {
      // Import dynamique pour éviter d alourdir le build si non nécessaire
      const helmet = (await import('helmet')).default;
      const compression = (await import('compression')).default;

      // Configuration Helmet avec CSP personnalisée pour autoriser Supabase + Google Analytics
      app.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://fonts.googleapis.com', // Google Fonts
              ], // Pour Tailwind CSS
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://www.googletagmanager.com', // Google Tag Manager
                'https://www.google-analytics.com', // Google Analytics
              ],
              imgSrc: [
                "'self'",
                'data:',
                'blob:',
                process.env.SUPABASE_URL ||
                  'https://cxpojprgwgubzjyqzmoq.supabase.co', // Autoriser les images Supabase
                'https://www.google-analytics.com', // Pixel GA
                'https://www.googletagmanager.com', // Pixel GTM
              ],
              connectSrc: [
                "'self'",
                'ws:',
                'wss:',
                // DEV: autoriser Vite HMR ping (http non-websocket)
                ...(process.env.NODE_ENV !== 'production'
                  ? ['http://127.0.0.1:24678', 'http://localhost:24678']
                  : []),
                'https://www.google-analytics.com', // Envoi données GA
                'https://analytics.google.com', // GA4 endpoint
                'https://region1.google-analytics.com', // GA4 régional
              ],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], // Google Fonts
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
              formAction: [
                "'self'",
                'https://paiement.systempay.fr',
                'https://paiement-secure.test.lyra-collect.com',
                'https://tpeweb.paybox.com', // Paybox PRODUCTION
                'https://preprod-tpeweb.paybox.com', // Paybox PREPROD
              ], // Autoriser soumission vers SystemPay et Paybox
            },
          },
        }),
      );

      app.use(compression());
    } catch (e) {
      console.warn('Helmet/compression non chargés:', e);
    }

    // CORS sécurisé - restreint en production
    const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());
    const defaultProdOrigins = [
      'https://www.automecanik.com',
      'https://automecanik.com',
    ];
    app.use(
      cors({
        origin:
          corsOrigin && corsOrigin.length > 0
            ? corsOrigin
            : isProd
              ? defaultProdOrigins
              : true, // Dev: toutes origines permises
        credentials: true,
      }),
    );
    expressApp.disable('x-powered-by');

    const selectedPort = process.env.PORT || 3000;

    // ✅ Graceful shutdown pour éviter les fuites mémoire et connexions orphelines
    app.enableShutdownHooks();

    // 🔷 Configuration OpenAPI / Swagger
    if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
      const config = new DocumentBuilder()
        .setTitle('FAFA Auto API')
        .setDescription(
          'API complète du monorepo FAFA Auto - E-commerce, Admin, Blog, Paiements',
        )
        .setVersion('1.0.0')
        .addTag('auth', 'Authentication & Sessions')
        .addTag('admin', 'Administration & Back-office')
        .addTag('products', 'Catalogue produits')
        .addTag('cart', 'Panier & Checkout')
        .addTag('orders', 'Commandes & Factures')
        .addTag('payments', 'Paiements Paybox')
        .addTag('blog', 'Blog & CMS')
        .addTag('analytics', 'Analytics & Tracking')
        .addTag('ai-content', 'AI Content Generation')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Token JWT pour authentification admin',
          },
          'JWT-auth',
        )
        .addCookieAuth('connect.sid', {
          type: 'apiKey',
          in: 'cookie',
          description: 'Session cookie pour authentification utilisateur',
        })
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        customSiteTitle: 'FAFA Auto API Documentation',
        customfavIcon: '/favicon.ico',
        customCss: '.swagger-ui .topbar { display: none }',
      });

      console.log(
        `📚 Swagger UI disponible sur http://localhost:${selectedPort}/api/docs`,
      );
    }
    console.log(`Démarrage du serveur sur le port ${selectedPort}...`);

    await app.listen(selectedPort);
    console.log(`Serveur opérationnel sur http://localhost:${selectedPort}`);
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur :', error);
  }
}

bootstrap();
