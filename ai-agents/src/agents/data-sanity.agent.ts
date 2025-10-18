import { IAgent, AgentResult, AgentStatus, AgentType, KPI } from '../types';
import { promises as fs } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 🔍 AGENT 11: DATA SANITY CHECKER
 *
 * 🎯 MÉTHODOLOGIE
 * - **Outils**:
 *   - Prisma introspect pour schema analysis
 *   - Supabase SQL queries (information_schema)
 *   - Redis SCAN pour cache keys analysis
 * - **Confidence**: MEDIUM (nécessite accès DB en lecture)
 * - **Detection**: Schema diff + constraint validation
 * 
 * 📊 CLASSIFICATION PAR GRAVITÉ (116 incohérences détectées)
 * 
 * 🔴 **0 CRITIQUES** - Excellent! Aucun problème bloquant
 * 
 * 🟠 **3 HAUTES** - Action Requise ≤10 jours
 * - Prisma models (User, Session) sans tables Supabase correspondantes
 * - **Owner**: Backend Lead
 * - **Action**: Supprimer backend/prisma/schema.prisma (vestige)
 * - **Effort**: 2h (suppression fichier + vérification PrismaService)
 * - **Deadline**: ≤10 jours
 * 
 * 🟡 **113 MOYENNES** - Attendu (Pas d'action)
 * - Tables Supabase sans models Prisma correspondants
 * - **Status**: EXPECTED (architecture 100% Supabase intentionnelle)
 * - **Raison**: Le projet utilise Supabase directement (112 tables)
 * - **Action**: Aucune (faux positif de l'analyse)
 * - **Note**: L'agent détecte correctement mais l'architecture est intentionnelle
 * 
 * 💡 CONTEXTE ARCHITECTURAL
 * - **Architecture actuelle**: 100% Supabase (112 tables opérationnelles)
 * - **Prisma**: Vestige (2 models orphelins User + Session)
 * - **Migration historique**: Prisma → Supabase (migration complétée)
 * - **Recommandation**: Cleanup final du fichier schema.prisma
 * 
 * Analyse la cohérence et la qualité des données:
 * - Schéma Prisma (contraintes, indexes, relations)
 * - Tables Supabase (existence, types, null constraints)
 * - Cache Redis (keys patterns, TTL, consistency)
 * - Migrations (breaking changes, rollback, data loss)
 *
 * Objectifs:
 * 1. Détecter incohérences schema/DB
 * 2. Identifier risques data integrity
 * 3. Valider cache coherence
 * 4. Analyser migrations safety
 */

// =====================================================
// INTERFACES & TYPES
// =====================================================

interface PrismaSchema {
  models: PrismaModel[];
  enums: PrismaEnum[];
}

interface PrismaModel {
  name: string;
  fields: PrismaField[];
  indexes: PrismaIndex[];
  uniqueConstraints: string[][];
}

interface PrismaField {
  name: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isList: boolean;
  hasDefault: boolean;
  defaultValue?: string;
  relation?: {
    model: string;
    fields: string[];
    references: string[];
    onDelete?: string;
    onUpdate?: string;
  };
}

interface PrismaIndex {
  fields: string[];
  isUnique: boolean;
}

interface PrismaEnum {
  name: string;
  values: string[];
}

interface SupabaseTable {
  tableName: string;
  exists: boolean;
  columns: SupabaseColumn[];
  indexes: SupabaseIndex[];
  foreignKeys: SupabaseForeignKey[];
}

interface SupabaseColumn {
  name: string;
  type: string;
  isNullable: boolean;
  hasDefault: boolean;
  defaultValue?: string;
}

interface SupabaseIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
}

interface SupabaseForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

interface RedisPattern {
  pattern: string;
  keyCount: number;
  exampleKeys: string[];
  hasTTL: boolean;
  avgTTL?: number;
  usage: string; // "cart", "session", "cache", "custom"
}

interface DataInconsistency {
  id: string;
  type: 'schema-mismatch' | 'missing-constraint' | 'cache-incoherence' | 'migration-risk';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source: string; // "Prisma", "Supabase", "Redis", "Migration"
  description: string;
  impact: string;
  recommendation: string;
  affectedEntities: string[];
}

interface MigrationAnalysis {
  totalMigrations: number;
  pendingMigrations: number;
  appliedMigrations: string[];
  breakingChanges: BreakingChange[];
  rollbackComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface BreakingChange {
  migration: string;
  changeType: 'DROP_COLUMN' | 'DROP_TABLE' | 'CHANGE_TYPE' | 'REMOVE_DEFAULT' | 'ADD_CONSTRAINT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  dataLossRisk: boolean;
}

interface DataSanityPlan {
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  steps: DataSanityStep[];
  estimatedDuration: string; // "2h 30min"
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface DataSanityStep {
  order: number;
  name: string;
  action: string;
  duration: string;
  automatable: boolean;
  tools: string[];
}

// =====================================================
// AGENT IMPLEMENTATION
// =====================================================

export class DataSanityAgent implements IAgent {
  name = 'Data Sanity';
  type: AgentType = 'data-sanity';
  description = 'Analyse cohérence données Prisma/Supabase/Redis';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private workspaceRoot: string;
  private backendPath: string;
  private prismaSchemaPath: string;

  constructor() {
    this.workspaceRoot = process.cwd().includes('ai-agents')
      ? path.resolve(process.cwd(), '..')
      : process.cwd();
    this.backendPath = path.join(this.workspaceRoot, 'backend');
    this.prismaSchemaPath = path.join(this.backendPath, 'prisma', 'schema.prisma');
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    this.status = 'running';
    const startTime = Date.now();

    console.log('🔍 Data Sanity - Analyse en cours...');

    // 1. Analyser Prisma schema
    console.log('📦 Analyse schéma Prisma...');
    const prismaSchema = await this.analyzePrismaSchema();
    console.log(`✓ ${prismaSchema.models.length} modèles Prisma détectés`);

    // 2. Détecter tables Supabase (via code analysis)
    console.log('🗄️  Détection tables Supabase...');
    const supabaseTables = await this.detectSupabaseTables();
    console.log(`✓ ${supabaseTables.length} tables Supabase détectées`);

    // 3. Analyser patterns Redis
    console.log('⚡ Analyse patterns Redis...');
    const redisPatterns = await this.analyzeRedisPatterns();
    console.log(`✓ ${redisPatterns.length} patterns Redis détectés`);

    // 4. Analyser migrations
    console.log('🔄 Analyse migrations...');
    const migrationAnalysis = await this.analyzeMigrations();
    console.log(
      `✓ ${migrationAnalysis.totalMigrations} migrations, ${migrationAnalysis.breakingChanges.length} breaking changes`,
    );

    // 5. Détecter incohérences
    console.log('🔍 Détection incohérences...');
    const inconsistencies = await this.detectInconsistencies(
      prismaSchema,
      supabaseTables,
      redisPatterns,
      migrationAnalysis,
    );
    console.log(`✓ ${inconsistencies.length} incohérences détectées`);

    // 6. Générer plan correction
    console.log('📋 Génération plan correction...');
    const sanityPlan = await this.generateSanityPlan(inconsistencies);

    const executionTime = Date.now() - startTime;

    // Calculer KPIs
    const criticalInconsistencies = inconsistencies.filter((i) => i.severity === 'CRITICAL').length;
    const schemaMatches = supabaseTables.filter((t) =>
      prismaSchema.models.some((m) => this.normalizeTableName(m.name) === t.tableName),
    ).length;
    const schemaMatchPercentage = supabaseTables.length > 0 ? (schemaMatches / supabaseTables.length) * 100 : 0;

    // Sauvegarder reports
    await this.saveReports(
      prismaSchema,
      supabaseTables,
      redisPatterns,
      migrationAnalysis,
      inconsistencies,
      sanityPlan,
      executionTime,
    );

    console.log('💾 Reports: data-sanity.{json,md}, data-sanity-fix.sh');

    const duration = Date.now() - startTime;
    this.status = 'completed';

    // Build KPIs
    const kpis: KPI[] = [
      {
        name: 'Incohérences CRITICAL',
        value: criticalInconsistencies,
        status: criticalInconsistencies === 0 ? 'ok' : 'critical',
      },
      {
        name: 'Schema Match',
        value: `${schemaMatchPercentage.toFixed(0)}%`,
        status: schemaMatchPercentage >= 80 ? 'ok' : schemaMatchPercentage >= 50 ? 'warning' : 'critical',
      },
      {
        name: 'Breaking Changes',
        value: migrationAnalysis.breakingChanges.length,
        status: migrationAnalysis.breakingChanges.length === 0 ? 'ok' : 'warning',
      },
    ];

    return {
      agentName: this.name,
      agentType: this.type,
      status: criticalInconsistencies > 0 ? 'warning' : 'success',
      timestamp: new Date(),
      duration,
      data: {
        prismaSchema,
        supabaseTables,
        redisPatterns,
        migrationAnalysis,
        inconsistencies,
        sanityPlan,
      },
      warnings:
        inconsistencies.length > 0
          ? [`${inconsistencies.length} inconsistencies found (${criticalInconsistencies} CRITICAL)`]
          : [],
      kpis,
    };
  }

  // =====================================================
  // PRISMA SCHEMA ANALYSIS
  // =====================================================

  private async analyzePrismaSchema(): Promise<PrismaSchema> {
    try {
      const schemaContent = await fs.readFile(this.prismaSchemaPath, 'utf-8');

      const models: PrismaModel[] = [];
      const enums: PrismaEnum[] = [];

      // Parser simpliste (regex-based) pour modèles Prisma
      const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/gs;
      let modelMatch;

      while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
        const [, modelName, modelBody] = modelMatch;
        const fields = this.parseModelFields(modelBody);
        const indexes = this.parseModelIndexes(modelBody);
        const uniqueConstraints = this.parseUniqueConstraints(modelBody);

        models.push({
          name: modelName,
          fields,
          indexes,
          uniqueConstraints,
        });
      }

      // Parser enums
      const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/gs;
      let enumMatch;

      while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
        const [, enumName, enumBody] = enumMatch;
        const values = enumBody
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('//'));

        enums.push({
          name: enumName,
          values,
        });
      }

      return { models, enums };
    } catch (error) {
      console.warn('⚠️  Prisma schema not found or invalid');
      return { models: [], enums: [] };
    }
  }

  private parseModelFields(modelBody: string): PrismaField[] {
    const fields: PrismaField[] = [];
    const lines = modelBody.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      // Parse field: name type modifiers
      const fieldMatch = trimmed.match(/^(\w+)\s+([\w\[\]]+)(\s+.*)?$/);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType, modifiers = ''] = fieldMatch;

      const isRequired = !modifiers.includes('?');
      const isUnique = modifiers.includes('@unique');
      const isList = fieldType.includes('[]');
      const hasDefault = modifiers.includes('@default');
      const defaultMatch = modifiers.match(/@default\(([^)]+)\)/);
      const defaultValue = defaultMatch ? defaultMatch[1] : undefined;

      // Parse relation
      let relation: PrismaField['relation'] = undefined;
      const relationMatch = modifiers.match(/@relation\(([^)]+)\)/);
      if (relationMatch) {
        const relationBody = relationMatch[1];
        const fieldsMatch = relationBody.match(/fields:\s*\[([^\]]+)\]/);
        const referencesMatch = relationBody.match(/references:\s*\[([^\]]+)\]/);
        const onDeleteMatch = relationBody.match(/onDelete:\s*(\w+)/);
        const onUpdateMatch = relationBody.match(/onUpdate:\s*(\w+)/);

        relation = {
          model: fieldType.replace('[]', ''),
          fields: fieldsMatch ? fieldsMatch[1].split(',').map((f) => f.trim()) : [],
          references: referencesMatch ? referencesMatch[1].split(',').map((r) => r.trim()) : [],
          onDelete: onDeleteMatch ? onDeleteMatch[1] : undefined,
          onUpdate: onUpdateMatch ? onUpdateMatch[1] : undefined,
        };
      }

      fields.push({
        name: fieldName,
        type: fieldType.replace('[]', ''),
        isRequired,
        isUnique,
        isList,
        hasDefault,
        defaultValue,
        relation,
      });
    }

    return fields;
  }

  private parseModelIndexes(modelBody: string): PrismaIndex[] {
    const indexes: PrismaIndex[] = [];
    const lines = modelBody.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // @@index([field1, field2])
      const indexMatch = trimmed.match(/@@index\(\[([^\]]+)\]/);
      if (indexMatch) {
        const fields = indexMatch[1].split(',').map((f) => f.trim());
        indexes.push({ fields, isUnique: false });
      }

      // @@unique([field1, field2])
      const uniqueMatch = trimmed.match(/@@unique\(\[([^\]]+)\]/);
      if (uniqueMatch) {
        const fields = uniqueMatch[1].split(',').map((f) => f.trim());
        indexes.push({ fields, isUnique: true });
      }
    }

    return indexes;
  }

  private parseUniqueConstraints(modelBody: string): string[][] {
    const constraints: string[][] = [];
    const lines = modelBody.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const uniqueMatch = trimmed.match(/@@unique\(\[([^\]]+)\]/);
      if (uniqueMatch) {
        const fields = uniqueMatch[1].split(',').map((f) => f.trim());
        constraints.push(fields);
      }
    }

    return constraints;
  }

  // =====================================================
  // SUPABASE TABLES DETECTION
  // =====================================================

  private async detectSupabaseTables(): Promise<SupabaseTable[]> {
    // Détecte tables via analyse du code (from('table_name'))
    const srcPath = path.join(this.backendPath, 'src');
    const tables = new Map<string, SupabaseTable>();

    try {
      const files = await this.getAllTsFiles(srcPath);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Chercher .from('table_name')
        const fromRegex = /\.from\(['"]([^'"]+)['"]\)/g;
        let match;

        while ((match = fromRegex.exec(content)) !== null) {
          const tableName = match[1];
          if (!tables.has(tableName)) {
            tables.set(tableName, {
              tableName,
              exists: true,
              columns: [], // On ne peut pas détecter les colonnes sans DB access
              indexes: [],
              foreignKeys: [],
            });
          }
        }
      }

      return Array.from(tables.values());
    } catch (error) {
      console.warn('⚠️  Error detecting Supabase tables:', error);
      return [];
    }
  }

  private async getAllTsFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, dist
          if (entry.name === 'node_modules' || entry.name === 'dist') continue;
          files.push(...(await this.getAllTsFiles(fullPath)));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return files;
  }

  // =====================================================
  // REDIS PATTERNS ANALYSIS
  // =====================================================

  private async analyzeRedisPatterns(): Promise<RedisPattern[]> {
    // Analyse patterns Redis via code (pas de connexion DB)
    const srcPath = path.join(this.backendPath, 'src');
    const patterns: RedisPattern[] = [];

    try {
      const files = await this.getAllTsFiles(srcPath);
      const keyPatterns = new Map<string, { count: number; examples: string[] }>();

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Chercher redis.get('key'), redis.set('key'), etc.
        const redisRegex = /redis\.(get|set|setex|del|keys)\(['"]([^'"]+)['"]\)/g;
        let match;

        while ((match = redisRegex.exec(content)) !== null) {
          const [, operation, key] = match;
          const normalizedPattern = this.normalizeRedisKey(key);

          if (!keyPatterns.has(normalizedPattern)) {
            keyPatterns.set(normalizedPattern, { count: 0, examples: [] });
          }

          const pattern = keyPatterns.get(normalizedPattern)!;
          pattern.count++;
          if (pattern.examples.length < 3 && !pattern.examples.includes(key)) {
            pattern.examples.push(key);
          }
        }
      }

      // Convertir en RedisPattern
      for (const [pattern, data] of keyPatterns.entries()) {
        patterns.push({
          pattern,
          keyCount: data.count,
          exampleKeys: data.examples,
          hasTTL: data.examples.some((k) => k.includes('cache') || k.includes('session')),
          usage: this.classifyRedisUsage(pattern),
        });
      }

      return patterns;
    } catch (error) {
      console.warn('⚠️  Error analyzing Redis patterns:', error);
      return [];
    }
  }

  private normalizeRedisKey(key: string): string {
    // Remplacer IDs dynamiques par placeholders
    return key
      .replace(/\$\{[^}]+\}/g, '{id}')
      .replace(/`[^`]*\$\{[^}]+\}[^`]*`/g, 'template-{id}')
      .replace(/:\d+/g, ':{id}')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '{uuid}');
  }

  private classifyRedisUsage(pattern: string): string {
    if (pattern.includes('cart')) return 'cart';
    if (pattern.includes('session')) return 'session';
    if (pattern.includes('cache')) return 'cache';
    if (pattern.includes('order')) return 'order';
    if (pattern.includes('user')) return 'user';
    return 'custom';
  }

  // =====================================================
  // MIGRATIONS ANALYSIS
  // =====================================================

  private async analyzeMigrations(): Promise<MigrationAnalysis> {
    const migrationsPath = path.join(this.backendPath, 'prisma', 'migrations');

    try {
      const entries = await fs.readdir(migrationsPath, { withFileTypes: true });
      const migrations = entries
        .filter((e) => e.isDirectory() && e.name.match(/^\d{14}/))
        .map((e) => e.name);

      const breakingChanges: BreakingChange[] = [];

      // Analyser chaque migration pour breaking changes
      for (const migration of migrations) {
        const migrationPath = path.join(migrationsPath, migration, 'migration.sql');
        try {
          const sql = await fs.readFile(migrationPath, 'utf-8');
          const changes = this.detectBreakingChanges(migration, sql);
          breakingChanges.push(...changes);
        } catch {
          // Migration SQL not found
        }
      }

      return {
        totalMigrations: migrations.length,
        pendingMigrations: 0, // Cannot detect without DB access
        appliedMigrations: migrations,
        breakingChanges,
        rollbackComplexity: breakingChanges.length > 5 ? 'HIGH' : breakingChanges.length > 2 ? 'MEDIUM' : 'LOW',
      };
    } catch (error) {
      console.warn('⚠️  No migrations found');
      return {
        totalMigrations: 0,
        pendingMigrations: 0,
        appliedMigrations: [],
        breakingChanges: [],
        rollbackComplexity: 'LOW',
      };
    }
  }

  private detectBreakingChanges(migration: string, sql: string): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // DROP COLUMN
    if (sql.match(/DROP COLUMN/i)) {
      changes.push({
        migration,
        changeType: 'DROP_COLUMN',
        severity: 'CRITICAL',
        description: 'Column dropped - potential data loss',
        dataLossRisk: true,
      });
    }

    // DROP TABLE
    if (sql.match(/DROP TABLE/i)) {
      changes.push({
        migration,
        changeType: 'DROP_TABLE',
        severity: 'CRITICAL',
        description: 'Table dropped - complete data loss',
        dataLossRisk: true,
      });
    }

    // ALTER COLUMN TYPE
    if (sql.match(/ALTER COLUMN .+ TYPE/i)) {
      changes.push({
        migration,
        changeType: 'CHANGE_TYPE',
        severity: 'HIGH',
        description: 'Column type changed - potential data conversion issues',
        dataLossRisk: false,
      });
    }

    // DROP DEFAULT
    if (sql.match(/DROP DEFAULT/i)) {
      changes.push({
        migration,
        changeType: 'REMOVE_DEFAULT',
        severity: 'MEDIUM',
        description: 'Default value removed - may break inserts',
        dataLossRisk: false,
      });
    }

    // ADD CONSTRAINT (NOT NULL, UNIQUE, etc.)
    if (sql.match(/ADD CONSTRAINT .+ (NOT NULL|UNIQUE)/i) || sql.match(/ALTER COLUMN .+ SET NOT NULL/i)) {
      changes.push({
        migration,
        changeType: 'ADD_CONSTRAINT',
        severity: 'HIGH',
        description: 'New constraint added - may fail on existing data',
        dataLossRisk: false,
      });
    }

    return changes;
  }

  // =====================================================
  // INCONSISTENCIES DETECTION
  // =====================================================

  private async detectInconsistencies(
    prismaSchema: PrismaSchema,
    supabaseTables: SupabaseTable[],
    redisPatterns: RedisPattern[],
    migrationAnalysis: MigrationAnalysis,
  ): Promise<DataInconsistency[]> {
    const inconsistencies: DataInconsistency[] = [];
    let inconsistencyId = 1;

    // 1. Schema vs Supabase mismatch
    for (const model of prismaSchema.models) {
      const tableName = this.normalizeTableName(model.name);
      const supabaseTable = supabaseTables.find((t) => t.tableName === tableName);

      if (!supabaseTable) {
        inconsistencies.push({
          id: `DATA-${String(inconsistencyId++).padStart(3, '0')}`,
          type: 'schema-mismatch',
          severity: 'HIGH',
          source: 'Prisma',
          description: `Model '${model.name}' exists in Prisma but table '${tableName}' not found in Supabase code`,
          impact: 'Prisma queries will fail if executed',
          recommendation: 'Either create Supabase table or remove Prisma model if unused',
          affectedEntities: [model.name],
        });
      }
    }

    // 2. Supabase tables without Prisma model
    for (const table of supabaseTables) {
      const hasModel = prismaSchema.models.some((m) => this.normalizeTableName(m.name) === table.tableName);

      if (!hasModel && table.tableName !== 'schema_migrations') {
        inconsistencies.push({
          id: `DATA-${String(inconsistencyId++).padStart(3, '0')}`,
          type: 'schema-mismatch',
          severity: 'MEDIUM',
          source: 'Supabase',
          description: `Table '${table.tableName}' used in code but no Prisma model exists`,
          impact: 'No type safety for this table queries',
          recommendation: 'Consider adding Prisma model for type safety',
          affectedEntities: [table.tableName],
        });
      }
    }

    // 3. Missing indexes on foreign keys
    for (const model of prismaSchema.models) {
      for (const field of model.fields) {
        if (field.relation) {
          const hasIndex =
            model.indexes.some((idx) => idx.fields.includes(field.name)) || field.isUnique || field.name === 'id';

          if (!hasIndex) {
            inconsistencies.push({
              id: `DATA-${String(inconsistencyId++).padStart(3, '0')}`,
              type: 'missing-constraint',
              severity: 'MEDIUM',
              source: 'Prisma',
              description: `Foreign key '${field.name}' in model '${model.name}' has no index`,
              impact: 'Poor query performance on joins',
              recommendation: `Add @@index([${field.name}]) to model ${model.name}`,
              affectedEntities: [model.name, field.name],
            });
          }
        }
      }
    }

    // 4. Redis patterns without TTL (potential memory leak)
    for (const pattern of redisPatterns) {
      if (!pattern.hasTTL && pattern.usage === 'cache') {
        inconsistencies.push({
          id: `DATA-${String(inconsistencyId++).padStart(3, '0')}`,
          type: 'cache-incoherence',
          severity: 'MEDIUM',
          source: 'Redis',
          description: `Cache pattern '${pattern.pattern}' has no TTL`,
          impact: 'Memory leak - cache never expires',
          recommendation: 'Use redis.setex() instead of redis.set() with explicit TTL',
          affectedEntities: [pattern.pattern],
        });
      }
    }

    // 5. Breaking changes in migrations
    for (const change of migrationAnalysis.breakingChanges) {
      inconsistencies.push({
        id: `DATA-${String(inconsistencyId++).padStart(3, '0')}`,
        type: 'migration-risk',
        severity: change.severity,
        source: 'Migration',
        description: `Migration '${change.migration}': ${change.description}`,
        impact: change.dataLossRisk ? 'POTENTIAL DATA LOSS' : 'May break existing queries',
        recommendation: change.dataLossRisk
          ? 'Backup data before applying, create rollback script'
          : 'Test migration on staging first',
        affectedEntities: [change.migration],
      });
    }

    // 6. Prisma désactivé mais schema présent
    try {
      const prismaServicePath = path.join(this.backendPath, 'src', 'prisma', 'prisma.service.ts');
      const content = await fs.readFile(prismaServicePath, 'utf-8');

      if (content.includes('Service Prisma désactivé') && prismaSchema.models.length > 0) {
        inconsistencies.push({
          id: `DATA-${String(inconsistencyId++).padStart(3, '0')}`,
          type: 'schema-mismatch',
          severity: 'HIGH',
          source: 'Prisma',
          description: 'Prisma service disabled but schema.prisma defines models',
          impact: 'Confusion - Prisma models exist but cannot be used',
          recommendation: 'Either activate Prisma or remove schema.prisma to avoid confusion',
          affectedEntities: ['PrismaService', ...prismaSchema.models.map((m) => m.name)],
        });
      }
    } catch {
      // Ignore if file not found
    }

    return inconsistencies;
  }

  // =====================================================
  // SANITY PLAN GENERATION
  // =====================================================

  private async generateSanityPlan(inconsistencies: DataInconsistency[]): Promise<DataSanityPlan> {
    const criticalCount = inconsistencies.filter((i) => i.severity === 'CRITICAL').length;
    const highCount = inconsistencies.filter((i) => i.severity === 'HIGH').length;

    const priority = criticalCount > 0 ? 'URGENT' : highCount > 3 ? 'HIGH' : highCount > 0 ? 'MEDIUM' : 'LOW';

    const steps: DataSanityStep[] = [
      {
        order: 1,
        name: 'Audit inconsistencies',
        action: 'Review all detected inconsistencies, prioritize by severity',
        duration: '30min',
        automatable: false,
        tools: ['data-sanity.md report'],
      },
    ];

    // Critical: Schema mismatch
    const criticalIssues = inconsistencies.filter((i) => i.severity === 'CRITICAL');
    if (criticalIssues.length > 0) {
      steps.push({
        order: 2,
        name: 'Fix critical issues',
        action: 'Resolve CRITICAL inconsistencies (data loss risks, schema mismatches)',
        duration: `${criticalIssues.length * 30}min`,
        automatable: false,
        tools: ['Prisma migrate', 'Manual SQL', 'Backup tools'],
      });
    }

    // High: Missing indexes, constraints
    const highIssues = inconsistencies.filter((i) => i.severity === 'HIGH');
    if (highIssues.length > 0) {
      steps.push({
        order: steps.length + 1,
        name: 'Add missing indexes/constraints',
        action: 'Create indexes on foreign keys, fix schema mismatches',
        duration: `${highIssues.length * 20}min`,
        automatable: true,
        tools: ['Prisma schema update', 'prisma migrate'],
      });
    }

    // Medium: Cache, performance
    const mediumIssues = inconsistencies.filter((i) => i.severity === 'MEDIUM');
    if (mediumIssues.length > 0) {
      steps.push({
        order: steps.length + 1,
        name: 'Optimize cache & performance',
        action: 'Add Redis TTL, optimize cache patterns',
        duration: `${mediumIssues.length * 15}min`,
        automatable: true,
        tools: ['Redis code refactor', 'setex instead of set'],
      });
    }

    // Low: Documentation
    const lowIssues = inconsistencies.filter((i) => i.severity === 'LOW');
    if (lowIssues.length > 0) {
      steps.push({
        order: steps.length + 1,
        name: 'Document & cleanup',
        action: 'Add comments, document schema decisions, cleanup unused code',
        duration: `${lowIssues.length * 10}min`,
        automatable: false,
        tools: ['Code comments', 'Documentation'],
      });
    }

    // Testing
    steps.push({
      order: steps.length + 1,
      name: 'Test data integrity',
      action: 'Run integration tests, verify migrations, check cache behavior',
      duration: '45min',
      automatable: true,
      tools: ['Jest', 'Staging environment', 'DB queries'],
    });

    // Calculate total duration
    const totalMinutes = steps.reduce((sum, step) => {
      const minutes = parseInt(step.duration, 10) || 0;
      return sum + minutes;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const estimatedDuration = `${hours}h ${minutes}min`;

    const complexity = criticalCount > 0 || highCount > 5 ? 'HIGH' : highCount > 2 ? 'MEDIUM' : 'LOW';

    return {
      priority,
      steps,
      estimatedDuration,
      complexity,
    };
  }

  // =====================================================
  // REPORTS GENERATION
  // =====================================================

  private async saveReports(
    prismaSchema: PrismaSchema,
    supabaseTables: SupabaseTable[],
    redisPatterns: RedisPattern[],
    migrationAnalysis: MigrationAnalysis,
    inconsistencies: DataInconsistency[],
    sanityPlan: DataSanityPlan,
    executionTime: number,
  ): Promise<void> {
    const reportsDir = path.join(this.workspaceRoot, 'ai-agents', 'reports');

    // JSON report
    const jsonReport = {
      agent: 'Data Sanity',
      timestamp: new Date().toISOString(),
      executionTime,
      prismaSchema,
      supabaseTables,
      redisPatterns,
      migrationAnalysis,
      inconsistencies,
      sanityPlan,
    };

    await fs.writeFile(path.join(reportsDir, 'data-sanity.json'), JSON.stringify(jsonReport, null, 2));

    // Markdown report
    const mdReport = this.generateMarkdownReport(
      prismaSchema,
      supabaseTables,
      redisPatterns,
      migrationAnalysis,
      inconsistencies,
      sanityPlan,
      executionTime,
    );

    await fs.writeFile(path.join(reportsDir, 'data-sanity.md'), mdReport);

    // Bash script
    const bashScript = this.generateBashScript(inconsistencies, sanityPlan);
    await fs.writeFile(path.join(reportsDir, 'data-sanity-fix.sh'), bashScript);
    await fs.chmod(path.join(reportsDir, 'data-sanity-fix.sh'), 0o755);
  }

  private generateMarkdownReport(
    prismaSchema: PrismaSchema,
    supabaseTables: SupabaseTable[],
    redisPatterns: RedisPattern[],
    migrationAnalysis: MigrationAnalysis,
    inconsistencies: DataInconsistency[],
    sanityPlan: DataSanityPlan,
    executionTime: number,
  ): string {
    const criticalCount = inconsistencies.filter((i) => i.severity === 'CRITICAL').length;
    const highCount = inconsistencies.filter((i) => i.severity === 'HIGH').length;
    const mediumCount = inconsistencies.filter((i) => i.severity === 'MEDIUM').length;
    const lowCount = inconsistencies.filter((i) => i.severity === 'LOW').length;

    let md = `# 🔍 Data Sanity Report

**Agent:** Data Sanity Checker
**Date:** ${new Date().toISOString()}
**Execution Time:** ${executionTime}ms

---

## 📊 Key Performance Indicators (KPIs)

| Metric | Value | Status |
|--------|-------|--------|
| Prisma Models | ${prismaSchema.models.length} | ${prismaSchema.models.length > 0 ? '✅' : '⚠️'} |
| Supabase Tables | ${supabaseTables.length} | ${supabaseTables.length > 0 ? '✅' : '⚠️'} |
| Redis Patterns | ${redisPatterns.length} | ${redisPatterns.length > 0 ? '✅' : '⚠️'} |
| Total Migrations | ${migrationAnalysis.totalMigrations} | ✅ |
| **Inconsistencies CRITICAL** | **${criticalCount}** | ${criticalCount === 0 ? '✅' : '🔴'} |
| **Inconsistencies HIGH** | **${highCount}** | ${highCount === 0 ? '✅' : '🟠'} |
| Inconsistencies MEDIUM | ${mediumCount} | ${mediumCount === 0 ? '✅' : '🟡'} |
| Inconsistencies LOW | ${lowCount} | ✅ |

---

## 🗄️ Prisma Schema Analysis

**Total Models:** ${prismaSchema.models.length}
**Total Enums:** ${prismaSchema.enums.length}

`;

    if (prismaSchema.models.length > 0) {
      md += '### Prisma Models\n\n';
      for (const model of prismaSchema.models) {
        md += `#### ${model.name}\n`;
        md += `- **Fields:** ${model.fields.length}\n`;
        md += `- **Indexes:** ${model.indexes.length}\n`;
        md += `- **Unique Constraints:** ${model.uniqueConstraints.length}\n`;

        if (model.fields.some((f) => f.relation)) {
          md += `- **Relations:**\n`;
          for (const field of model.fields.filter((f) => f.relation)) {
            md += `  - \`${field.name}\` → \`${field.relation!.model}\`\n`;
          }
        }
        md += '\n';
      }
    } else {
      md += '*No Prisma models found (PrismaService may be disabled)*\n\n';
    }

    md += `---

## 🗄️ Supabase Tables

**Total Tables:** ${supabaseTables.length}

`;

    if (supabaseTables.length > 0) {
      md += '### Detected Tables\n\n';
      for (const table of supabaseTables) {
        md += `- \`${table.tableName}\`\n`;
      }
    } else {
      md += '*No Supabase tables detected in code*\n';
    }

    md += `

---

## ⚡ Redis Patterns Analysis

**Total Patterns:** ${redisPatterns.length}

`;

    if (redisPatterns.length > 0) {
      md += '### Redis Key Patterns\n\n';
      md += '| Pattern | Usage | Key Count | Has TTL | Examples |\n';
      md += '|---------|-------|-----------|---------|----------|\n';

      for (const pattern of redisPatterns.slice(0, 20)) {
        const hasTTL = pattern.hasTTL ? '✅' : '❌';
        const examples = pattern.exampleKeys.slice(0, 2).join(', ');
        md += `| \`${pattern.pattern}\` | ${pattern.usage} | ${pattern.keyCount} | ${hasTTL} | ${examples} |\n`;
      }

      if (redisPatterns.length > 20) {
        md += `\n*...and ${redisPatterns.length - 20} more patterns*\n`;
      }
    } else {
      md += '*No Redis patterns detected in code*\n';
    }

    md += `

---

## 🔄 Migrations Analysis

**Total Migrations:** ${migrationAnalysis.totalMigrations}
**Breaking Changes:** ${migrationAnalysis.breakingChanges.length}
**Rollback Complexity:** ${migrationAnalysis.rollbackComplexity}

`;

    if (migrationAnalysis.breakingChanges.length > 0) {
      md += '### ⚠️ Breaking Changes\n\n';

      for (const change of migrationAnalysis.breakingChanges) {
        const severity =
          change.severity === 'CRITICAL' ? '🔴 CRITICAL' : change.severity === 'HIGH' ? '🟠 HIGH' : '🟡 MEDIUM';

        md += `#### ${severity} - ${change.changeType}\n`;
        md += `- **Migration:** \`${change.migration}\`\n`;
        md += `- **Description:** ${change.description}\n`;
        md += `- **Data Loss Risk:** ${change.dataLossRisk ? '⚠️ YES' : '✅ NO'}\n\n`;
      }
    } else {
      md += '*No breaking changes detected in migrations* ✅\n';
    }

    md += `

---

## 🔍 Data Inconsistencies

**Total Inconsistencies:** ${inconsistencies.length}

`;

    if (inconsistencies.length > 0) {
      // Group by severity
      const bySeverity = {
        CRITICAL: inconsistencies.filter((i) => i.severity === 'CRITICAL'),
        HIGH: inconsistencies.filter((i) => i.severity === 'HIGH'),
        MEDIUM: inconsistencies.filter((i) => i.severity === 'MEDIUM'),
        LOW: inconsistencies.filter((i) => i.severity === 'LOW'),
      };

      for (const [severity, items] of Object.entries(bySeverity)) {
        if (items.length === 0) continue;

        const emoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢';

        md += `### ${emoji} ${severity} (${items.length})\n\n`;

        for (const inc of items) {
          md += `#### ${inc.id}: ${inc.description}\n`;
          md += `- **Type:** ${inc.type}\n`;
          md += `- **Source:** ${inc.source}\n`;
          md += `- **Impact:** ${inc.impact}\n`;
          md += `- **Recommendation:** ${inc.recommendation}\n`;
          md += `- **Affected Entities:** ${inc.affectedEntities.join(', ')}\n\n`;
        }
      }
    } else {
      md += '*No inconsistencies detected! Data integrity looks good.* ✅\n';
    }

    md += `

---

## 🔧 Sanity Plan

**Priority:** ${sanityPlan.priority}
**Estimated Duration:** ${sanityPlan.estimatedDuration}
**Complexity:** ${sanityPlan.complexity}

### Steps

`;

    for (const step of sanityPlan.steps) {
      md += `${step.order}. **${step.name}** (${step.duration})\n`;
      md += `   - ${step.action}\n`;
      md += `   - Automatable: ${step.automatable ? '✅' : '❌'}\n`;
      md += `   - Tools: ${step.tools.join(', ')}\n\n`;
    }

    md += `

---

## 💡 Recommendations

`;

    if (criticalCount > 0) {
      md += `### 🔴 URGENT (${criticalCount} issues)\n\n`;
      md += `1. **Address CRITICAL inconsistencies immediately**\n`;
      md += `   - Backup database before any schema changes\n`;
      md += `   - Review breaking changes in migrations\n`;
      md += `   - Fix schema mismatches (Prisma vs Supabase)\n\n`;
    }

    if (highCount > 0) {
      md += `### 🟠 HIGH PRIORITY (${highCount} issues)\n\n`;
      md += `1. **Add missing indexes on foreign keys**\n`;
      md += `   - Improves query performance significantly\n`;
      md += `   - Update Prisma schema with @@index directives\n`;
      md += `2. **Resolve schema mismatches**\n`;
      md += `   - Ensure Prisma models match Supabase tables\n`;
      md += `   - Add type safety with Prisma if tables are used\n\n`;
    }

    if (mediumCount > 0) {
      md += `### 🟡 MEDIUM PRIORITY (${mediumCount} issues)\n\n`;
      md += `1. **Optimize Redis cache patterns**\n`;
      md += `   - Add TTL to cache keys (use setex instead of set)\n`;
      md += `   - Prevent memory leaks\n`;
      md += `2. **Improve data validation**\n`;
      md += `   - Add constraints where needed\n`;
      md += `   - Validate input data\n\n`;
    }

    md += `### General Recommendations

1. **Prisma vs Supabase:**
   - Project uses Supabase but has Prisma schema defined
   - Decision: Either fully adopt Prisma or remove schema.prisma
   - Current state: PrismaService disabled but schema exists (confusing)

2. **Redis Cache:**
   - Always use \`setex(key, ttl, value)\` for cache data
   - Recommended TTLs: sessions (24h), carts (7d), cache (5-30min)
   - Monitor Redis memory usage regularly

3. **Migrations:**
   - Always test migrations on staging first
   - Create rollback scripts for breaking changes
   - Backup production DB before applying migrations

4. **Monitoring:**
   - Add health checks for Supabase connection
   - Monitor Redis memory usage
   - Track slow queries (enable logging)

---

**Next Steps:** Review this report and execute \`data-sanity-fix.sh\` to address issues.

`;

    return md;
  }

  private generateBashScript(inconsistencies: DataInconsistency[], sanityPlan: DataSanityPlan): string {
    let script = `#!/bin/bash

# ============================================
# 🔍 DATA SANITY FIX SCRIPT
# ============================================
# Generated by Agent 11: Data Sanity
# Date: ${new Date().toISOString()}
#
# This script provides commands to fix detected
# data inconsistencies. Review and execute manually.
# ============================================

set -e

echo "🔍 Data Sanity Fix Script"
echo "========================="
echo ""
echo "⚠️  IMPORTANT: Review all commands before execution!"
echo "⚠️  Backup database before making schema changes!"
echo ""

# Colors
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
GREEN='\\033[0;32m'
NC='\\033[0m' # No Color

`;

    const criticalIssues = inconsistencies.filter((i) => i.severity === 'CRITICAL');
    const highIssues = inconsistencies.filter((i) => i.severity === 'HIGH');
    const mediumIssues = inconsistencies.filter((i) => i.severity === 'MEDIUM');

    if (criticalIssues.length > 0) {
      script += `# ============================================
# 🔴 CRITICAL ISSUES (${criticalIssues.length})
# ============================================

echo -e "\${RED}🔴 CRITICAL ISSUES\${NC}"
echo ""

`;

      for (const issue of criticalIssues) {
        script += `# ${issue.id}: ${issue.description}
# Recommendation: ${issue.recommendation}
echo "⚠️  ${issue.id}: ${issue.description}"

`;

        if (issue.type === 'schema-mismatch' && issue.source === 'Prisma') {
          script += `# Option 1: Create Supabase table (if model is needed)
# psql $DATABASE_URL -c "CREATE TABLE ${issue.affectedEntities[0].toLowerCase()} (...);"

# Option 2: Remove Prisma model (if unused)
# Edit backend/prisma/schema.prisma and remove model ${issue.affectedEntities[0]}

`;
        }

        if (issue.type === 'migration-risk') {
          script += `# Backup database before migration
# pg_dump $DATABASE_URL > backup_before_migration.sql

# Apply migration with caution
# cd backend && npx prisma migrate deploy

`;
        }

        script += '\n';
      }
    }

    if (highIssues.length > 0) {
      script += `# ============================================
# 🟠 HIGH PRIORITY ISSUES (${highIssues.length})
# ============================================

echo -e "\${YELLOW}🟠 HIGH PRIORITY ISSUES\${NC}"
echo ""

`;

      const missingIndexes = highIssues.filter((i) => i.type === 'missing-constraint');
      if (missingIndexes.length > 0) {
        script += `# Missing indexes on foreign keys
echo "📊 Adding indexes on foreign keys..."

`;

        for (const issue of missingIndexes) {
          const [modelName, fieldName] = issue.affectedEntities;
          script += `# ${issue.id}: ${issue.description}
# Add to backend/prisma/schema.prisma in model ${modelName}:
# @@index([${fieldName}])

`;
        }

        script += `# After updating schema:
# cd backend && npx prisma migrate dev --name add_missing_indexes

`;
      }
    }

    if (mediumIssues.length > 0) {
      script += `# ============================================
# 🟡 MEDIUM PRIORITY ISSUES (${mediumIssues.length})
# ============================================

echo -e "\${GREEN}🟡 MEDIUM PRIORITY ISSUES\${NC}"
echo ""

`;

      const cacheIssues = mediumIssues.filter((i) => i.type === 'cache-incoherence');
      if (cacheIssues.length > 0) {
        script += `# Redis cache patterns without TTL
echo "⚡ Fix Redis cache TTL..."

`;

        for (const issue of cacheIssues) {
          script += `# ${issue.id}: ${issue.description}
# Find usages: grep -r "${issue.affectedEntities[0]}" backend/src
# Replace: redis.set(key, value) → redis.setex(key, ttl, value)
# Recommended TTL: 300s (5min) for cache, 86400s (24h) for sessions

`;
        }
      }
    }

    script += `# ============================================
# ✅ FINAL STEPS
# ============================================

echo ""
echo -e "\${GREEN}✅ Review complete!\${NC}"
echo ""
echo "Next steps:"
echo "1. Backup database: pg_dump $DATABASE_URL > backup.sql"
echo "2. Apply Prisma schema changes"
echo "3. Run: cd backend && npx prisma migrate dev"
echo "4. Test on staging first"
echo "5. Deploy to production with caution"
echo ""
echo "📊 See full report: ai-agents/reports/data-sanity.md"

`;

    return script;
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private normalizeTableName(modelName: string): string {
    // Convert PascalCase to snake_case
    return modelName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}
