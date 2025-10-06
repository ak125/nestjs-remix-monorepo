# 🔒 Checklist de Sécurité et Bonnes Pratiques

## Variables d'environnement

### ✅ À faire
- [ ] Toutes les variables sensibles dans `.env`
- [ ] Fichier `.env.example` à jour (sans valeurs sensibles)
- [ ] `.env` dans `.gitignore`
- [ ] Validation des variables au démarrage

### ❌ À éviter
- [ ] Pas de secrets hardcodés dans le code
- [ ] Pas de `.env` dans Git
- [ ] Pas de console.log des secrets

### Variables obligatoires

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# Authentication
JWT_SECRET=... # Minimum 32 caractères
JWT_EXPIRES_IN=1d
SESSION_SECRET=... # Minimum 32 caractères

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=... # En production

# Meilisearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=...

# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001
```

---

## Gestion des mots de passe

### ✅ Utiliser bcrypt
```typescript
import * as bcrypt from 'bcrypt';

// Hash
const hash = await bcrypt.hash(password, 10);

// Vérification
const isValid = await bcrypt.compare(password, hash);
```

### ❌ Ne jamais
- Stocker les mots de passe en clair
- Utiliser MD5 ou SHA1
- Logger les mots de passe
- Envoyer les mots de passe par email

### Configuration recommandée
```typescript
const SALT_ROUNDS = 10; // Bon équilibre sécurité/performance
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
```

---

## Authentification JWT

### ✅ Bonnes pratiques
```typescript
// Configuration
{
  secret: process.env.JWT_SECRET,
  expiresIn: '1d', // Pas trop long
  algorithm: 'HS256'
}

// Payload minimal
{
  sub: userId,
  email: user.email,
  iat: timestamp
}
```

### ❌ À éviter
- Secret trop court (< 32 caractères)
- Expiration trop longue (> 7 jours)
- Informations sensibles dans le payload
- Pas de validation du token

### Rotation des secrets
```bash
# Générer un nouveau secret JWT
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Validation des données

### ✅ Utiliser Zod
```typescript
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// Validation
const result = loginSchema.safeParse(data);
```

### ❌ Jamais faire confiance aux données entrantes
- Valider TOUTES les entrées utilisateur
- Sanitiser les données
- Utiliser des types stricts
- Validation côté serveur obligatoire

---

## Sécurité des API

### Headers de sécurité (Helmet)
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
}));
```

### CORS
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Rate Limiting
```typescript
import { ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot({
  ttl: 60,
  limit: 10, // 10 requêtes par minute
})
```

---

## Sécurité Base de Données

### ✅ Utiliser Prisma/ORM
```typescript
// Requêtes paramétrées (protection SQL injection)
const user = await prisma.user.findUnique({
  where: { id: userId }
});
```

### ❌ Éviter
- Requêtes SQL brutes avec interpolation
- Désérialisation non sécurisée
- Exposition d'erreurs SQL détaillées

### Row Level Security (RLS)
```sql
-- Activer RLS sur Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data"
ON users FOR SELECT
USING (auth.uid() = id);
```

---

## Gestion des sessions

### Configuration Redis
```typescript
import * as session from 'express-session';
import * as connectRedis from 'connect-redis';
import { createClient } from 'redis';

const RedisStore = connectRedis(session);
const redisClient = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24h
    sameSite: 'strict'
  }
}));
```

---

## Upload de fichiers

### Validation
```typescript
import { diskStorage } from 'multer';
import * as path from 'path';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36)}`;
    const ext = path.extname(file.originalname);
    
    if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) {
      return cb(new Error('Type de fichier non autorisé'), null);
    }
    
    cb(null, `${uniqueName}${ext}`);
  }
});

@UseInterceptors(FileInterceptor('file', {
  storage,
  limits: { fileSize: MAX_FILE_SIZE }
}))
```

### Sanitization d'images avec Sharp
```typescript
import * as sharp from 'sharp';

const processImage = async (filePath: string) => {
  await sharp(filePath)
    .resize(1200, 1200, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
};
```

---

## Logs et Monitoring

### ✅ À logger
- Tentatives de connexion échouées
- Erreurs serveur
- Opérations sensibles (changement de mot de passe, etc.)
- Métriques de performance

### ❌ Ne jamais logger
- Mots de passe (même hashés)
- Tokens JWT
- Clés API
- Données personnelles sensibles

### Configuration Winston
```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

---

## Tests de sécurité

### Audit NPM
```bash
# Audit des vulnérabilités
npm audit

# Fix automatique
npm audit fix

# Force fix (breaking changes possibles)
npm audit fix --force
```

### Tests de pénétration
```bash
# OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000

# SAST avec ESLint Security
npm install --save-dev eslint-plugin-security
```

### Scan des secrets
```bash
# Trufflehog
docker run --rm -v "$PWD:/pwd" trufflesecurity/trufflehog:latest filesystem /pwd

# Git-secrets
git secrets --scan
```

---

## Déploiement Production

### Checklist avant déploiement

- [ ] `NODE_ENV=production`
- [ ] Toutes les variables d'environnement configurées
- [ ] HTTPS activé (certificat SSL valide)
- [ ] Headers de sécurité configurés (Helmet)
- [ ] Rate limiting activé
- [ ] CORS configuré correctement
- [ ] Logs configurés (pas de console.log)
- [ ] Monitoring en place
- [ ] Backups automatiques de la DB
- [ ] Audit de sécurité passé
- [ ] Tests E2E passés
- [ ] Documentation à jour

### Variables d'environnement production
```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:***@prod-host:5432/prod-db?sslmode=require
JWT_SECRET=*** # Différent de dev !
SESSION_SECRET=*** # Différent de dev !
REDIS_PASSWORD=*** # Obligatoire en prod
FRONTEND_URL=https://monsite.com
ALLOWED_ORIGINS=https://monsite.com,https://www.monsite.com
```

---

## Conformité RGPD

### Données personnelles
- [ ] Consentement utilisateur
- [ ] Droit à l'oubli implémenté
- [ ] Export des données utilisateur
- [ ] Politique de confidentialité
- [ ] Logs d'accès aux données

### Implémentation
```typescript
// Anonymisation
async anonymizeUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@anonymized.com`,
      firstName: 'Deleted',
      lastName: 'User',
      deletedAt: new Date()
    }
  });
}

// Export des données
async exportUserData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: true,
      addresses: true
    }
  });
}
```

---

## Checklist finale

### Développement
- [ ] Pas de secrets hardcodés
- [ ] Validation de toutes les entrées
- [ ] Gestion d'erreurs appropriée
- [ ] Tests unitaires et E2E
- [ ] Code review

### Sécurité
- [ ] Authentification JWT sécurisée
- [ ] Mots de passe hashés avec bcrypt
- [ ] HTTPS en production
- [ ] Headers de sécurité
- [ ] Rate limiting
- [ ] CORS configuré

### Infrastructure
- [ ] Variables d'environnement sécurisées
- [ ] Redis pour les sessions
- [ ] Backups automatiques
- [ ] Monitoring et alertes
- [ ] Logs centralisés

### Conformité
- [ ] RGPD respecté
- [ ] Politique de confidentialité
- [ ] CGU/CGV à jour
- [ ] Audit de sécurité

---

**Dernière révision**: 2025-10-06  
**Prochaine révision**: 2025-11-06
