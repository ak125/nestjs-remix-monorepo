import { getPublicDir, startDevServer } from '@fafa/frontend';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

import RedisStore from 'connect-redis';
import session from 'express-session';
import Redis from 'ioredis';
import passport from 'passport';
import { urlencoded, json } from 'body-parser';
import { HttpExceptionFilter } from './auth/exception.filter';

const redisStoreFactory = RedisStore(session);

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false,
    });

    await startDevServer(app);
    console.log('Serveur de développement démarré.');

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisClient = new Redis(redisUrl);

    redisClient.on('connect', () => console.log('Redis connecté.'));
    redisClient.on('error', (err) => console.error('Erreur Redis :', err));

    const redisStore = new redisStoreFactory({
      client: redisClient,
      ttl: 86400 * 30,
    });

    app.use(
      session({
        store: redisStore,
        resave: false,
        saveUninitialized: false,
        secret: process.env.SESSION_SECRET || '123',
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 30,
          sameSite: 'lax',
          secure: false,
        },
      }),
    );
    console.log('Middleware de session initialisé.');

    app.useStaticAssets(getPublicDir(), {
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

    app.set('trust proxy', 1);

    const selectedPort = process.env.PORT || 3000;
    console.log(`Démarrage du serveur sur le port ${selectedPort}...`);

    await app.listen(selectedPort);
    console.log(`Serveur opérationnel sur http://localhost:${selectedPort}`);
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur :', error);
  }
}

bootstrap();
