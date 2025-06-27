# 🎯 MCP CONTEXT-7 - INSTRUCTIONS MAÎTRESSES GITHUB COPILOT

## 🌟 ARCHITECTURE MCP CONTEXT-7

**MCP Context-7** est l'architecture de migration modulaire intelligente qui transforme les applications legacy  en stack moderne TypeScript/NestJS/Remix avec génération automatique d'artefacts et outils de maintenance.

## 🎯 PRINCIPES FONDAMENTAUX MCP

### 1. **Génération Intelligente**
- Analyse automatique du code legacy
- Score de complexité et mapping fonctionnel
- Génération d'artefacts cohérents (Backend + Frontend + Types)
- Correction automatique des noms et structures

### 2. **Architecture Modulaire**
- Un module = un domaine métier complet
- Structure standardisée : Controller + Service + Module + DTO
- Types partagés entre backend et frontend
- Validation stricte avec class-validator et Zod

### 3. **Stack Technique Unifiée**
```typescript
// Architecture MCP Context-7
Backend:    NestJS + TypeScript + Prisma/Supabase
Frontend:   Remix + React + TypeScript
Shared:     Types/DTOs partagés
Validation: class-validator + Zod
Tests:      Jest + Testing Library
CI/CD:      GitHub Actions + Workflows MCP
```

## 🏗️ CONVENTIONS MCP CONTEXT-7

### Nommage Standardisé
```typescript
// Modules Backend
{Feature}Controller    // UserController, AuthController
{Feature}Service      // UserService, AuthService  
{Feature}Module       // UserModule, AuthModule
{Feature}Dto          // UserDto, AuthDto

// Types Frontend
{Feature}Data         // UserData, AuthData
{Feature}Response     // UserResponse, AuthResponse
{Feature}Params       // UserParams, AuthParams

// Routes Remix
{module}.{action}     // users.list, auth.login
{module}.{resource}   // blog.article, catalog.product
```

### Structure de Fichiers MCP
```
packages/
├── backend/src/modules/
│   ├── {module}/
│   │   ├── {module}.controller.ts
│   │   ├── {module}.service.ts
│   │   ├── {module}.module.ts
│   │   └── dto/{module}.dto.ts
├── frontend/app/routes/
│   ├── {module}.{action}.tsx
│   └── {module}.tsx
└── shared/src/
    ├── types/{module}.types.ts
    └── dtos/{module}.dto.ts
```

## 🎯 PATTERNS MCP OBLIGATOIRES

### 1. Controller Pattern NestJS
```typescript
/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Module: {MODULE_NAME}
 */
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { {SERVICE_NAME} } from './{module}.service';
import { {DTO_NAME} } from './dto/{module}.dto';

@Controller('{route-prefix}')
export class {CONTROLLER_NAME} {
  constructor(private readonly service: {SERVICE_NAME}) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Post()
  async create(@Body() dto: {DTO_NAME}) {
    return this.service.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
```

### 2. Service Pattern NestJS
```typescript
/**
 * MCP GENERATED SERVICE
 * Généré automatiquement par MCP Context-7
 * Module: {MODULE_NAME}
 */
import { Injectable } from '@nestjs/common';
import { {DTO_NAME} } from './dto/{module}.dto';

@Injectable()
export class {SERVICE_NAME} {
  async findAll(query: any) {
    try {
      // TODO: Implémenter la logique métier
      return {
        status: 'success',
        data: [],
        module: '{MODULE_NAME}',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ${SERVICE_NAME}.findAll: ${error.message}`);
    }
  }

  async create(dto: {DTO_NAME}) {
    try {
      // TODO: Implémenter la création
      return {
        status: 'success',
        data: dto,
        module: '{MODULE_NAME}',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ${SERVICE_NAME}.create: ${error.message}`);
    }
  }

  async findOne(id: string) {
    try {
      // TODO: Implémenter la recherche par ID
      return {
        status: 'success',
        data: { id },
        module: '{MODULE_NAME}',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ${SERVICE_NAME}.findOne: ${error.message}`);
    }
  }
}
```

### 3. DTO Pattern avec Validation
```typescript
/**
 * MCP GENERATED DTO
 * Généré automatiquement par MCP Context-7
 * Module: {MODULE_NAME}
 */
import { IsOptional, IsString, IsNumber, IsArray, IsObject } from 'class-validator';

export class {DTO_NAME} {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsArray()
  data?: any[];

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
```

### 4. Route Pattern Remix
```typescript
/**
 * MCP GENERATED ROUTE
 * Généré automatiquement par MCP Context-7
 * Module: {MODULE_NAME}
 */
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form } from '@remix-run/react';
import type { {TYPE_NAME}Data, {TYPE_NAME}Response } from '@/shared/types';

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // TODO: Appel API vers le backend NestJS
    const response: {TYPE_NAME}Response = {
      status: 'success',
      data: {
        id: params.id,
        module: '{MODULE_NAME}',
        data: [],
        params: {}
      },
      module: '{MODULE_NAME}',
      timestamp: new Date().toISOString()
    };
    
    return json(response);
  } catch (error) {
    return json(
      { 
        status: 'error', 
        message: error.message,
        module: '{MODULE_NAME}',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    // TODO: Traitement des données et appel API
    
    return json({
      status: 'success',
      message: 'Action completed successfully',
      module: '{MODULE_NAME}',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json(
      { 
        status: 'error', 
        message: error.message,
        module: '{MODULE_NAME}',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

export default function {COMPONENT_NAME}() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="mcp-{module}-container">
      <h1 className="mcp-title">{TITLE}</h1>
      
      {loaderData.status === 'error' && (
        <div className="mcp-error">
          Error: {loaderData.message}
        </div>
      )}
      
      {actionData?.status === 'error' && (
        <div className="mcp-error">
          Action Error: {actionData.message}
        </div>
      )}
      
      <Form method="post" className="mcp-form">
        {/* TODO: Implémenter l'interface utilisateur */}
        <button type="submit" className="mcp-button">
          Submit
        </button>
      </Form>
      
      <div className="mcp-data">
        <pre>{JSON.stringify(loaderData.data, null, 2)}</pre>
      </div>
    </div>
  );
}
```

### 5. Types Pattern Partagés
```typescript
/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: {MODULE_NAME}
 */

export interface {TYPE_NAME}Data {
  id?: string;
  module?: string;
  data?: any[];
  params?: Record<string, any>;
  timestamp?: string;
}

export interface {TYPE_NAME}Response {
  status: 'success' | 'error';
  data: {TYPE_NAME}Data;
  message?: string;
  module: string;
  timestamp: string;
}

export interface {TYPE_NAME}Params {
  id?: string;
  filter?: Record<string, any>;
  sort?: string;
  limit?: number;
  offset?: number;
}
```

## 🔧 INTÉGRATIONS MCP CONTEXT-7

### Prisma Repository Pattern
```typescript
// Dans le service NestJS
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class {SERVICE_NAME} {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const items = await this.prisma.{modelName}.findMany({
      where: query.filter || {},
      orderBy: query.sort ? { [query.sort]: 'asc' } : { createdAt: 'desc' },
      take: query.limit || 10,
      skip: query.offset || 0,
    });

    return {
      status: 'success',
      data: items,
      module: '{MODULE_NAME}',
      timestamp: new Date().toISOString()
    };
  }
}
```

### Supabase Integration Pattern
```typescript
// Dans le service NestJS avec Supabase
import { SupabaseService } from '@/supabase/supabase.service';

@Injectable()
export class {SERVICE_NAME} {
  constructor(private supabase: SupabaseService) {}

  async findAll(query: any) {
    const { data, error } = await this.supabase.client
      .from('{table_name}')
      .select('*')
      .range(query.offset || 0, (query.offset || 0) + (query.limit || 10) - 1);

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    return {
      status: 'success',
      data,
      module: '{MODULE_NAME}',
      timestamp: new Date().toISOString()
    };
  }
}
```

## 🎯 VALIDATION MCP CONTEXT-7

### Checklist Obligatoire
- [ ] **Header MCP** : Commentaire de génération MCP Context-7
- [ ] **Module standardisé** : Nom et structure respectés
- [ ] **Gestion d'erreur** : Try/catch avec messages explicites
- [ ] **Response format** : Format standard avec status/data/module/timestamp
- [ ] **Types cohérents** : Interfaces partagées utilisées
- [ ] **Validation** : DTOs avec class-validator
- [ ] **Documentation** : Commentaires et TODO appropriés

### Scripts de Validation
```bash
# Validation automatique MCP
./scripts/mcp/validate-final.sh

# Correction des noms
./scripts/mcp/fix-invalid-class-names.sh

# Migration par module
./scripts/mcp/migrate-by-module.sh modular-pr --module=nouveau-module
```

## 🚀 WORKFLOW MCP CONTEXT-7

### 1. Génération d'un Nouveau Module
```bash
# Utiliser les templates MCP
cp templates/mcp/controller.template.ts packages/backend/src/modules/{module}/{module}.controller.ts
cp templates/mcp/service.template.ts packages/backend/src/modules/{module}/{module}.service.ts
cp templates/mcp/dto.template.ts packages/backend/src/modules/{module}/dto/{module}.dto.ts
cp templates/mcp/route.template.tsx packages/frontend/app/routes/{module}.tsx

# Remplacer les placeholders
sed -i 's/{{MODULE_NAME}}/{MODULE_NAME}/g' packages/backend/src/modules/{module}/*
```

### 2. Validation et Tests
```bash
# TypeScript check
npm run typecheck

# Lint
npm run lint

# Tests
npm test

# Validation MCP
./scripts/mcp/validate-final.sh
```

### 3. Commit Standards
```bash
git commit -m "feat(mcp): Add {module} module

- ✅ Controller avec routes CRUD
- ✅ Service avec logique métier
- ✅ DTO avec validation
- ✅ Route Remix avec loader/action
- ✅ Types partagés cohérents

Generated by MCP Context-7"
```

## 🎉 OBJECTIFS MCP CONTEXT-7

L'architecture MCP Context-7 garantit :

- ✅ **Migration automatisée** : 245 fichiers PHP → Architecture moderne
- ✅ **Cohérence totale** : Patterns uniformes dans toute l'application
- ✅ **Qualité élevée** : Types stricts, validation, tests
- ✅ **Maintenabilité** : Code lisible et documenté
- ✅ **Extensibilité** : Templates et outils de génération
- ✅ **Performance** : Architecture optimisée
- ✅ **Sécurité** : Validation et gestion d'erreur robustes

---

## 📚 RÉFÉRENCES MCP

- [Instructions Générales MCP](./mcp-general-instructions.md)
- [Instructions NestJS MCP](./mcp-nestjs-instructions.md)
- [Instructions Remix MCP](./mcp-remix-instructions.md)
- [Instructions Prisma MCP](./mcp-prisma-instructions.md)
- [Instructions Supabase MCP](./mcp-supabase-instructions.md)

---

*Ces instructions MCP Context-7 sont la référence absolue pour GitHub Copilot dans l'architecture de migration modulaire intelligente. Elles garantissent la génération de code cohérent, performant et maintenable.*
