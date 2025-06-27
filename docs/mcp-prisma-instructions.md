# 🎯 INSTRUCTIONS COPILOT MCP - PRISMA

## 📋 CONTEXTE MCP PRISMA
Ce guide contient les instructions spécialisées pour GitHub Copilot lors du développement avec Prisma dans l'architecture MCP Context-7.

## 🏗️ CONFIGURATION PRISMA MCP

### Schema Prisma type
```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" //
  url      = env("DATABASE_URL")
}

// MCP Context-7 - Model Example
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  posts     Post[]
  profile   Profile?

  @@map("users")
}

model Profile {
  id     String  @id @default(cuid())
  bio    String?
  avatar String?
  userId String  @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Tags relation
  tags      Tag[]

  @@map("posts")
}

model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]

  @@map("tags")
}
```

## 🔧 SERVICE PRISMA MCP

### PrismaService pour NestJS
```typescript
/**
 * MCP GENERATED SERVICE
 * Généré automatiquement par MCP Context-7
 * Module: prisma
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // MCP Context-7 - Utility methods
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'test') {
      const tablenames = await this.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      } catch (error) {
        console.log({ error });
      }
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
```

### Module Prisma
```typescript
/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: prisma
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## 🎯 PATTERNS MCP AVEC PRISMA

### 1. Repository Pattern
```typescript
/**
 * MCP GENERATED REPOSITORY
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class {ModuleName}Repository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.{ModelName}CreateInput) {
    return this.prisma.{modelName}.create({
      data,
      include: {
        // Include related data
      },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.{ModelName}WhereUniqueInput;
    where?: Prisma.{ModelName}WhereInput;
    orderBy?: Prisma.{ModelName}OrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.{modelName}.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        // Include related data
      },
    });
  }

  async findUnique(where: Prisma.{ModelName}WhereUniqueInput) {
    return this.prisma.{modelName}.findUnique({
      where,
      include: {
        // Include related data
      },
    });
  }

  async update(params: {
    where: Prisma.{ModelName}WhereUniqueInput;
    data: Prisma.{ModelName}UpdateInput;
  }) {
    const { where, data } = params;
    return this.prisma.{modelName}.update({
      data,
      where,
      include: {
        // Include related data
      },
    });
  }

  async delete(where: Prisma.{ModelName}WhereUniqueInput) {
    return this.prisma.{modelName}.delete({
      where,
    });
  }

  // Advanced queries
  async findWithPagination(params: {
    page: number;
    limit: number;
    where?: Prisma.{ModelName}WhereInput;
    orderBy?: Prisma.{ModelName}OrderByWithRelationInput;
  }) {
    const { page, limit, where, orderBy } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.{modelName}.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          // Include related data
        },
      }),
      this.prisma.{modelName}.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

### 2. Service avec Repository
```typescript
/**
 * MCP GENERATED SERVICE
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { {ModuleName}Repository } from './{module-name}.repository';
import { {ModuleName}Dto } from './dto/{module-name}.dto';

@Injectable()
export class {ModuleName}Service {
  constructor(private readonly repository: {ModuleName}Repository) {}

  async create(dto: {ModuleName}Dto) {
    try {
      const result = await this.repository.create(dto);
      return {
        status: 'success',
        data: result,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async findAll(query: any = {}) {
    const { page = 1, limit = 10, search, ...filters } = query;
    
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
          ...filters,
        }
      : filters;

    try {
      const result = await this.repository.findWithPagination({
        page: Number(page),
        limit: Number(limit),
        where,
        orderBy: { createdAt: 'desc' },
      });

      return {
        status: 'success',
        data: result.data,
        meta: result.meta,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async findOne(id: string) {
    try {
      const result = await this.repository.findUnique({ id });
      
      if (!result) {
        throw new NotFoundException(`{ModuleName} with ID ${id} not found`);
      }

      return {
        status: 'success',
        data: result,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async update(id: string, dto: {ModuleName}Dto) {
    try {
      const result = await this.repository.update({
        where: { id },
        data: dto,
      });

      return {
        status: 'success',
        data: result,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async remove(id: string) {
    try {
      await this.repository.delete({ id });

      return {
        status: 'success',
        message: `{ModuleName} with ID ${id} deleted successfully`,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }
}
```

## 🔄 MIGRATIONS MCP

### Migration Pattern
```typescript
// migrations/001_init_users.ts
import { Prisma } from '@prisma/client';

export async function up(prisma: Prisma.TransactionClient) {
  // Create tables
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT UNIQUE NOT NULL,
      "name" TEXT,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `;
}

export async function down(prisma: Prisma.TransactionClient) {
  // Drop tables
  await prisma.$executeRaw`DROP TABLE IF EXISTS "users";`;
}
```

## 🧪 TESTS AVEC PRISMA

### Setup de test
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { {ModuleName}Service } from './{module-name}.service';

describe('{ModuleName}Service', () => {
  let service: {ModuleName}Service;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {ModuleName}Service,
        {
          provide: PrismaService,
          useValue: {
            {modelName}: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<{ModuleName}Service>({ModuleName}Service);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.cleanDatabase();
  });

  it('should create a {module-name}', async () => {
    const dto = { name: 'Test', description: 'Test description' };
    const expected = { id: '1', ...dto };

    jest.spyOn(prisma.{modelName}, 'create').mockResolvedValue(expected);

    const result = await service.create(dto);

    expect(result.status).toBe('success');
    expect(result.data).toEqual(expected);
  });
});
```

## 🎯 INSTRUCTIONS COPILOT

Quand tu génères du code Prisma pour l'architecture MCP :

1. **TOUJOURS** inclure le header MCP avec le nom du module
2. **UTILISER** le PrismaService global injecté
3. **IMPLÉMENTER** le pattern Repository pour la logique de données
4. **GÉRER** les erreurs avec try/catch et retours standardisés MCP
5. **AJOUTER** la pagination et la recherche dans findAll
6. **INCLURE** les relations appropriées dans les queries
7. **RESPECTER** les conventions de nommage Prisma (camelCase pour les champs)
8. **UTILISER** les types générés par Prisma

### Exemple complet d'utilisation :
Si l'utilisateur demande "Crée un module products avec Prisma", tu dois générer :
- Model Product dans le schema Prisma
- ProductRepository avec toutes les méthodes CRUD
- ProductService utilisant le repository
- Gestion des erreurs et réponses MCP standardisées
- Tests unitaires avec mocking
- Types TypeScript appropriés

Cette approche garantit une intégration robuste avec Prisma dans l'architecture MCP Context-7.
