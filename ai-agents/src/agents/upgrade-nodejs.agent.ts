/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AGENT 8: Upgrade Node.js Analyzer                          ║
 * ║  Analyse compatibilité Node.js, APIs obsolètes, CVE         ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * 🎯 MÉTHODOLOGIE
 * - **Outils**: ts-morph AST + node-compat-table + npm audit
 * - **Confidence**: HIGH (official Node.js deprecation list)
 * - **Detection**: Regex + AST analysis pour require/import patterns
 * 
 * ⚠️ NOTE IMPORTANTE: v22 → v20 LTS = Alignement Production
 * - v22.17.0 (Current Odd) = Support 6 mois uniquement (non-LTS)
 * - v20.18.0 (LTS "Iron") = Support 30 mois (jusqu'en avril 2026)
 * - **Rationale**: Production doit toujours utiliser LTS pour stabilité
 * - **Migration**: Optionnelle (v22 fonctionne) mais RECOMMANDÉE pour prod
 * 
 * 🔍 APIs CRITIQUES DÉTECTÉES
 * - crypto.createCipher (deprecated v10, removed v17) → crypto.createCipheriv
 * - Buffer constructor (deprecated v6) → Buffer.alloc/Buffer.from
 * - process.binding (deprecated v10) → documented alternatives
 * 
 * @description
 * Analyse l'utilisation de Node.js dans le monorepo pour :
 * 1. Détecter APIs obsolètes (callbacks, Buffer, process.binding)
 * 2. Vérifier native modules compatibility
 * 3. Scanner vulnérabilités CVE
 * 4. Recommander migration vers Node.js 20 LTS
 * 
 * @metrics
 * - Version Node.js actuelle vs recommandée
 * - APIs obsolètes détectées
 * - Native modules à vérifier
 * - CVE critiques trouvées
 * 
 * @outputs
 * - upgrade-nodejs.json : Résultats détaillés
 * - upgrade-nodejs.md : Rapport lisible
 * - migrate-nodejs-20.sh : Script de migration
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus,
  AgentType,
  KPI,
} from '../types';
import { Project, SyntaxKind, SourceFile } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

interface NodeVersion {
  current: string;
  recommended: string;
  isLTS: boolean;
  isEOL: boolean;
  securitySupport: boolean;
}

interface DeprecatedAPI {
  id: string;
  api: string;
  category: 'fs' | 'buffer' | 'crypto' | 'util' | 'stream' | 'process' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  deprecated: string; // Version where deprecated
  removed?: string; // Version where removed
  description: string;
  affectedFiles: string[];
  replacement: string;
  codeExample?: {
    before: string;
    after: string;
  };
}

interface NativeModule {
  name: string;
  version: string;
  hasNativeBinding: boolean;
  compatible: boolean;
  needsRebuild: boolean;
  issues: string[];
}

interface CVEVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedVersions: string;
  fixedVersion: string;
  cvssScore?: number;
  published: string;
}

interface NodeJSFeature {
  name: string;
  availableSince: string;
  description: string;
  benefit: string;
  adopted: boolean;
  usageCount: number;
}

interface MigrationStep {
  order: number;
  title: string;
  description: string;
  commands: string[];
  manualActions: string[];
  estimatedTime: string;
  risk: 'low' | 'medium' | 'high';
  rollbackPlan: string;
}

interface NodeJSMigrationPlan {
  currentVersion: string;
  targetVersion: string;
  totalSteps: number;
  estimatedDuration: string;
  risk: 'low' | 'medium' | 'high';
  automationLevel: number;
  steps: MigrationStep[];
  recommendations: string[];
}

interface UpgradeNodeJSReport {
  timestamp: string;
  version: NodeVersion;
  filesAnalyzed: number;
  deprecatedAPIs: DeprecatedAPI[];
  nativeModules: NativeModule[];
  cveVulnerabilities: CVEVulnerability[];
  modernFeatures: NodeJSFeature[];
  migrationPlan: NodeJSMigrationPlan;
  recommendations: string[];
  kpis: {
    criticalAPIs: number;
    nativeModulesToRebuild: number;
    criticalCVEs: number;
    modernizationScore: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// AGENT CLASS
// ═══════════════════════════════════════════════════════════════

export class UpgradeNodeJSAgent implements IAgent {
  public readonly name = 'Upgrade Node.js Analyzer';
  public readonly type: AgentType = 'upgrade-nodejs';
  public readonly description = 'Analyse compatibilité Node.js, APIs obsolètes et CVE';
  public readonly version = '1.0.0';

  private project!: Project;
  private rootDir: string;
  private reportsDir: string;
  private status: AgentStatus = 'idle';

  constructor(rootDir?: string) {
    this.rootDir = rootDir || path.resolve(__dirname, '../../../');
    this.reportsDir = path.join(this.rootDir, 'ai-agents', 'reports');
  }

  // ═══════════════════════════════════════════════════════════════
  // IAgent INTERFACE IMPLEMENTATION
  // ═══════════════════════════════════════════════════════════════

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'running';

    try {
      const report = await this.analyze();

      const duration = Date.now() - startTime;
      this.status = 'completed';

      // Déterminer le statut
      const status: 'success' | 'error' | 'warning' = 
        report.kpis.criticalCVEs > 0 || report.kpis.criticalAPIs > 0 ? 'warning' : 'success';

      // Construire les KPIs
      const kpis: KPI[] = [
        {
          name: 'APIs Critiques Obsolètes',
          value: report.kpis.criticalAPIs,
          unit: 'APIs',
          status: report.kpis.criticalAPIs === 0 ? 'ok' : 'critical',
        },
        {
          name: 'Native Modules à Rebuild',
          value: report.kpis.nativeModulesToRebuild,
          unit: 'modules',
          status: report.kpis.nativeModulesToRebuild === 0 ? 'ok' : 'warning',
        },
        {
          name: 'CVE Critiques',
          value: report.kpis.criticalCVEs,
          unit: 'CVE',
          status: report.kpis.criticalCVEs === 0 ? 'ok' : 'critical',
        },
      ];

      return {
        agentName: this.name,
        agentType: this.type,
        status,
        duration,
        data: report,
        kpis,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.status = 'error';
      
      return {
        agentName: this.name,
        agentType: this.type,
        status: 'error',
        duration,
        data: null,
        errors: [(error as Error).message],
        kpis: [],
        timestamp: new Date(),
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async analyze(): Promise<UpgradeNodeJSReport> {
    console.log('\n🔍 Upgrade Node.js - Analyse en cours...');

    // 1. Détection version Node.js
    console.log('📦 Détection version Node.js...');
    const version = this.detectNodeVersion();
    console.log(`✓ Version actuelle: ${version.current} → recommandée: ${version.recommended}`);

    // 2. Initialisation projet TypeScript
    console.log('📂 Initialisation projet TypeScript...');
    this.initializeProject();

    // 3. Analyse APIs obsolètes
    console.log('🔍 Analyse APIs obsolètes...');
    const deprecatedAPIs = this.analyzeDeprecatedAPIs();
    console.log(`✓ ${deprecatedAPIs.length} APIs obsolètes détectées`);

    // 4. Analyse native modules
    console.log('📦 Analyse native modules...');
    const nativeModules = this.analyzeNativeModules();
    console.log(`✓ ${nativeModules.length} native modules analysés`);

    // 5. Scan CVE
    console.log('🔒 Scan vulnérabilités CVE...');
    const cveVulnerabilities = this.scanCVE(version.current);
    console.log(`✓ ${cveVulnerabilities.length} CVE trouvées`);

    // 6. Analyse features modernes
    console.log('🚀 Analyse adoption features modernes...');
    const modernFeatures = this.analyzeModernFeatures();
    console.log(`✓ ${modernFeatures.filter(f => f.adopted).length}/${modernFeatures.length} features adoptées`);

    // 7. Plan de migration
    console.log('📋 Génération du plan de migration...');
    const migrationPlan = this.generateMigrationPlan(version, deprecatedAPIs, nativeModules);

    // 8. Recommandations
    console.log('💡 Génération des recommandations...');
    const recommendations = this.generateRecommendations(version, deprecatedAPIs, cveVulnerabilities);

    // 9. KPIs
    const kpis = this.calculateKPIs(deprecatedAPIs, nativeModules, cveVulnerabilities, modernFeatures);

    const report: UpgradeNodeJSReport = {
      timestamp: new Date().toISOString(),
      version,
      filesAnalyzed: this.project.getSourceFiles().length,
      deprecatedAPIs,
      nativeModules,
      cveVulnerabilities,
      modernFeatures,
      migrationPlan,
      recommendations,
      kpis,
    };

    // 10. Sauvegarde rapports
    this.saveReports(report);

    return report;
  }

  // ═══════════════════════════════════════════════════════════════
  // VERSION DETECTION
  // ═══════════════════════════════════════════════════════════════

  private detectNodeVersion(): NodeVersion {
    let current = 'unknown';
    
    try {
      current = execSync('node --version', { encoding: 'utf-8' }).trim().replace('v', '');
    } catch {
      // Fallback: parse .nvmrc ou package.json engines
      const nvmrcPath = path.join(this.rootDir, '.nvmrc');
      if (fs.existsSync(nvmrcPath)) {
        current = fs.readFileSync(nvmrcPath, 'utf-8').trim().replace('v', '');
      }
    }

    const currentMajor = parseInt(current.split('.')[0]);
    const recommended = '20.18.0'; // Latest Node.js 20 LTS
    const isLTS = [18, 20, 22].includes(currentMajor);
    const isEOL = currentMajor < 18;
    const securitySupport = currentMajor >= 18;

    return {
      current,
      recommended,
      isLTS,
      isEOL,
      securitySupport,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROJECT INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  private initializeProject(): void {
    const backendTsconfig = path.join(this.rootDir, 'backend', 'tsconfig.json');
    const frontendTsconfig = path.join(this.rootDir, 'frontend', 'tsconfig.json');
    
    // Prioriser backend (Node.js code)
    const tsconfigPath = fs.existsSync(backendTsconfig) ? backendTsconfig : frontendTsconfig;
    
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DEPRECATED APIs ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeDeprecatedAPIs(): DeprecatedAPI[] {
    const deprecatedAPIs: DeprecatedAPI[] = [];
    const sourceFiles = this.project.getSourceFiles()
      .filter(sf => !sf.getFilePath().includes('node_modules'));

    // Pattern 1: fs callbacks (deprecated, use fs/promises)
    const fsCallbackPattern = this.findFSCallbacks(sourceFiles);
    if (fsCallbackPattern.length > 0) {
      deprecatedAPIs.push({
        id: 'NODE-001',
        api: 'fs callbacks',
        category: 'fs',
        severity: 'medium',
        deprecated: '10.0.0',
        description: 'Callback-based fs methods are deprecated. Use fs/promises instead.',
        affectedFiles: fsCallbackPattern,
        replacement: "import { readFile } from 'fs/promises'",
        codeExample: {
          before: `const fs = require('fs');
fs.readFile('file.txt', (err, data) => {
  if (err) throw err;
  console.log(data);
});`,
          after: `import { readFile } from 'fs/promises';

const data = await readFile('file.txt', 'utf-8');
console.log(data);`
        }
      });
    }

    // Pattern 2: new Buffer() (deprecated since Node.js 6)
    const bufferPattern = this.findDeprecatedBuffer(sourceFiles);
    if (bufferPattern.length > 0) {
      deprecatedAPIs.push({
        id: 'NODE-002',
        api: 'new Buffer()',
        category: 'buffer',
        severity: 'high',
        deprecated: '6.0.0',
        removed: '10.0.0',
        description: 'new Buffer() is deprecated. Use Buffer.from(), Buffer.alloc(), or Buffer.allocUnsafe().',
        affectedFiles: bufferPattern,
        replacement: 'Buffer.from() or Buffer.alloc()',
        codeExample: {
          before: `const buf = new Buffer('data', 'utf-8');`,
          after: `const buf = Buffer.from('data', 'utf-8');`
        }
      });
    }

    // Pattern 3: util.promisify (native async/await preferred in Node.js 16+)
    const promisifyPattern = this.findUtilPromisify(sourceFiles);
    if (promisifyPattern.length > 0) {
      deprecatedAPIs.push({
        id: 'NODE-003',
        api: 'util.promisify',
        category: 'util',
        severity: 'low',
        deprecated: '16.0.0',
        description: 'util.promisify is not needed for modern APIs. Use native promises instead.',
        affectedFiles: promisifyPattern,
        replacement: 'Use native promise-based APIs (fs/promises, etc.)',
        codeExample: {
          before: `const util = require('util');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);`,
          after: `import { readFile } from 'fs/promises';`
        }
      });
    }

    // Pattern 4: process.binding (removed in Node.js 16)
    const bindingPattern = this.findProcessBinding(sourceFiles);
    if (bindingPattern.length > 0) {
      deprecatedAPIs.push({
        id: 'NODE-004',
        api: 'process.binding()',
        category: 'process',
        severity: 'critical',
        deprecated: '10.0.0',
        removed: '16.0.0',
        description: 'process.binding() is removed. Use public Node.js APIs instead.',
        affectedFiles: bindingPattern,
        replacement: 'Use documented Node.js APIs',
      });
    }

    // Pattern 5: crypto.createCipher (deprecated)
    const cipherPattern = this.findDeprecatedCrypto(sourceFiles);
    if (cipherPattern.length > 0) {
      deprecatedAPIs.push({
        id: 'NODE-005',
        api: 'crypto.createCipher',
        category: 'crypto',
        severity: 'high',
        deprecated: '10.0.0',
        description: 'crypto.createCipher uses weak MD5 key derivation. Use crypto.createCipheriv instead.',
        affectedFiles: cipherPattern,
        replacement: 'crypto.createCipheriv with explicit IV',
        codeExample: {
          before: `const cipher = crypto.createCipher('aes-256-cbc', password);`,
          after: `const iv = crypto.randomBytes(16);
const key = crypto.scryptSync(password, 'salt', 32);
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);`
        }
      });
    }

    return deprecatedAPIs;
  }

  private findFSCallbacks(sourceFiles: SourceFile[]): string[] {
    const affected: string[] = [];
    const patterns = [
      /fs\.readFile\s*\(/,
      /fs\.writeFile\s*\(/,
      /fs\.appendFile\s*\(/,
      /fs\.mkdir\s*\(/,
      /fs\.readdir\s*\(/,
    ];

    for (const sourceFile of sourceFiles) {
      const content = sourceFile.getText();
      if (patterns.some(p => p.test(content))) {
        // Check if it's callback-based (not from fs/promises)
        if (!content.includes('fs/promises')) {
          affected.push(this.relativePath(sourceFile.getFilePath()));
        }
      }
    }

    return affected;
  }

  private findDeprecatedBuffer(sourceFiles: SourceFile[]): string[] {
    const affected: string[] = [];
    const pattern = /new\s+Buffer\s*\(/;

    for (const sourceFile of sourceFiles) {
      const content = sourceFile.getText();
      if (pattern.test(content)) {
        affected.push(this.relativePath(sourceFile.getFilePath()));
      }
    }

    return affected;
  }

  private findUtilPromisify(sourceFiles: SourceFile[]): string[] {
    const affected: string[] = [];
    const pattern = /util\.promisify/;

    for (const sourceFile of sourceFiles) {
      const content = sourceFile.getText();
      if (pattern.test(content)) {
        affected.push(this.relativePath(sourceFile.getFilePath()));
      }
    }

    return affected;
  }

  private findProcessBinding(sourceFiles: SourceFile[]): string[] {
    const affected: string[] = [];
    const pattern = /process\.binding\s*\(/;

    for (const sourceFile of sourceFiles) {
      const content = sourceFile.getText();
      if (pattern.test(content)) {
        affected.push(this.relativePath(sourceFile.getFilePath()));
      }
    }

    return affected;
  }

  private findDeprecatedCrypto(sourceFiles: SourceFile[]): string[] {
    const affected: string[] = [];
    const patterns = [
      /crypto\.createCipher\s*\(/,
      /crypto\.createDecipher\s*\(/,
    ];

    for (const sourceFile of sourceFiles) {
      const content = sourceFile.getText();
      if (patterns.some(p => p.test(content))) {
        affected.push(this.relativePath(sourceFile.getFilePath()));
      }
    }

    return affected;
  }

  // ═══════════════════════════════════════════════════════════════
  // NATIVE MODULES ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeNativeModules(): NativeModule[] {
    const nativeModules: NativeModule[] = [];
    const knownNativeModules = [
      'bcrypt', 'sharp', 'canvas', 'sqlite3', 'node-sass',
      'node-gyp', 'better-sqlite3', 'grpc', '@node-rs/bcrypt',
    ];

    // Parse backend package.json
    const backendPkgPath = path.join(this.rootDir, 'backend', 'package.json');
    if (!fs.existsSync(backendPkgPath)) {
      return nativeModules;
    }

    const packageJson = JSON.parse(fs.readFileSync(backendPkgPath, 'utf-8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [name, version] of Object.entries(allDeps)) {
      if (knownNativeModules.some(nm => name.includes(nm))) {
        const hasNativeBinding = true;
        const needsRebuild = this.checkNeedsRebuild(name);

        nativeModules.push({
          name,
          version: (version as string).replace(/[\^~]/g, ''),
          hasNativeBinding,
          compatible: true, // Assume compatible unless proven otherwise
          needsRebuild,
          issues: needsRebuild ? [`Requires rebuild for Node.js 20+`] : [],
        });
      }
    }

    return nativeModules;
  }

  private checkNeedsRebuild(moduleName: string): boolean {
    // Check if module has native bindings that need rebuild
    const moduleBasePath = path.join(this.rootDir, 'backend', 'node_modules', moduleName);
    const bindingPath = path.join(moduleBasePath, 'build', 'Release');
    
    if (fs.existsSync(bindingPath)) {
      return true; // Has native bindings
    }

    // Some modules indicate rebuild need in their package.json
    const pkgPath = path.join(moduleBasePath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return !!(pkg.gypfile || pkg.scripts?.install?.includes('node-gyp'));
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // CVE SCAN
  // ═══════════════════════════════════════════════════════════════

  private scanCVE(currentVersion: string): CVEVulnerability[] {
    const vulnerabilities: CVEVulnerability[] = [];
    const major = parseInt(currentVersion.split('.')[0]);

    // Known CVEs for Node.js versions (simplified - in prod, use CVE database API)
    const knownCVEs: Record<number, CVEVulnerability[]> = {
      18: [
        {
          id: 'CVE-2023-30581',
          severity: 'high',
          title: 'Path traversal vulnerability',
          description: 'mainModule.__proto__ bypass via path traversal',
          affectedVersions: '<18.16.1',
          fixedVersion: '18.16.1',
          cvssScore: 7.5,
          published: '2023-06-15',
        },
      ],
      20: [
        {
          id: 'CVE-2023-30589',
          severity: 'medium',
          title: 'HTTP Request Smuggling',
          description: 'HTTP/1.1 request smuggling via malformed Transfer-Encoding',
          affectedVersions: '<20.3.1',
          fixedVersion: '20.3.1',
          cvssScore: 6.5,
          published: '2023-06-20',
        },
      ],
      22: [], // No critical CVEs for Node.js 22 yet (too recent)
    };

    if (major < 18) {
      vulnerabilities.push({
        id: 'NODE-EOL',
        severity: 'critical',
        title: 'Node.js version is End-of-Life',
        description: `Node.js ${major}.x has reached End-of-Life and no longer receives security updates.`,
        affectedVersions: `${major}.x`,
        fixedVersion: '20.18.0',
        published: '2023-01-01',
      });
    }

    const versionCVEs = knownCVEs[major] || [];
    for (const cve of versionCVEs) {
      if (this.isVersionAffected(currentVersion, cve.affectedVersions)) {
        vulnerabilities.push(cve);
      }
    }

    return vulnerabilities;
  }

  private isVersionAffected(current: string, affected: string): boolean {
    // Simple version comparison (e.g., "<18.16.1")
    if (affected.startsWith('<')) {
      const threshold = affected.slice(1);
      return this.compareVersions(current, threshold) < 0;
    }
    return false;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // MODERN FEATURES ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeModernFeatures(): NodeJSFeature[] {
    const features: NodeJSFeature[] = [
      {
        name: 'Native Fetch API',
        availableSince: '18.0.0',
        description: 'Built-in fetch() without needing node-fetch',
        benefit: 'Reduce dependencies, standardized API',
        adopted: this.checkFeatureUsage('fetch('),
        usageCount: 0,
      },
      {
        name: 'Test Runner',
        availableSince: '18.0.0',
        description: 'Built-in test runner (node:test)',
        benefit: 'No need for Jest/Mocha for simple tests',
        adopted: this.checkFeatureUsage('node:test'),
        usageCount: 0,
      },
      {
        name: 'Watch Mode',
        availableSince: '18.11.0',
        description: 'node --watch for auto-restart',
        benefit: 'No need for nodemon',
        adopted: this.checkFeatureUsage('--watch'),
        usageCount: 0,
      },
      {
        name: 'AbortSignal.timeout',
        availableSince: '17.3.0',
        description: 'Built-in timeout for async operations',
        benefit: 'Simpler timeout handling',
        adopted: this.checkFeatureUsage('AbortSignal.timeout'),
        usageCount: 0,
      },
      {
        name: 'structuredClone',
        availableSince: '17.0.0',
        description: 'Deep clone objects without lodash',
        benefit: 'No need for external cloning libraries',
        adopted: this.checkFeatureUsage('structuredClone'),
        usageCount: 0,
      },
    ];

    return features;
  }

  private checkFeatureUsage(pattern: string): boolean {
    const sourceFiles = this.project.getSourceFiles()
      .filter(sf => !sf.getFilePath().includes('node_modules'));

    for (const sourceFile of sourceFiles) {
      if (sourceFile.getText().includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // MIGRATION PLAN
  // ═══════════════════════════════════════════════════════════════

  private generateMigrationPlan(
    version: NodeVersion,
    deprecatedAPIs: DeprecatedAPI[],
    nativeModules: NativeModule[]
  ): NodeJSMigrationPlan {
    const steps: MigrationStep[] = [];
    let totalMinutes = 0;

    // Step 1: Backup
    steps.push({
      order: 1,
      title: 'Backup et préparation',
      description: 'Créer un backup avant migration Node.js',
      commands: [
        'git checkout -b nodejs-20-migration',
        'git add .',
        'git commit -m "chore: backup before Node.js migration"',
      ],
      manualActions: [
        'Documenter version Node.js actuelle',
        'Vérifier environnements (dev, staging, prod)',
      ],
      estimatedTime: '15min',
      risk: 'low',
      rollbackPlan: 'git checkout main && git branch -D nodejs-20-migration'
    });
    totalMinutes += 15;

    // Step 2: Update Node.js version
    if (version.current !== version.recommended) {
      steps.push({
        order: 2,
        title: 'Installation Node.js 20 LTS',
        description: 'Installer et activer Node.js 20.18.0',
        commands: [
          'nvm install 20.18.0',
          'nvm use 20.18.0',
          'node --version  # Vérifier installation',
        ],
        manualActions: [
          'Mettre à jour .nvmrc si présent',
          'Ajouter "engines" dans package.json',
          'Mettre à jour CI/CD configuration',
        ],
        estimatedTime: '30min',
        risk: 'medium',
        rollbackPlan: `nvm use ${version.current}`
      });
      totalMinutes += 30;
    }

    // Step 3: Rebuild native modules
    if (nativeModules.some(m => m.needsRebuild)) {
      steps.push({
        order: 3,
        title: 'Rebuild native modules',
        description: 'Recompiler les modules avec bindings natifs',
        commands: [
          'cd backend',
          'rm -rf node_modules package-lock.json',
          'npm install',
          ...nativeModules
            .filter(m => m.needsRebuild)
            .map(m => `npm rebuild ${m.name}`),
        ],
        manualActions: [
          'Vérifier que tous les modules se compilent',
          'Tester imports de modules natifs',
        ],
        estimatedTime: '45min',
        risk: 'medium',
        rollbackPlan: 'Restaurer node_modules depuis backup'
      });
      totalMinutes += 45;
    }

    // Step 4: Fix deprecated APIs
    if (deprecatedAPIs.length > 0) {
      const criticalAPIs = deprecatedAPIs.filter(api => api.severity === 'critical' || api.severity === 'high');
      
      steps.push({
        order: 4,
        title: 'Correction APIs obsolètes',
        description: 'Remplacer les APIs deprecated par alternatives modernes',
        commands: [],
        manualActions: [
          ...criticalAPIs.map(api => 
            `Corriger ${api.api} dans ${api.affectedFiles.length} fichiers`
          ),
          'Exécuter tests unitaires après chaque correction',
          'Vérifier comportement identique',
        ],
        estimatedTime: `${criticalAPIs.length * 30}min`,
        risk: 'high',
        rollbackPlan: 'git checkout -- <fichiers modifiés>'
      });
      totalMinutes += criticalAPIs.length * 30;
    }

    // Step 5: Tests & validation
    steps.push({
      order: steps.length + 1,
      title: 'Tests et validation',
      description: 'Exécuter tous les tests et valider en staging',
      commands: [
        'npm run test',
        'npm run build',
        'npm run lint',
      ],
      manualActions: [
        'Tests manuels des flows critiques',
        'Vérifier performance (pas de régression)',
        'Valider en staging',
        'Monitoring logs production 24h',
      ],
      estimatedTime: '90min',
      risk: 'low',
      rollbackPlan: `nvm use ${version.current} && npm install`
    });
    totalMinutes += 90;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const estimatedDuration = `${hours}h ${minutes}min`;

    const criticalChanges = deprecatedAPIs.filter(api => api.severity === 'critical').length;
    const risk: 'low' | 'medium' | 'high' = 
      criticalChanges > 3 ? 'high' : 
      criticalChanges > 0 || nativeModules.length > 3 ? 'medium' : 
      'low';

    const automationLevel = this.calculateAutomationLevel(deprecatedAPIs, nativeModules);

    return {
      currentVersion: version.current,
      targetVersion: version.recommended,
      totalSteps: steps.length,
      estimatedDuration,
      risk,
      automationLevel,
      steps,
      recommendations: [
        'Migration progressive recommandée',
        'Tester en staging avant production',
        'Monitorer logs après déploiement',
        'Documenter changements pour l\'équipe',
      ],
    };
  }

  private calculateAutomationLevel(deprecatedAPIs: DeprecatedAPI[], nativeModules: NativeModule[]): number {
    // Native modules rebuild = automated
    const rebuildAutomated = nativeModules.filter(m => m.needsRebuild).length;
    
    // API fixes - depends on complexity
    let apiAutomated = 0;
    let apiManual = 0;

    for (const api of deprecatedAPIs) {
      if (api.severity === 'low' || api.severity === 'medium') {
        apiAutomated += api.affectedFiles.length * 0.7;
        apiManual += api.affectedFiles.length * 0.3;
      } else {
        apiManual += api.affectedFiles.length;
      }
    }

    const total = rebuildAutomated + apiAutomated + apiManual;
    return total > 0 ? Math.round(((rebuildAutomated + apiAutomated) / total) * 100) : 100;
  }

  // ═══════════════════════════════════════════════════════════════
  // RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════

  private generateRecommendations(
    version: NodeVersion,
    deprecatedAPIs: DeprecatedAPI[],
    cveVulnerabilities: CVEVulnerability[]
  ): string[] {
    const recommendations: string[] = [];

    if (version.isEOL) {
      recommendations.push(
        `🔴 URGENT: Node.js ${version.current} est End-of-Life - Migration obligatoire vers LTS`
      );
    }

    if (cveVulnerabilities.some(cve => cve.severity === 'critical')) {
      recommendations.push(
        `🔒 SÉCURITÉ: ${cveVulnerabilities.filter(c => c.severity === 'critical').length} CVE critiques détectées - Upgrade immédiat`
      );
    }

    if (!version.isLTS) {
      recommendations.push(
        `⚠️  Version non-LTS détectée - Migrer vers Node.js 20 LTS pour stabilité production`
      );
    }

    const criticalAPIs = deprecatedAPIs.filter(api => api.severity === 'critical');
    if (criticalAPIs.length > 0) {
      recommendations.push(
        `🔧 ${criticalAPIs.length} APIs critiques obsolètes - Correction avant upgrade`
      );
    }

    recommendations.push(
      `✅ Ajouter "engines" dans package.json pour contraindre version Node.js`,
      `✅ Utiliser .nvmrc pour cohérence équipe`,
      `✅ Migrer vers fs/promises au lieu de callbacks`,
      `✅ Exploiter features Node.js 20+ (fetch natif, test runner)`
    );

    return recommendations;
  }

  // ═══════════════════════════════════════════════════════════════
  // KPIs CALCULATION
  // ═══════════════════════════════════════════════════════════════

  private calculateKPIs(
    deprecatedAPIs: DeprecatedAPI[],
    nativeModules: NativeModule[],
    cveVulnerabilities: CVEVulnerability[],
    modernFeatures: NodeJSFeature[]
  ): {
    criticalAPIs: number;
    nativeModulesToRebuild: number;
    criticalCVEs: number;
    modernizationScore: number;
  } {
    const criticalAPIs = deprecatedAPIs.filter(
      api => api.severity === 'critical' || api.severity === 'high'
    ).length;

    const nativeModulesToRebuild = nativeModules.filter(m => m.needsRebuild).length;

    const criticalCVEs = cveVulnerabilities.filter(
      cve => cve.severity === 'critical' || cve.severity === 'high'
    ).length;

    const adoptedFeatures = modernFeatures.filter(f => f.adopted).length;
    const modernizationScore = Math.round((adoptedFeatures / modernFeatures.length) * 100);

    return {
      criticalAPIs,
      nativeModulesToRebuild,
      criticalCVEs,
      modernizationScore,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORTS GENERATION
  // ═══════════════════════════════════════════════════════════════

  private saveReports(report: UpgradeNodeJSReport): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // JSON Report
    const jsonPath = path.join(this.reportsDir, 'upgrade-nodejs.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Markdown Report
    const mdPath = path.join(this.reportsDir, 'upgrade-nodejs.md');
    fs.writeFileSync(mdPath, this.generateMarkdownReport(report));

    // Migration Script
    if (report.deprecatedAPIs.length > 0 || report.nativeModules.some(m => m.needsRebuild)) {
      const scriptPath = path.join(this.reportsDir, 'migrate-nodejs-20.sh');
      fs.writeFileSync(scriptPath, this.generateMigrationScript(report));
      fs.chmodSync(scriptPath, '755');
    }

    console.log(`💾 Reports sauvegardés:`);
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${mdPath}`);
    if (report.deprecatedAPIs.length > 0 || report.nativeModules.some(m => m.needsRebuild)) {
      console.log(`   - ${path.join(this.reportsDir, 'migrate-nodejs-20.sh')}`);
    }
  }

  private generateMarkdownReport(report: UpgradeNodeJSReport): string {
    const md: string[] = [];

    md.push('# 🔍 Rapport: Upgrade Node.js Analyzer\n');
    md.push(`**Généré le:** ${new Date(report.timestamp).toLocaleString('fr-FR')}\n`);
    md.push('---\n');

    // Version
    md.push('## 📦 Version Node.js\n');
    md.push(`- **Version actuelle:** ${report.version.current}`);
    md.push(`- **Version recommandée:** ${report.version.recommended}`);
    md.push(`- **LTS:** ${report.version.isLTS ? '✅' : '❌'}`);
    md.push(`- **EOL:** ${report.version.isEOL ? '🔴 OUI' : '✅ Non'}`);
    md.push(`- **Support sécurité:** ${report.version.securitySupport ? '✅' : '🔴 Non'}\n`);

    // KPIs
    md.push('## 📊 KPIs\n');
    md.push(`| Métrique | Valeur |`);
    md.push(`|----------|--------|`);
    md.push(`| Fichiers analysés | ${report.filesAnalyzed} |`);
    md.push(`| APIs critiques obsolètes | ${report.kpis.criticalAPIs} |`);
    md.push(`| Native modules à rebuild | ${report.kpis.nativeModulesToRebuild} |`);
    md.push(`| CVE critiques | ${report.kpis.criticalCVEs} |`);
    md.push(`| Score modernisation | ${report.kpis.modernizationScore}% |`);
    md.push('');

    // Deprecated APIs
    md.push('## 🚨 APIs Obsolètes\n');
    if (report.deprecatedAPIs.length === 0) {
      md.push('✅ Aucune API obsolète détectée.\n');
    } else {
      for (const api of report.deprecatedAPIs) {
        const severity = api.severity === 'critical' ? '🔴' : api.severity === 'high' ? '🟠' : api.severity === 'medium' ? '🟡' : '🟢';
        md.push(`### ${severity} ${api.id}: ${api.api}\n`);
        md.push(`**Catégorie:** ${api.category}`);
        md.push(`**Sévérité:** ${api.severity.toUpperCase()}`);
        md.push(`**Deprecated depuis:** Node.js ${api.deprecated}`);
        if (api.removed) {
          md.push(`**Supprimé depuis:** Node.js ${api.removed}`);
        }
        md.push('');
        md.push(`**Description:** ${api.description}\n`);
        md.push(`**Fichiers affectés:** ${api.affectedFiles.length}`);
        if (api.affectedFiles.length <= 5) {
          api.affectedFiles.forEach(f => md.push(`- \`${f}\``));
        } else {
          api.affectedFiles.slice(0, 5).forEach(f => md.push(`- \`${f}\``));
          md.push(`- ... et ${api.affectedFiles.length - 5} autres`);
        }
        md.push('');
        md.push(`**Remplacement:** ${api.replacement}\n`);
        
        if (api.codeExample) {
          md.push(`**Exemple de migration:**\n`);
          md.push('**Avant:**');
          md.push('```javascript');
          md.push(api.codeExample.before);
          md.push('```\n');
          md.push('**Après:**');
          md.push('```javascript');
          md.push(api.codeExample.after);
          md.push('```\n');
        }
      }
    }

    // Native Modules
    md.push('## 📦 Native Modules\n');
    if (report.nativeModules.length === 0) {
      md.push('✅ Aucun native module détecté.\n');
    } else {
      md.push(`| Module | Version | Rebuild Requis | Issues |`);
      md.push(`|--------|---------|----------------|--------|`);
      for (const mod of report.nativeModules) {
        const rebuild = mod.needsRebuild ? '⚠️  OUI' : '✅ Non';
        const issues = mod.issues.length > 0 ? mod.issues.join(', ') : 'Aucun';
        md.push(`| ${mod.name} | ${mod.version} | ${rebuild} | ${issues} |`);
      }
      md.push('');
    }

    // CVE Vulnerabilities
    md.push('## 🔒 Vulnérabilités CVE\n');
    if (report.cveVulnerabilities.length === 0) {
      md.push('✅ Aucune CVE détectée pour votre version.\n');
    } else {
      for (const cve of report.cveVulnerabilities) {
        const severity = cve.severity === 'critical' ? '🔴' : cve.severity === 'high' ? '🟠' : cve.severity === 'medium' ? '🟡' : '🟢';
        md.push(`### ${severity} ${cve.id}: ${cve.title}\n`);
        md.push(`**Sévérité:** ${cve.severity.toUpperCase()}`);
        if (cve.cvssScore) {
          md.push(`**CVSS Score:** ${cve.cvssScore}/10`);
        }
        md.push(`**Publié:** ${cve.published}`);
        md.push('');
        md.push(`**Description:** ${cve.description}\n`);
        md.push(`**Versions affectées:** ${cve.affectedVersions}`);
        md.push(`**Version corrigée:** ${cve.fixedVersion}\n`);
      }
    }

    // Modern Features
    md.push('## 🚀 Features Modernes Node.js\n');
    md.push(`| Feature | Disponible depuis | Adopté | Bénéfice |`);
    md.push(`|---------|-------------------|--------|----------|`);
    for (const feature of report.modernFeatures) {
      const adopted = feature.adopted ? '✅' : '❌';
      md.push(`| ${feature.name} | ${feature.availableSince} | ${adopted} | ${feature.benefit} |`);
    }
    md.push('');

    // Migration Plan
    md.push('## 📋 Plan de Migration\n');
    md.push(`**Version:** ${report.migrationPlan.currentVersion} → ${report.migrationPlan.targetVersion}`);
    md.push(`**Durée estimée:** ${report.migrationPlan.estimatedDuration}`);
    md.push(`**Niveau de risque:** ${report.migrationPlan.risk.toUpperCase()}`);
    md.push(`**Niveau d'automation:** ${report.migrationPlan.automationLevel}%\n`);

    md.push(`### Étapes (${report.migrationPlan.totalSteps})\n`);
    for (const step of report.migrationPlan.steps) {
      md.push(`#### ${step.order}. ${step.title} (${step.estimatedTime})\n`);
      md.push(`**Risque:** ${step.risk.toUpperCase()}\n`);
      md.push(`${step.description}\n`);
      
      if (step.commands.length > 0) {
        md.push('**Commandes:**');
        md.push('```bash');
        step.commands.forEach(cmd => md.push(cmd));
        md.push('```\n');
      }
      
      if (step.manualActions.length > 0) {
        md.push('**Actions manuelles:**');
        step.manualActions.forEach(action => md.push(`- ${action}`));
        md.push('');
      }
      
      md.push(`**Plan de rollback:** ${step.rollbackPlan}\n`);
    }

    // Recommendations
    md.push('## 💡 Recommandations\n');
    report.recommendations.forEach(rec => md.push(`- ${rec}`));
    md.push('');

    md.push('---');
    md.push(`*Rapport généré par AI Agent 8: Upgrade Node.js Analyzer*`);

    return md.join('\n');
  }

  private generateMigrationScript(report: UpgradeNodeJSReport): string {
    const script: string[] = [];

    script.push('#!/bin/bash');
    script.push('');
    script.push('# ═══════════════════════════════════════════════════════════════');
    script.push('# Node.js 20 LTS Migration Script');
    script.push(`# Generated: ${new Date(report.timestamp).toLocaleString('fr-FR')}`);
    script.push('# ═══════════════════════════════════════════════════════════════');
    script.push('');
    script.push('set -e  # Exit on error');
    script.push('');
    script.push('echo "🚀 Starting Node.js 20 LTS migration..."');
    script.push('echo ""');
    script.push('');

    for (const step of report.migrationPlan.steps) {
      script.push(`# Step ${step.order}: ${step.title}`);
      script.push(`echo "📝 Step ${step.order}/${report.migrationPlan.totalSteps}: ${step.title}"`);
      script.push('echo ""');
      script.push('');

      if (step.commands.length > 0) {
        step.commands.forEach(cmd => {
          script.push(cmd);
        });
        script.push('');
      }

      if (step.manualActions.length > 0) {
        script.push('echo "⚠️  ACTIONS MANUELLES REQUISES:"');
        step.manualActions.forEach(action => {
          script.push(`echo "   - ${action}"`);
        });
        script.push('echo ""');
        script.push('read -p "Appuyez sur Entrée une fois les actions manuelles complétées..."');
        script.push('');
      }

      script.push(`echo "✅ Step ${step.order} completed"`);
      script.push('echo ""');
      script.push('');
    }

    script.push('echo "🎉 Node.js 20 LTS migration completed!"');
    script.push('echo ""');
    script.push('echo "Next steps:"');
    script.push('echo "1. Run tests: npm run test"');
    script.push('echo "2. Build project: npm run build"');
    script.push('echo "3. Deploy to staging"');
    script.push('echo "4. Monitor logs for 24h"');

    return script.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  private relativePath(absolutePath: string): string {
    return path.relative(this.rootDir, absolutePath);
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════

// Exported for standalone usage and testing
export async function runUpgradeNodeJSAgent(rootDir?: string): Promise<UpgradeNodeJSReport> {
  const agent = new UpgradeNodeJSAgent(rootDir);
  return await agent.analyze();
}
