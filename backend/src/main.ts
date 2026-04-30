// Load environment variables FIRST (before any validation)
import 'dotenv/config';

// Validate environment variables BEFORE any other imports
// This ensures the app fails fast if required vars are missing
import { validateRequiredEnvVars } from './config/env-validation';
import { buildCSPDirectives } from './config/csp.config';
validateRequiredEnvVars();

import { getPublicDir, startDevServer } from '@fafa/frontend';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { SITE_ORIGIN } from './config/app.config';

import RedisStore from 'connect-redis';
import session from 'express-session';
import Redis from 'ioredis';
import passport from 'passport';
import { urlencoded, json } from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';

const redisStoreFactory = RedisStore(session);

async function bootstrap() {
  try {
    // INIT_TRACE: diagnostic boot markers — remove once perf-gates exit-124 is resolved.
    // Written via console.warn (stderr, line-buffered) to bypass Pino's stdout buffering
    // which hides service logs during init() on CI.
    console.warn('BOOT_TRACE: bootstrap() entered');
    const app = await NestFactory.create(AppModule, {
      bodyParser: false,
      bufferLogs: true, // Buffer logs jusqu'à ce que Pino soit initialisé
    });
    console.warn('BOOT_TRACE: NestFactory.create() returned');

    // 📝 Utiliser Pino comme logger global
    const logger = app.get(Logger);
    app.useLogger(logger);

    // Les contrôleurs définissent déjà leurs préfixes individuellement
    // (ex: @Controller('api/users'), @Controller('admin/suppliers'))
    // Pas besoin de préfixe global qui casserait les routes existantes

    // Cast pour éviter les conflits de types entre les dépendances
    const expressApp = app as any;
    const isProd = process.env.NODE_ENV === 'production';

    // Démarrage du serveur Remix uniquement en dev
    if (!isProd) {
      await startDevServer(expressApp);
      logger.log('Serveur de développement démarré');
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisClient = new Redis(redisUrl);

    redisClient.on('connect', () => logger.log('Redis connecté'));
    redisClient.on('error', (err) => logger.error('Erreur Redis', err));

    const redisStore = new redisStoreFactory({
      client: redisClient,
      ttl: 86400 * 30,
    });

    // Sécurité de session et cookies selon l'environnement
    if (isProd && !process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET requis en production');
    }

    // SECURITE: Vérifier que SESSION_SECRET est configuré
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret === '123') {
      logger.warn(
        'ALERTE SECURITE: SESSION_SECRET non configuré ou utilise la valeur par défaut!',
      );
      logger.warn('Générez un secret sécurisé avec: openssl rand -base64 32');
      logger.warn('Ajoutez-le dans votre fichier .env');

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
        saveUninitialized: false, // Session créée uniquement quand des données y sont écrites (login, panier)
        secret: sessionSecret || 'INSECURE_DEV_SECRET_CHANGE_ME',
        name: 'connect.sid', // ✅ Nom explicite du cookie
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
          sameSite: 'lax', // ✅ Compatible navigation cross-site
          secure: isProd, // HTTPS via Caddy en production
          httpOnly: true, // ✅ Protection XSS
          path: '/', // ✅ Cookie valide pour tout le site
        },
      }),
    );
    logger.log('Middleware de session initialisé');

    expressApp.useStaticAssets(getPublicDir(), {
      immutable: true,
      maxAge: '1y',
      index: false,
    });
    logger.log('Assets statiques configurés');

    // GlobalErrorFilter is registered via APP_FILTER in ErrorsModule (DI-based)
    // It catches ALL exceptions: DomainException, HttpException, and raw Errors

    // ⚠️ CRITIQUE: body-parser DOIT être avant passport pour éviter "stream is not readable"
    // Body-parser uniquement pour les routes NestJS (API, auth).
    // Les routes Remix ont besoin du raw stream pour request.formData().
    const needsBodyParsing = (url: string) =>
      url.startsWith('/api/') ||
      url.startsWith('/auth/') ||
      url.startsWith('/authenticate') ||
      url.startsWith('/register-and-login');

    const jsonParser = json({ limit: '10mb' });
    const urlencodedParser = urlencoded({ extended: true, limit: '10mb' });

    app.use((req: any, res: any, next: any) => {
      if (needsBodyParsing(req.url)) return jsonParser(req, res, next);
      next();
    });
    app.use((req: any, res: any, next: any) => {
      if (needsBodyParsing(req.url)) return urlencodedParser(req, res, next);
      next();
    });

    app.use(passport.initialize());
    app.use(passport.session());

    logger.log('Passport initialisé');

    // Sécurité HTTP avec CSP personnalisée pour Supabase
    expressApp.set('trust proxy', 1);

    // Nonce CSP par requête — doit être AVANT Helmet
    app.use((_req: any, res: any, next: any) => {
      res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
      next();
    });

    try {
      // Import dynamique pour éviter d alourdir le build si non nécessaire
      const helmet = (await import('helmet')).default;
      const compression = (await import('compression')).default;

      // Compression AVANT Helmet — pour que toutes les réponses soient compressées
      // Note: Brotli géré côté Caddy en production (meilleur ratio, 15-20% vs gzip)
      app.use(
        compression({
          level: 6, // Bon équilibre vitesse/taille (défaut=6, max=9)
          threshold: 1024, // Ne pas compresser les réponses < 1KB
        }),
      );

      // Helmet avec nonce dynamique par requête (voir config/csp.config.ts)
      const isDev = process.env.NODE_ENV !== 'production';
      app.use((req: any, res: any, next: any) => {
        helmet({
          contentSecurityPolicy: {
            directives: buildCSPDirectives(isDev, res.locals.cspNonce),
          },
        })(req, res, next);
      });
    } catch (e) {
      logger.warn({ err: e }, 'Helmet/compression non chargés');
    }

    // CORS sécurisé - restreint en production
    const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());
    const defaultProdOrigins = [SITE_ORIGIN];
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

      logger.log(
        `Swagger UI disponible sur http://localhost:${selectedPort}/api/docs`,
      );
    }
    logger.log(`Démarrage du serveur sur le port ${selectedPort}...`);
    console.warn('BOOT_TRACE: about to call app.listen()');

    await app.listen(selectedPort);
    console.warn('BOOT_TRACE: app.listen() returned');
    logger.log(`Serveur opérationnel sur http://localhost:${selectedPort}`);

    // ✅ HTTP Server Hardening - Évite socket hang up et connexions zombies
    const httpServer = app.getHttpServer();
    httpServer.keepAliveTimeout = 65000; // 65s (doit être > timeout proxies comme Caddy)
    httpServer.headersTimeout = 66000; // 66s (doit être > keepAliveTimeout)
    httpServer.requestTimeout = 300000; // 5 min pour les gros uploads
    logger.log(
      'HTTP timeouts configurés: keepAlive=65s, headers=66s, request=5min',
    );
  } catch (error) {
    // Fallback to console.error if logger not available yet
    // eslint-disable-next-line no-console
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

bootstrap();
