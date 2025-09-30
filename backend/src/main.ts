import { getPublicDir, startDevServer } from '@fafa/frontend';
import { NestFactory } from '@nestjs/core';
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
      logger:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['error', 'warn', 'log'], // Réduire les logs DEBUG
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

    app.use(
      session({
        store: redisStore,
        resave: false,
        saveUninitialized: true,  // 🔥 Créer session même si vide
        secret: process.env.SESSION_SECRET || '123',
        name: 'connect.sid',  // 🔥 Nom explicite du cookie
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 30,
          sameSite: 'lax',  // 🔥 Toujours lax (même en prod pour compatibilité)
          secure: false,  // 🔥 false en dev pour http://
          httpOnly: true,  // 🔥 Protection XSS
          path: '/',  // 🔥 Cookie valide pour tout le site
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

    app.use(passport.initialize());
    app.use(passport.session());

    // Middleware body-parser global
    app.use(urlencoded({ extended: true }));
    app.use(json());

    console.log('Passport initialisé.');

    // Sécurité HTTP avec CSP personnalisée pour Supabase
    expressApp.set('trust proxy', 1);
    try {
      // Import dynamique pour éviter d alourdir le build si non nécessaire
      const helmet = (await import('helmet')).default;
      const compression = (await import('compression')).default;

      // Configuration Helmet avec CSP personnalisée pour autoriser Supabase
      app.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Pour Tailwind CSS
              scriptSrc: ["'self'", "'unsafe-inline'"], // Pour les scripts Remix
              imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://cxpojprgwgubzjyqzmoq.supabase.co', // Autoriser les images Supabase
              ],
              connectSrc: ["'self'", 'ws:', 'wss:'], // Pour les WebSockets de dev
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          },
        }),
      );

      app.use(compression());
    } catch (e) {
      console.warn('Helmet/compression non chargés:', e);
    }

    // CORS basique (à restreindre si cross-origin)
    const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());
    app.use(
      cors({
        origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : true,
        credentials: true,
      }),
    );
    expressApp.disable('x-powered-by');

    const selectedPort = process.env.PORT || 3000;
    console.log(`Démarrage du serveur sur le port ${selectedPort}...`);

    await app.listen(selectedPort);
    console.log(`Serveur opérationnel sur http://localhost:${selectedPort}`);
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur :', error);
  }
}

bootstrap();
