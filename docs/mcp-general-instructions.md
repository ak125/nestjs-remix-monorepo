# 🎯 INSTRUCTIONS COPILOT MCP - GÉNÉRALES

## 📋 CONTEXTE MCP GLOBAL
Ce guide contient les instructions générales pour GitHub Copilot dans l'architecture MCP Context-7. Il complète les guides spécialisés (NestJS, Remix, Prisma, Supabase).

## 🏗️ ARCHITECTURE MCP CONTEXT-7

### Structure Monorepo
```
nestjs-remix-monorepo/
├── packages/
│   ├── backend/           # NestJS API
│   ├── frontend/          # Remix App
│   └── shared/            # Types et utilitaires partagés
├── scripts/mcp/          # Scripts de migration et maintenance
├── templates/mcp/        # Templates pour génération
├── docs/                 # Documentation d'instructions
└── .github/workflows/    # CI/CD
```

## 🎨 STANDARDS MCP GLOBAUX

### 1. Headers MCP Obligatoires
Tous les fichiers générés doivent inclure :
```typescript
/**
 * MCP GENERATED {TYPE}
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
```

Types possibles :
- `CONTROLLER` (NestJS controllers)
- `SERVICE` (NestJS services)
- `MODULE` (NestJS modules)
- `DTO` (Data Transfer Objects)
- `ROUTE` (Remix routes)
- `COMPONENT` (React components)
- `TYPES` (TypeScript interfaces)
- `REPOSITORY` (Data access layer)
- `GUARD` (Auth guards)
- `MIDDLEWARE` (Middlewares)

### 2. Conventions de Nommage MCP
- **Modules** : `kebab-case` (ex: `user-management`)
- **Classes** : `PascalCase` (ex: `UserManagementController`)
- **Fichiers** : `kebab-case.type.ts` (ex: `user-management.controller.ts`)
- **Variables** : `camelCase` (ex: `userManagementService`)
- **Constantes** : `SNAKE_CASE` (ex: `MAX_RETRY_ATTEMPTS`)

### 3. Structure de Réponse Standardisée
```typescript
// Success Response
interface MCPSuccessResponse<T = any> {
  status: 'success';
  data: T;
  module: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

// Error Response  
interface MCPErrorResponse {
  status: 'error';
  error: string;
  module: string;
  statusCode?: number;
  details?: any;
}
```

## 🔧 PATTERNS MCP TRANSVERSAUX

### 1. Module Pattern
Chaque module doit contenir :
```
{module-name}/
├── {module-name}.controller.ts
├── {module-name}.service.ts
├── {module-name}.module.ts
├── dto/
│   ├── {module-name}.dto.ts
│   └── index.ts
├── types/
│   └── {module-name}.types.ts
└── tests/
    ├── {module-name}.controller.spec.ts
    └── {module-name}.service.spec.ts
```

### 2. Error Handling Pattern
```typescript
// Dans les services
try {
  const result = await this.performOperation();
  return {
    status: 'success',
    data: result,
    module: 'module-name',
  };
} catch (error) {
  return {
    status: 'error',
    error: error.message,
    module: 'module-name',
    statusCode: error.status || 500,
  };
}

// Dans les controllers
@Get()
async findAll(@Query() query: any) {
  const result = await this.service.findAll(query);
  
  if (result.status === 'error') {
    throw new HttpException(result.error, result.statusCode || 500);
  }
  
  return result;
}
```

### 3. Validation Pattern
```typescript
// DTO avec validation
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class {ModuleName}Dto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}
```

## 🎯 INTÉGRATIONS MCP

### 1. Backend ↔ Frontend
```typescript
// Backend (NestJS)
@Get()
async findAll(@Query() query: GetUsersQueryDto) {
  return this.usersService.findAll(query);
}

// Frontend (Remix)
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  
  const response = await fetch(`${API_URL}/api/users?${new URLSearchParams(query)}`);
  return json(await response.json());
}
```

### 2. Types Partagés
```typescript
// packages/shared/src/types/users.types.ts
export interface UserData {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse extends MCPSuccessResponse<UserData[]> {
  module: 'users';
}

// Utilisation backend
import { UserData } from '@shared/types/users.types';

// Utilisation frontend  
import { UserData } from '~/shared/types/users.types';
```

### 3. Configuration Environnement
```typescript
// config/mcp.config.ts
export const mcpConfig = {
  generator: 'MCP Context-7',
  version: '2.0',
  modules: {
    backend: 'NestJS',
    frontend: 'Remix', 
    database: 'Prisma' | 'Supabase',
    validation: 'class-validator',
  },
  features: {
    smartScoring: true,
    autoCorrection: true,
    typeGeneration: true,
    dtoValidation: true,
  },
};
```

## 🧪 TESTS MCP

### Pattern de Test Standard
```typescript
/**
 * MCP GENERATED TEST
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { Test, TestingModule } from '@nestjs/testing';
import { {ModuleName}Controller } from './{module-name}.controller';
import { {ModuleName}Service } from './{module-name}.service';

describe('{ModuleName}Controller', () => {
  let controller: {ModuleName}Controller;
  let service: {ModuleName}Service;

  const mockService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [{ModuleName}Controller],
      providers: [
        {
          provide: {ModuleName}Service,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<{ModuleName}Controller>({ModuleName}Controller);
    service = module.get<{ModuleName}Service>({ModuleName}Service);
  });

  describe('findAll', () => {
    it('should return success response', async () => {
      const expected = {
        status: 'success',
        data: [],
        module: '{module-name}',
      };
      
      mockService.findAll.mockResolvedValue(expected);
      
      const result = await controller.findAll({});
      
      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });
});
```

## 📚 DOCUMENTATION MCP

### Pattern de Documentation
```typescript
/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 * 
 * Description: Controller pour la gestion des {module-name}
 * Endpoints:
 * - GET /{module-name} : Récupérer tous les éléments
 * - POST /{module-name} : Créer un nouvel élément
 * - GET /{module-name}/:id : Récupérer un élément par ID
 * - PUT /{module-name}/:id : Mettre à jour un élément
 * - DELETE /{module-name}/:id : Supprimer un élément
 * 
 * @example
 * // Utilisation basique
 * const response = await fetch('/api/{module-name}');
 * const data = await response.json();
 */
```

## 🎯 INSTRUCTIONS COPILOT GÉNÉRALES

Quand tu génères du code pour l'architecture MCP Context-7 :

### Règles Fondamentales
1. **TOUJOURS** inclure le header MCP approprié
2. **RESPECTER** les conventions de nommage MCP
3. **UTILISER** les patterns de réponse standardisés
4. **IMPLÉMENTER** la gestion d'erreur cohérente
5. **AJOUTER** la validation appropriée
6. **DOCUMENTER** le code généré
7. **TESTER** avec des tests unitaires
8. **TYPER** fortement avec TypeScript

### Priorités de Génération
1. **Sécurité** : Validation, authentification, autorisation
2. **Performance** : Pagination, cache, optimisation queries
3. **Maintenabilité** : Code propre, tests, documentation
4. **Extensibilité** : Interfaces, patterns modulaires
5. **Monitorage** : Logs, métriques, health checks

### Checklist de Validation
- [ ] Header MCP présent
- [ ] Conventions de nommage respectées
- [ ] Types TypeScript définis
- [ ] Validation des entrées implémentée
- [ ] Gestion d'erreur cohérente
- [ ] Tests unitaires générés
- [ ] Documentation ajoutée
- [ ] Intégration avec les autres couches

Cette approche garantit la cohérence et la qualité dans toute l'architecture MCP Context-7.
