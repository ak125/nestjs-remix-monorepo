---
title: "SpecKit Workflow: Implement"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [speckit, workflow, implementation, codegen]
priority: high
---

# 🚀 SpecKit Workflow: Implement

> **Guider l'implémentation avec templates, patterns, et bonnes pratiques du projet.**

Ce workflow accompagne le développement en fournissant templates de code, commandes utilitaires, et guidelines d'intégration.

---

## 🎯 Objectif

Faciliter l'implémentation avec :
1. ✅ **Templates de Code** : Boilerplate NestJS, Remix, Supabase
2. ✅ **Commandes Utilitaires** : Scripts de génération automatique
3. ✅ **Patterns du Projet** : SupabaseBaseService, Zod DTOs, etc.
4. ✅ **Guidelines Intégration** : Comment intégrer dans monorepo existant
5. ✅ **Workflow Git** : Branches, commits, PR

---

## 📋 Prérequis

**Avant d'utiliser `/speckit.implement`** :
- ✅ Spec, Plan, Tasks, Checklist validés
- ✅ Analyse effectuée (gaps résolus)
- ✅ Environnement dev prêt
- ✅ Branch feature créée

---

## 🚀 Processus d'Implémentation

### Étape 1 : Setup Initial

#### 1.1 Créer Branch Feature

```bash
# Créer branch depuis main
git checkout main
git pull origin main
git checkout -b feat/mon-feature

# Créer PR draft
gh pr create --draft --title "feat: Mon Feature" --body "
## Type
- [x] Feature

## Description
Implementation de [Mon Feature] selon spec approuvée.

## Checklist
- [ ] Database migrations
- [ ] Backend API
- [ ] Frontend routes
- [ ] Tests (unit + integration + E2E)
- [ ] Documentation

## Related
- Spec: .spec/features/mon-feature.md
- Plan: .spec/plans/mon-feature-plan.md
- Tasks: .spec/tasks/mon-feature-tasks.md
"
```

#### 1.2 Préparer Structure Fichiers

```bash
# Backend
mkdir -p backend/src/modules/mon-feature/{dto,entities,tests}
touch backend/src/modules/mon-feature/{mon-feature.module.ts,mon-feature.controller.ts,mon-feature.service.ts}
touch backend/src/modules/mon-feature/dto/{create-mon-feature.dto.ts,update-mon-feature.dto.ts,mon-feature-response.dto.ts}
touch backend/src/modules/mon-feature/entities/mon-feature.entity.ts
touch backend/src/modules/mon-feature/tests/{mon-feature.service.spec.ts,mon-feature.controller.spec.ts}
touch backend/src/modules/mon-feature/README.md

# Data Service
touch backend/src/database/services/mon-feature-data.service.ts

# Migrations
mkdir -p supabase/migrations
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_create_mon_feature_table.sql

# Frontend
mkdir -p frontend/app/routes
touch frontend/app/routes/mon-feature.tsx
touch frontend/app/routes/mon-feature._index.tsx
touch frontend/app/routes/mon-feature.new.tsx
touch frontend/app/routes/mon-feature.\$id.tsx
touch frontend/app/routes/mon-feature.\$id.edit.tsx

# Composants
mkdir -p frontend/app/components/mon-feature
touch frontend/app/components/mon-feature/{MonFeatureCard.tsx,MonFeatureForm.tsx,MonFeatureList.tsx,MonFeatureFilters.tsx}
```

---

### Étape 2 : Database & Migrations

#### Template Migration SQL

```sql
-- Migration: YYYYMMDD_create_mon_feature_table.sql
-- Description: Création table mon_feature_table pour feature [Mon Feature]
-- Author: [Votre nom]
-- Date: YYYY-MM-DD

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mon_feature_table (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Business Fields
  field1 VARCHAR(255) NOT NULL,
  field2 INTEGER DEFAULT 0 CHECK (field2 >= 0),
  field3 JSONB,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Index sur user_id (queries fréquentes)
CREATE INDEX idx_mon_feature_user_id 
  ON public.mon_feature_table(user_id);

-- Index sur status (filtrage)
CREATE INDEX idx_mon_feature_status 
  ON public.mon_feature_table(status) 
  WHERE deleted_at IS NULL;

-- Index sur created_at (tri chronologique)
CREATE INDEX idx_mon_feature_created_at 
  ON public.mon_feature_table(created_at DESC);

-- Index composite pour queries user + status
CREATE INDEX idx_mon_feature_user_status 
  ON public.mon_feature_table(user_id, status) 
  WHERE deleted_at IS NULL;

-- Contrainte UNIQUE (éviter doublons)
CREATE UNIQUE INDEX idx_mon_feature_unique_user_field1 
  ON public.mon_feature_table(user_id, field1) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.mon_feature_table ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: users voient seulement leurs données
CREATE POLICY "Users can view their own mon_feature records"
  ON public.mon_feature_table
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy INSERT: users créent seulement sous leur user_id
CREATE POLICY "Users can insert their own mon_feature records"
  ON public.mon_feature_table
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy UPDATE: users modifient seulement leurs données
CREATE POLICY "Users can update their own mon_feature records"
  ON public.mon_feature_table
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy DELETE: users suppriment seulement leurs données
CREATE POLICY "Users can delete their own mon_feature records"
  ON public.mon_feature_table
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Trigger updated_at (auto-update)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mon_feature_table
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.mon_feature_table IS 
  'Table pour stocker les items de [Mon Feature]';

COMMENT ON COLUMN public.mon_feature_table.id IS 
  'UUID unique de l''item';
COMMENT ON COLUMN public.mon_feature_table.user_id IS 
  'UUID de l''utilisateur propriétaire';
COMMENT ON COLUMN public.mon_feature_table.field1 IS 
  'Description field1';
COMMENT ON COLUMN public.mon_feature_table.field2 IS 
  'Description field2';
COMMENT ON COLUMN public.mon_feature_table.status IS 
  'Status de l''item (active, inactive, archived)';

-- ============================================================================
-- 6. ROLLBACK SCRIPT (optionnel, pour référence)
-- ============================================================================

-- Pour rollback cette migration :
-- DROP TABLE IF EXISTS public.mon_feature_table CASCADE;
```

**Commandes** :
```bash
# Appliquer migration localement
supabase db reset --local

# Vérifier table créée
supabase db --local psql -c "\d public.mon_feature_table"

# Vérifier indexes
supabase db --local psql -c "\di public.mon_feature_*"

# Tester RLS policies
supabase db --local psql -c "SELECT * FROM public.mon_feature_table;" # Doit échouer sans auth
```

---

### Étape 3 : Backend - Data Service

#### Template Data Service

```typescript
// backend/src/database/services/mon-feature-data.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseBaseService } from './supabase-base.service';

export interface MonFeature {
  id: string;
  userId: string;
  field1: string;
  field2: number;
  field3: Record<string, any> | null;
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class MonFeatureDataService extends SupabaseBaseService<MonFeature> {
  constructor(
    @Inject('SUPABASE_CLIENT') supabaseClient: SupabaseClient,
  ) {
    super(supabaseClient, 'mon_feature_table');
  }

  /**
   * Récupère tous les items d'un utilisateur
   * @param userId - UUID de l'utilisateur
   * @param filters - Filtres optionnels (status, etc.)
   */
  async findByUserId(
    userId: string,
    filters?: { status?: string; limit?: number; offset?: number },
  ): Promise<MonFeature[]> {
    let query = this.query()
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch mon_feature: ${error.message}`);
    }

    return data as MonFeature[];
  }

  /**
   * Compte le nombre total d'items d'un utilisateur
   */
  async countByUserId(userId: string, filters?: { status?: string }): Promise<number> {
    let query = this.client
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count mon_feature: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Soft delete d'un item
   */
  async softDelete(id: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to soft delete mon_feature: ${error.message}`);
    }
  }
}
```

**Test Unitaire Data Service** :

```typescript
// backend/src/database/services/mon-feature-data.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MonFeatureDataService } from './mon-feature-data.service';

describe('MonFeatureDataService', () => {
  let service: MonFeatureDataService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonFeatureDataService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    service = module.get<MonFeatureDataService>(MonFeatureDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUserId', () => {
    it('should return user items', async () => {
      const mockData = [
        { id: '1', userId: 'user-123', field1: 'test', field2: 42 },
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await service.findByUserId('user-123');
      
      expect(result).toEqual(mockData);
    });
  });

  describe('softDelete', () => {
    it('should soft delete item', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await expect(service.softDelete('item-123')).resolves.not.toThrow();
    });
  });
});
```

---

### Étape 4 : Backend - DTOs & Validation

#### Template DTOs Zod

```typescript
// backend/src/modules/mon-feature/dto/create-mon-feature.dto.ts
import { z } from 'zod';

export const CreateMonFeatureSchema = z.object({
  field1: z.string().min(1, 'field1 is required').max(255, 'field1 max 255 chars'),
  field2: z.number().int().nonnegative().optional().default(0),
  field3: z.record(z.any()).optional(),
});

export type CreateMonFeatureDto = z.infer<typeof CreateMonFeatureSchema>;
```

```typescript
// backend/src/modules/mon-feature/dto/update-mon-feature.dto.ts
import { z } from 'zod';
import { CreateMonFeatureSchema } from './create-mon-feature.dto';

export const UpdateMonFeatureSchema = CreateMonFeatureSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export type UpdateMonFeatureDto = z.infer<typeof UpdateMonFeatureSchema>;
```

```typescript
// backend/src/modules/mon-feature/dto/filters.dto.ts
import { z } from 'zod';

export const FiltersSchema = z.object({
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'field1', 'field2']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type FiltersDto = z.infer<typeof FiltersSchema>;
```

---

### Étape 5 : Backend - Service & Controller

#### Template Service Métier

```typescript
// backend/src/modules/mon-feature/mon-feature.service.ts
import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { MonFeatureDataService, MonFeature } from '../../database/services/mon-feature-data.service';
import { CreateMonFeatureDto } from './dto/create-mon-feature.dto';
import { UpdateMonFeatureDto } from './dto/update-mon-feature.dto';
import { FiltersDto } from './dto/filters.dto';

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class MonFeatureService {
  private readonly logger = new Logger(MonFeatureService.name);

  constructor(
    private readonly dataService: MonFeatureDataService,
  ) {}

  async create(userId: string, dto: CreateMonFeatureDto): Promise<MonFeature> {
    this.logger.log(`Creating mon_feature for user ${userId}`);

    try {
      const item = await this.dataService.insert({
        userId,
        ...dto,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log(`mon_feature created: ${item.id}`);
      return item;
    } catch (error) {
      if (error.message.includes('duplicate key') || error.code === '23505') {
        throw new ConflictException('Item already exists');
      }
      throw error;
    }
  }

  async findAll(userId: string, filters?: FiltersDto): Promise<PaginatedResponse<MonFeature>> {
    const { page = 1, limit = 20, status, sortBy, sortOrder } = filters || {};
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.dataService.findByUserId(userId, { status, limit, offset }),
      this.dataService.countByUserId(userId, { status }),
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

  async findOne(userId: string, id: string): Promise<MonFeature> {
    const item = await this.dataService.findById(id);

    if (!item || item.deletedAt) {
      throw new NotFoundException('Item not found');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have access to this item');
    }

    return item;
  }

  async update(userId: string, id: string, dto: UpdateMonFeatureDto): Promise<MonFeature> {
    // Vérifier ownership
    await this.findOne(userId, id);

    this.logger.log(`Updating mon_feature ${id} for user ${userId}`);

    const updated = await this.dataService.update(id, {
      ...dto,
      updatedAt: new Date(),
    });

    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    // Vérifier ownership
    await this.findOne(userId, id);

    this.logger.log(`Soft deleting mon_feature ${id} for user ${userId}`);

    await this.dataService.softDelete(id);
  }
}
```

#### Template Controller REST

```typescript
// backend/src/modules/mon-feature/mon-feature.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MonFeatureService } from './mon-feature.service';
import { CreateMonFeatureDto, CreateMonFeatureSchema } from './dto/create-mon-feature.dto';
import { UpdateMonFeatureDto, UpdateMonFeatureSchema } from './dto/update-mon-feature.dto';
import { FiltersDto, FiltersSchema } from './dto/filters.dto';

@ApiTags('mon-feature')
@Controller('mon-feature')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MonFeatureController {
  constructor(private readonly monFeatureService: MonFeatureService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new item' })
  @ApiResponse({ status: 201, description: 'Item created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Item already exists' })
  @UsePipes(new ZodValidationPipe(CreateMonFeatureSchema))
  async create(@Body() dto: CreateMonFeatureDto, @Req() req: any) {
    const userId = req.user.id;
    return this.monFeatureService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user items' })
  @ApiResponse({ status: 200, description: 'List of items' })
  @UsePipes(new ZodValidationPipe(FiltersSchema))
  async findAll(@Query() filters: FiltersDto, @Req() req: any) {
    const userId = req.user.id;
    return this.monFeatureService.findAll(userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiResponse({ status: 200, description: 'Item found' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.monFeatureService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update item' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UsePipes(new ZodValidationPipe(UpdateMonFeatureSchema))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMonFeatureDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.monFeatureService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete item (soft delete)' })
  @ApiResponse({ status: 204, description: 'Item deleted' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    await this.monFeatureService.remove(userId, id);
  }
}
```

#### Template Module

```typescript
// backend/src/modules/mon-feature/mon-feature.module.ts
import { Module } from '@nestjs/common';
import { MonFeatureController } from './mon-feature.controller';
import { MonFeatureService } from './mon-feature.service';
import { MonFeatureDataService } from '../../database/services/mon-feature-data.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MonFeatureController],
  providers: [MonFeatureService, MonFeatureDataService],
  exports: [MonFeatureService],
})
export class MonFeatureModule {}
```

**Enregistrer dans AppModule** :
```typescript
// backend/src/app.module.ts
import { MonFeatureModule } from './modules/mon-feature/mon-feature.module';

@Module({
  imports: [
    // ... autres modules
    MonFeatureModule,
  ],
})
export class AppModule {}
```

---

### Étape 6 : Frontend - Routes Remix

#### Template Route Index (Liste)

```typescript
// frontend/app/routes/mon-feature._index.tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Link } from '@remix-run/react';
import { MonFeatureCard } from '~/components/mon-feature/MonFeatureCard';
import { MonFeatureFilters } from '~/components/mon-feature/MonFeatureFilters';
import { Button } from '~/components/ui/Button';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || '1';
  const status = url.searchParams.get('status') || '';
  
  const token = getAuthToken(request);
  
  const response = await fetch(
    `${process.env.API_URL}/api/mon-feature?page=${page}&status=${status}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch items');
  }
  
  const data = await response.json();
  return json(data);
}

export default function MonFeatureIndex() {
  const { data, meta } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mon Feature</h1>
        <Link to="/mon-feature/new">
          <Button>Créer</Button>
        </Link>
      </div>

      <MonFeatureFilters
        defaultStatus={searchParams.get('status') || ''}
        onChange={(filters) => setSearchParams(filters)}
      />

      {data.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun item pour le moment</p>
          <Link to="/mon-feature/new">
            <Button className="mt-4">Créer votre premier item</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => (
              <MonFeatureCard key={item.id} item={item} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-8">
            {meta.page > 1 && (
              <Link to={`?page=${meta.page - 1}`}>
                <Button variant="outline">Précédent</Button>
              </Link>
            )}
            <span className="flex items-center px-4">
              Page {meta.page} / {meta.totalPages}
            </span>
            {meta.page < meta.totalPages && (
              <Link to={`?page=${meta.page + 1}`}>
                <Button variant="outline">Suivant</Button>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

#### Template Route New (Création)

```typescript
// frontend/app/routes/mon-feature.new.tsx
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useActionData, Form } from '@remix-run/react';
import { MonFeatureForm } from '~/components/mon-feature/MonFeatureForm';
import { toast } from '~/components/ui/Toast';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = getAuthToken(request);

  const body = {
    field1: formData.get('field1'),
    field2: Number(formData.get('field2')),
  };

  const response = await fetch(`${process.env.API_URL}/api/mon-feature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    return json({ error: error.message }, { status: response.status });
  }

  toast.success('Item créé avec succès');
  return redirect('/mon-feature');
}

export default function MonFeatureNew() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Créer un item</h1>
      
      {actionData?.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {actionData.error}
        </div>
      )}

      <MonFeatureForm />
    </div>
  );
}
```

---

### Étape 7 : Tests & Quality

**Commandes utiles** :

```bash
# Tests unitaires
npm test mon-feature.service.spec.ts
npm test mon-feature.controller.spec.ts

# Tests avec coverage
npm test -- --coverage

# Tests intégration
npm test mon-feature.integration.spec.ts

# Tests E2E
npm run test:e2e mon-feature.e2e.spec.ts

# Lint
npm run lint

# Format
npm run format

# Type-check
npm run type-check
```

---

### Étape 8 : Git Workflow

#### Commits Conventionnels

```bash
# Feature implementation
git add backend/src/modules/mon-feature/
git commit -m "feat(mon-feature): add CRUD service and controller"

# Tests
git add backend/src/modules/mon-feature/tests/
git commit -m "test(mon-feature): add unit tests for service"

# Frontend
git add frontend/app/routes/mon-feature*
git commit -m "feat(mon-feature): add Remix routes for CRUD"

# Documentation
git add backend/src/modules/mon-feature/README.md
git commit -m "docs(mon-feature): add module README"

# Migration
git add supabase/migrations/
git commit -m "feat(db): add mon_feature_table migration"
```

#### Mise à Jour PR

```bash
# Marquer PR ready for review
gh pr ready

# Demander review
gh pr edit --add-reviewer @tech-lead

# Auto-merge après approval
gh pr merge --auto --squash
```

---

## 🔗 Prochaines Étapes

Après avoir complété `/speckit.implement` :

1. **Passer checklist Pre-Review** (Phase 3)
2. **Demander code review**
3. **Itérer selon feedback**
4. **Merger PR**
5. **Déployer en staging**
6. **Validation métier**
7. **Déployer en production**

---

## 📚 Ressources

- [Constitution du Projet](../constitution.md)
- [ADR-001: Supabase Direct](../architecture/decisions/001-supabase-direct.md)
- [ADR-002: Monorepo Structure](../architecture/decisions/002-monorepo-structure.md)
- [SupabaseBaseService Pattern](../guides/supabase-base-service.md)
- [Testing Best Practices](../guides/testing-best-practices.md)
- [Remix Documentation](https://remix.run/docs)
- [NestJS Documentation](https://docs.nestjs.com)

---

**Note** : Ces templates sont des points de départ. Adapter selon besoins spécifiques feature.
