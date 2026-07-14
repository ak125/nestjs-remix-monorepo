// Dev-only safety net : register tsconfig-paths before any other require().
// PROD utilise tsc-alias pour réécrire les @alias en relatifs au build (single-shot,
// race-free). En dev, `tsc --watch` et `tsc-alias --watch` tournent en parallèle ;
// nodemon peut redémarrer node sur un dist/*.js fraîchement réécrit par tsc mais
// pas encore traité par tsc-alias → MODULE_NOT_FOUND `@common/exceptions`.
// La registration runtime ci-dessous patche le loader Node pour résoudre les
// `@alias/*` résiduels, éliminant la race. Inactive en prod (tsc-alias a déjà fait
// le travail au build, et tsconfig-paths reste en devDependencies).
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('tsconfig-paths').register({
    baseUrl: __dirname,
    paths: {
      '@auth/*': ['auth/*'],
      '@cache/*': ['cache/*'],
      '@common/*': ['common/*'],
      '@config/*': ['config/*'],
      '@database/*': ['database/*'],
      '@security/*': ['security/*'],
      '@modules/*': ['modules/*'],
    },
  });
}

// Sentry MUST be imported first so its OpenTelemetry-based auto-instrumentation
// can patch http/fs/express before any other module loads.
// `instrument.ts` also runs `dotenv/config` internally — populating env vars
// for the validation step below.
import './instrument';

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
import { SitemapStaticMiddleware } from './modules/seo/middleware/sitemap-static.middleware';

import passport from 'passport';
import { urlencoded, json } from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import { SessionStoreService } from './modules/session/session-store.service';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      bodyParser: false,
      bufferLogs: true, // Buffer logs jusqu'à ce que Pino soit initialisé
    });

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

    // 🔐 Session middleware — Redis store encapsulated in SessionStoreService
    // (connect-redis@5 + ioredis; impl unchanged in PR-9e.1). Mounted HERE, at
    // the exact same position as the previous inline wiring, so the middleware
    // chain order is preserved byte-for-byte.
    // ⚠️ ORDER INVARIANT: passport.initialize()/passport.session() (below) MUST
    // stay AFTER this — passport.session() reads `req.session` populated here.
    const sessionStore = app.get(SessionStoreService);
    app.use(sessionStore.createSessionMiddleware());
    logger.log('Middleware de session initialisé');

    // ⚠️ NO landing-attribution middleware here (retiré, cutover cache HTML).
    // Écrire la session sur un GET HTML matérialisait le store → Set-Cookie
    // connect.sid → Cloudflare BYPASS (HTML jamais caché). La capture first-touch
    // vit désormais sur POST /api/attribution/landing (beacon post-chargement),
    // qui matérialise la session hors du chemin cacheable. Un GET HTML anonyme
    // reste strictement sans effet de bord. Cf. LandingAttributionController +
    // audit/cache-cutover-design-A-B-C-2026-07-14.md (PR A).

    // Compression middleware MUST be registered BEFORE useStaticAssets : Express
    // applies middlewares in registration order, and the static-asset handler
    // streams files directly without consulting downstream middleware. With
    // compression registered after, every JS / CSS / font under /assets/* was
    // served uncompressed (transferSize ≈ resourceSize on Lighthouse audits,
    // see issue diagnosed in PRs #421 / #424 / #426 — none of those PRs moved
    // script.size on the main Lighthouse run because compression was never
    // applied to the static bundle).
    app.use(
      compression({
        level: 6, // Bon équilibre vitesse/taille (défaut=6, max=9)
        threshold: 1024, // Ne pas compresser les réponses < 1KB
      }),
    );
    logger.log('Compression middleware enabled (level=6, threshold=1024)');

    expressApp.useStaticAssets(getPublicDir(), {
      immutable: true,
      maxAge: '1y',
      index: false,
    });
    logger.log('Assets statiques configurés');

    // Sitemaps statiques racine (/sitemap.xml, /sitemap-*.xml) servis depuis
    // /var/www/sitemaps — miroir du bloc Caddy @sitemaps (config/caddy/Caddyfile).
    // Indispensable en DEV (pas de Caddy) où aucune route React Router ne peut
    // matcher un splat préfixé `sitemap-*`. Lecture seule (compatible READ_ONLY).
    // Doit précéder le catch-all RemixController @All('{*path}').
    const sitemapStatic = new SitemapStaticMiddleware();
    app.use((req: any, res: any, nextFn: any) =>
      sitemapStatic.use(req, res, nextFn),
    );
    logger.log('Middleware sitemaps statiques initialisé');

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

    // Express 5 a changé le query parser par défaut ('extended' → 'simple').
    // On rétablit explicitement 'extended' (qs) pour préserver le parsing
    // des objets/tableaux imbriqués (`?a[b]=c`) tel qu'en Express 4 — 0
    // changement de contrat sur `req.query` (PR-9f).
    expressApp.set('query parser', 'extended');

    // Nonce CSP par requête — doit être AVANT Helmet
    app.use((_req: any, res: any, next: any) => {
      res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
      next();
    });

    // Helmet avec nonce dynamique par requête (voir config/csp.config.ts).
    // Compression a été déplacée plus haut (avant useStaticAssets) — elle ne
    // peut plus rester optionnelle vu son impact perf empirique mesuré.
    const isDev = process.env.NODE_ENV !== 'production';
    app.use((req: any, res: any, next: any) => {
      helmet({
        contentSecurityPolicy: {
          directives: buildCSPDirectives(isDev, res.locals.cspNonce),
        },
      })(req, res, next);
    });

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

    await app.listen(selectedPort);
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
