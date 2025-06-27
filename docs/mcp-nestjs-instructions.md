# 🎯 INSTRUCTIONS COPILOT MCP - NESTJS

## 📋 CONTEXTE MCP NESTJS
Ce guide contient les instructions spécialisées pour GitHub Copilot lors du développement avec NestJS dans l'architecture MCP Context-7.

## 🏗️ STRUCTURE NESTJS MCP

### Architecture des Modules
```typescript
src/modules/{module-name}/
├── {module-name}.controller.ts    # API endpoints
├── {module-name}.service.ts       # Business logic
├── {module-name}.module.ts        # Module configuration
├── dto/
│   ├── {module-name}.dto.ts       # Input validation
│   └── index.ts                   # Barrel exports
└── {additional-files}.ts          # Guards, strategies, etc.
```

## 🎨 STANDARDS MCP NESTJS

### 1. Headers MCP obligatoires
```typescript
/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
```

### 2. Conventions de nommage
- **Controllers**: `{FeatureName}Controller`
- **Services**: `{FeatureName}Service`
- **Modules**: `{FeatureName}Module`
- **DTOs**: `{FeatureName}Dto`

### 3. Structure Controller type
```typescript
@Controller('{route-prefix}')
export class {ModuleName}Controller {
  constructor(private readonly service: {ModuleName}Service) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Post()
  async create(@Body() dto: {ModuleName}Dto) {
    return this.service.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: {ModuleName}Dto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
```

### 4. Structure Service type
```typescript
@Injectable()
export class {ModuleName}Service {
  async findAll(query: any) {
    return {
      status: 'success',
      data: [],
      module: '{module-name}'
    };
  }

  async create(dto: {ModuleName}Dto) {
    return {
      status: 'success',
      data: dto,
      module: '{module-name}'
    };
  }

  async findOne(id: string) {
    return {
      status: 'success',
      data: null,
      module: '{module-name}'
    };
  }

  async update(id: string, dto: {ModuleName}Dto) {
    return {
      status: 'success',
      data: { id, ...dto },
      module: '{module-name}'
    };
  }

  async remove(id: string) {
    return {
      status: 'success',
      message: `Deleted ${id}`,
      module: '{module-name}'
    };
  }
}
```

### 5. Structure Module type
```typescript
@Module({
  controllers: [{ModuleName}Controller],
  providers: [{ModuleName}Service],
  exports: [{ModuleName}Service],
})
export class {ModuleName}Module {}
```

### 6. Structure DTO type
```typescript
import { IsOptional, IsString, IsArray } from 'class-validator';

export class {ModuleName}Dto {
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
  params?: Record<string, any>;
}
```

## 🔧 INTÉGRATIONS MCP

### Avec Prisma
```typescript
// Dans le service
constructor(private readonly prisma: PrismaService) {}

async create(dto: {ModuleName}Dto) {
  const result = await this.prisma.{tableName}.create({
    data: dto,
  });
  
  return {
    status: 'success',
    data: result,
    module: '{module-name}'
  };
}
```

### Avec Guards d'authentification
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('{route-prefix}')
@UseGuards(JwtAuthGuard)
export class {ModuleName}Controller {
  // ... endpoints protégés
}
```

### Avec Validation Pipes
```typescript
@Post()
@UsePipes(new ValidationPipe({ transform: true }))
async create(@Body() dto: {ModuleName}Dto) {
  return this.service.create(dto);
}
```

## 📊 RESPONSES STANDARDISÉES MCP

### Success Response
```typescript
{
  status: 'success',
  data: any,
  module: string,
  message?: string
}
```

### Error Response
```typescript
{
  status: 'error',
  error: string,
  module: string,
  statusCode: number
}
```

## 🎯 INSTRUCTIONS COPILOT

Quand tu génères du code NestJS pour l'architecture MCP :

1. **TOUJOURS** inclure le header MCP avec le nom du module
2. **RESPECTER** les conventions de nommage MCP
3. **UTILISER** la structure standardisée (Controller, Service, Module, DTO)
4. **IMPLÉMENTER** les 5 méthodes CRUD de base
5. **RETOURNER** des réponses au format MCP standardisé
6. **AJOUTER** la validation avec class-validator dans les DTOs
7. **EXPORTER** le service dans le module pour réutilisation
8. **DOCUMENTER** les endpoints avec des commentaires clairs

### Exemple complet d'utilisation :
Si l'utilisateur demande "Crée un module products pour NestJS", tu dois générer :
- ProductsController avec les 5 endpoints CRUD
- ProductsService avec la logique métier
- ProductsModule avec la configuration
- ProductsDto avec la validation
- Header MCP Context-7 dans chaque fichier
- Réponses au format MCP standardisé

Cette approche garantit la cohérence avec l'architecture MCP Context-7 et facilite la maintenance future.
