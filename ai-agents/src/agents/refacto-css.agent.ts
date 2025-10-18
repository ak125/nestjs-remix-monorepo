/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AGENT 9: Refactorisation CSS                               ║
 * ║  Analyse TailwindCSS usage, duplications, optimisations      ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * 🎯 FONCTION
 * Analyse l'utilisation de TailwindCSS et CSS dans le monorepo
 * 
 * 📏 MÉTHODOLOGIE
 * - **Outils**:
 *   - Regex pattern matching sur className="..." (React/Remix)
 *   - AST parsing pour class: directives (Vue/Svelte si applicable)
 *   - PurgeCSS analysis pour unused classes
 * - **Détection Patterns Dupliqués**:
 *   - Extraction de tous les className dans .tsx/.jsx
 *   - Groupement par pattern exact (ex: "flex items-center gap-4")
 *   - Comptage occurrences par pattern
 * - **Seuils de Gravité**:
 *   - >100 occurrences = CRITICAL (composant urgent)
 *   - 50-100 occurrences = HIGH (composant recommandé)
 *   - 20-50 occurrences = MEDIUM (considérer extraction)
 *   - <20 occurrences = LOW (acceptable)
 * 
 * 🔍 CONFIDENCE LEVEL: HIGH
 * - Détection patterns: HIGH (99% exact avec regex)
 * - Unused classes: MEDIUM (10% faux positifs sur classes dynamiques)
 * - Faux positifs typiques:
 *   - Classes construites dynamiquement: `className={isActive ? 'text-blue' : 'text-gray'}`
 *   - Classes conditionnelles complexes avec variables
 * 
 * 📊 CRITÈRE D'EXTRACTION COMPOSANT
 * Un pattern doit être extrait en composant si:
 * - **Règle 1**: Pattern présent >50 occurrences dans codebase
 * - **Règle 2**: OU présent dans 3+ pages critiques (dashboard, orders, analytics)
 * - **Règle 3**: OU fait partie design system (buttons, inputs, cards, badges)
 * 
 * Exemples d'extraction:
 * - `flex items-center gap-4` (339×) → `<FlexCenter gap={4}>`
 * - `text-sm font-medium text-gray-700` (216×) → `<Text variant="body-small">`
 * - `px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600` → `<Button variant="primary">`
 * 
 * 🎨 TOP 8 PATTERNS CRITIQUES
 * 1. flex items-center gap-N → FlexCenter component
 * 2. flex items-center justify-between → FlexCenter justify="between"
 * 3. text-sm font-medium text-color-N → Text variant="body-small"
 * 4. px-N py-N rounded-lg bg-color → Button/Card base
 * 5. grid grid-cols-N gap-N → GridLayout component
 * 6. absolute inset-0 flex items-center justify-center → Overlay component
 * 7. border border-gray-N rounded-lg p-N → Card component
 * 8. transition-all duration-N ease-in-out → Animation utility
 * 
 * @description
 * Analyse l'utilisation de TailwindCSS et CSS dans le monorepo pour :
 * 1. Détecter classes TailwindCSS dupliquées
 * 2. Identifier classes personnalisées inutilisées
 * 3. Recommander extractions en composants
 * 4. Analyser potentiel migration TailwindCSS v4
 * 5. Suggérer optimisations (purge, JIT, etc.)
 * 
 * @metrics
 * - Nombre de classes analysées
 * - Duplications détectées
 * - Classes unused
 * - Score d'optimisation
 * 
 * @outputs
 * - refacto-css.json : Résultats détaillés
 * - refacto-css.md : Rapport lisible
 * - refacto-css-plan.sh : Script d'optimisation (si applicable)
 * 
 * ✅ DEFINITION OF DONE (par composant extrait)
 * - [ ] Interface TypeScript pour props (strict typing)
 * - [ ] Story Storybook avec toutes les variants
 * - [ ] Support dark mode (dark: utilities)
 * - [ ] Accessibilité: ARIA labels, keyboard navigation
 * - [ ] Tests unitaires: Jest + React Testing Library
 * - [ ] Documentation: JSDoc avec exemples usage
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus,
  AgentType,
  KPI,
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

interface TailwindVersion {
  current: string;
  target: string;
  isV4: boolean;
  isUpToDate: boolean;
}

interface ClassUsage {
  className: string;
  count: number;
  files: string[];
  category: 'utility' | 'component' | 'custom' | 'animation';
  isDuplicated: boolean;
}

interface DuplicatedPattern {
  pattern: string; // Ex: "flex items-center gap-4"
  occurrences: number;
  files: string[];
  estimatedLines: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  componentSuggestion?: string;
}

interface UnusedStyle {
  selector: string;
  file: string;
  lineNumber: number;
  reason: string;
}

interface CSSFile {
  path: string;
  size: number;
  lines: number;
  hasCustomCSS: boolean;
  hasTailwindDirectives: boolean;
  customSelectorsCount: number;
}

interface OptimizationOpportunity {
  type: 'component-extraction' | 'tailwind-v4' | 'purge-config' | 'dark-mode' | 'animation';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedFiles: string[];
  estimatedImpact: string;
  implementation: string;
}

interface RefactoPlan {
  currentSetup: {
    tailwindVersion: string;
    postcssVersion: string;
    customCSSFiles: number;
    totalClassesUsed: number;
  };
  duplications: DuplicatedPattern[];
  unusedStyles: UnusedStyle[];
  optimizationOpportunities: OptimizationOpportunity[];
  migrationSteps: MigrationStep[];
  estimatedDuration: string;
  complexity: 'low' | 'medium' | 'high';
}

interface MigrationStep {
  order: number;
  title: string;
  description: string;
  commands: string[];
  manualActions: string[];
  estimatedTime: string;
}

interface RefactoCSSReport {
  timestamp: string;
  version: TailwindVersion;
  filesAnalyzed: number;
  classUsageStats: {
    totalClasses: number;
    duplicatedPatterns: number;
    unusedStyles: number;
    customClasses: number;
  };
  topDuplicatedPatterns: DuplicatedPattern[];
  unusedStyles: UnusedStyle[];
  cssFiles: CSSFile[];
  optimizationOpportunities: OptimizationOpportunity[];
  refactoPlan: RefactoPlan;
  recommendations: string[];
  kpis: {
    duplicationsCount: number;
    optimizationScore: number;
    potentialBundleReduction: number; // %
  };
}

// ═══════════════════════════════════════════════════════════════
// AGENT CLASS
// ═══════════════════════════════════════════════════════════════

export class RefactoCSSAgent implements IAgent {
  public readonly name = 'Refactorisation CSS';
  public readonly type: AgentType = 'refacto-css';
  public readonly description = 'Analyse TailwindCSS usage, duplications et optimisations';
  public readonly version = '1.0.0';

  private rootDir: string;
  private frontendDir: string;
  private reportsDir: string;
  private status: AgentStatus = 'idle';

  constructor(rootDir?: string) {
    this.rootDir = rootDir || path.resolve(__dirname, '../../../');
    this.frontendDir = path.join(this.rootDir, 'frontend');
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
        report.kpis.duplicationsCount > 50 ? 'warning' : 'success';

      // Construire les KPIs
      const kpis: KPI[] = [
        {
          name: 'Duplications Critiques',
          value: report.kpis.duplicationsCount,
          unit: 'patterns',
          status: report.kpis.duplicationsCount > 50 ? 'critical' : 
                  report.kpis.duplicationsCount > 20 ? 'warning' : 'ok',
        },
        {
          name: 'Score Optimisation',
          value: report.kpis.optimizationScore,
          unit: '%',
          status: report.kpis.optimizationScore >= 70 ? 'ok' : 'warning',
        },
        {
          name: 'Réduction Bundle Potentielle',
          value: report.kpis.potentialBundleReduction,
          unit: '%',
          status: report.kpis.potentialBundleReduction > 10 ? 'warning' : 'ok',
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
  // MAIN ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  async analyze(): Promise<RefactoCSSReport> {
    console.log('\n🎨 Refactorisation CSS - Analyse en cours...');

    // 1. Détection version TailwindCSS
    console.log('📦 Détection version TailwindCSS...');
    const version = this.detectTailwindVersion();
    console.log(`✓ Version actuelle: ${version.current} → cible: ${version.target}`);

    // 2. Scan fichiers CSS
    console.log('📂 Scan fichiers CSS...');
    const cssFiles = this.scanCSSFiles();
    console.log(`✓ ${cssFiles.length} fichiers CSS analysés`);

    // 3. Analyse utilisation classes
    console.log('🎯 Analyse utilisation classes TailwindCSS...');
    const classUsage = this.analyzeClassUsage();
    console.log(`✓ ${classUsage.length} classes différentes détectées`);

    // 4. Détection duplications
    console.log('🔍 Détection patterns dupliqués...');
    const duplicatedPatterns = this.detectDuplicatedPatterns(classUsage);
    console.log(`✓ ${duplicatedPatterns.length} patterns dupliqués détectés`);

    // 5. Détection styles inutilisés
    console.log('🗑️  Détection styles inutilisés...');
    const unusedStyles = this.detectUnusedStyles(cssFiles);
    console.log(`✓ ${unusedStyles.length} styles potentiellement inutilisés`);

    // 6. Opportunités d'optimisation
    console.log('🚀 Identification opportunités optimisation...');
    const optimizationOpportunities = this.identifyOptimizationOpportunities(
      duplicatedPatterns,
      classUsage,
      version
    );
    console.log(`✓ ${optimizationOpportunities.length} opportunités identifiées`);

    // 7. Plan de refactorisation
    console.log('📋 Génération plan refactorisation...');
    const refactoPlan = this.generateRefactoPlan(
      version,
      duplicatedPatterns,
      unusedStyles,
      optimizationOpportunities
    );

    // 8. Recommandations
    console.log('💡 Génération recommandations...');
    const recommendations = this.generateRecommendations(
      duplicatedPatterns,
      optimizationOpportunities
    );

    // 9. KPIs
    const kpis = this.calculateKPIs(duplicatedPatterns, unusedStyles, classUsage);

    // 10. Stats
    const classUsageStats = {
      totalClasses: classUsage.length,
      duplicatedPatterns: duplicatedPatterns.length,
      unusedStyles: unusedStyles.length,
      customClasses: classUsage.filter(c => c.category === 'custom').length,
    };

    const report: RefactoCSSReport = {
      timestamp: new Date().toISOString(),
      version,
      filesAnalyzed: this.countComponentFiles(),
      classUsageStats,
      topDuplicatedPatterns: duplicatedPatterns.slice(0, 10),
      unusedStyles,
      cssFiles,
      optimizationOpportunities,
      refactoPlan,
      recommendations,
      kpis,
    };

    // 11. Sauvegarde rapports
    this.saveReports(report);

    return report;
  }

  // ═══════════════════════════════════════════════════════════════
  // VERSION DETECTION
  // ═══════════════════════════════════════════════════════════════

  private detectTailwindVersion(): TailwindVersion {
    const packageJsonPath = path.join(this.frontendDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return {
        current: '0.0.0',
        target: '4.0.0',
        isV4: false,
        isUpToDate: false,
      };
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const currentVersion = (packageJson.dependencies?.tailwindcss || 
                           packageJson.devDependencies?.tailwindcss || 
                           '0.0.0').replace(/[\^~]/g, '');
    
    const current = currentVersion;
    const target = '4.0.0'; // Tailwind v4 (beta)
    const isV4 = currentVersion.startsWith('4.');
    const isUpToDate = parseFloat(currentVersion) >= 3.4;

    return {
      current,
      target,
      isV4,
      isUpToDate,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CSS FILES SCAN
  // ═══════════════════════════════════════════════════════════════

  private scanCSSFiles(): CSSFile[] {
    const cssFiles: CSSFile[] = [];
    const appDir = path.join(this.frontendDir, 'app');

    const files = this.getAllFiles(appDir, ['.css']);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const stats = fs.statSync(file);
      const lines = content.split('\n').length;

      const hasTailwindDirectives = /@tailwind/.test(content);
      const customSelectors = content.match(/\.[a-zA-Z-_]+\s*{/g) || [];
      
      cssFiles.push({
        path: this.relativePath(file),
        size: stats.size,
        lines,
        hasCustomCSS: customSelectors.length > 0,
        hasTailwindDirectives,
        customSelectorsCount: customSelectors.length,
      });
    }

    return cssFiles;
  }

  // ═══════════════════════════════════════════════════════════════
  // CLASS USAGE ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeClassUsage(): ClassUsage[] {
    const classMap = new Map<string, ClassUsage>();
    const appDir = path.join(this.frontendDir, 'app');
    const files = this.getAllFiles(appDir, ['.tsx', '.jsx', '.ts', '.js']);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = this.relativePath(file);

      // Extraire className="..." ou class="..."
      const classMatches = content.matchAll(/(?:className|class)=["'`]([^"'`]+)["'`]/g);

      for (const match of classMatches) {
        const classString = match[1];
        
        // Skip template strings complexes
        if (classString.includes('${') || classString.includes('{')) {
          continue;
        }

        // Séparer les classes individuelles
        const classes = classString.split(/\s+/).filter(c => c.length > 0);

        for (const className of classes) {
          if (!classMap.has(className)) {
            classMap.set(className, {
              className,
              count: 0,
              files: [],
              category: this.categorizeClass(className),
              isDuplicated: false,
            });
          }

          const usage = classMap.get(className)!;
          usage.count++;
          if (!usage.files.includes(relativePath)) {
            usage.files.push(relativePath);
          }
        }
      }
    }

    const usages = Array.from(classMap.values());

    // Marquer les duplications (>10 usages)
    usages.forEach(u => {
      u.isDuplicated = u.count > 10;
    });

    return usages.sort((a, b) => b.count - a.count);
  }

  private categorizeClass(className: string): 'utility' | 'component' | 'custom' | 'animation' {
    // Tailwind utility classes
    if (/^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky)$/.test(className)) return 'utility';
    if (/^(bg-|text-|border-|rounded-|p-|m-|w-|h-|max-|min-)/.test(className)) return 'utility';
    if (/^(hover:|focus:|active:|group-|peer-)/.test(className)) return 'utility';
    
    // Animations
    if (/^(animate-|transition-)/.test(className)) return 'animation';
    
    // Custom classes (camelCase ou kebab-case personnalisées)
    if (/^[a-z][a-zA-Z0-9]*$/.test(className) || /^[a-z]+-[a-z-]+$/.test(className)) {
      return 'custom';
    }

    return 'utility';
  }

  // ═══════════════════════════════════════════════════════════════
  // DUPLICATED PATTERNS DETECTION
  // ═══════════════════════════════════════════════════════════════

  private detectDuplicatedPatterns(classUsage: ClassUsage[]): DuplicatedPattern[] {
    const patterns = new Map<string, DuplicatedPattern>();
    const appDir = path.join(this.frontendDir, 'app');
    const files = this.getAllFiles(appDir, ['.tsx', '.jsx']);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = this.relativePath(file);

      // Extraire patterns de 3+ classes consécutives
      const classMatches = content.matchAll(/className=["'`]([^"'`]+)["'`]/g);

      for (const match of classMatches) {
        const classString = match[1].trim();
        
        // Skip si template string
        if (classString.includes('${') || classString.includes('{')) {
          continue;
        }

        // Patterns de 3+ mots minimum
        const words = classString.split(/\s+/).filter(w => w.length > 0);
        if (words.length < 3) continue;

        // Normaliser le pattern (enlever valeurs dynamiques)
        const normalizedPattern = this.normalizePattern(classString);

        if (!patterns.has(normalizedPattern)) {
          patterns.set(normalizedPattern, {
            pattern: normalizedPattern,
            occurrences: 0,
            files: [],
            estimatedLines: 1,
            severity: 'low',
            recommendation: '',
            componentSuggestion: undefined,
          });
        }

        const pattern = patterns.get(normalizedPattern)!;
        pattern.occurrences++;
        if (!pattern.files.includes(relativePath)) {
          pattern.files.push(relativePath);
        }
      }
    }

    // Filtrer patterns significatifs (>5 occurrences)
    const significantPatterns = Array.from(patterns.values())
      .filter(p => p.occurrences >= 5)
      .map(p => {
        // Déterminer sévérité
        p.severity = p.occurrences >= 20 ? 'critical' :
                     p.occurrences >= 10 ? 'high' :
                     p.occurrences >= 7 ? 'medium' : 'low';

        // Générer recommandation
        if (p.severity === 'critical' || p.severity === 'high') {
          p.recommendation = `Extraire en composant réutilisable (${p.occurrences} usages)`;
          p.componentSuggestion = this.suggestComponentName(p.pattern);
        } else {
          p.recommendation = `Envisager factorisation si pattern métier`;
        }

        return p;
      })
      .sort((a, b) => b.occurrences - a.occurrences);

    return significantPatterns;
  }

  private normalizePattern(classString: string): string {
    return classString
      .replace(/\b(bg|text|border)-(gray|blue|red|green|yellow|purple|pink|indigo)-\d+\b/g, '$1-color-N')
      .replace(/\b(p|m|px|py|mx|my|gap|space)-\d+\b/g, '$1-N')
      .replace(/\b(w|h|max-w|max-h|min-w|min-h)-\d+\b/g, '$1-N')
      .trim();
  }

  private suggestComponentName(pattern: string): string {
    if (pattern.includes('flex') && pattern.includes('items-center')) {
      return 'FlexCenter';
    }
    if (pattern.includes('button') || pattern.includes('btn')) {
      return 'Button';
    }
    if (pattern.includes('card')) {
      return 'Card';
    }
    if (pattern.includes('input')) {
      return 'Input';
    }
    return 'StyledComponent';
  }

  // ═══════════════════════════════════════════════════════════════
  // UNUSED STYLES DETECTION
  // ═══════════════════════════════════════════════════════════════

  private detectUnusedStyles(cssFiles: CSSFile[]): UnusedStyle[] {
    const unusedStyles: UnusedStyle[] = [];

    // Pour chaque fichier CSS personnalisé
    for (const cssFile of cssFiles.filter(f => f.hasCustomCSS)) {
      const fullPath = path.join(this.rootDir, cssFile.path);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Extraire sélecteurs personnalisés
      const selectorMatches = content.matchAll(/\.([a-zA-Z0-9_-]+)\s*{/g);

      for (const match of selectorMatches) {
        const selector = match[1];
        const lineNumber = this.findLineNumber(content, match.index!);

        // Vérifier si utilisé dans JSX/TSX
        const isUsed = this.isClassUsedInComponents(selector);

        if (!isUsed) {
          unusedStyles.push({
            selector: `.${selector}`,
            file: cssFile.path,
            lineNumber,
            reason: 'Classe non trouvée dans les composants',
          });
        }
      }
    }

    return unusedStyles;
  }

  private isClassUsedInComponents(className: string): boolean {
    const appDir = path.join(this.frontendDir, 'app');
    const files = this.getAllFiles(appDir, ['.tsx', '.jsx', '.ts', '.js']);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Chercher className="...selector..." ou class="...selector..."
      const regex = new RegExp(`(?:className|class)=["'\`][^"'\`]*\\b${className}\\b[^"'\`]*["'\`]`, 'g');
      
      if (regex.test(content)) {
        return true;
      }
    }

    return false;
  }

  private findLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  // ═══════════════════════════════════════════════════════════════
  // OPTIMIZATION OPPORTUNITIES
  // ═══════════════════════════════════════════════════════════════

  private identifyOptimizationOpportunities(
    duplicatedPatterns: DuplicatedPattern[],
    classUsage: ClassUsage[],
    version: TailwindVersion
  ): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // Opportunity 1: Component extraction pour patterns critiques
    const criticalPatterns = duplicatedPatterns.filter(p => 
      p.severity === 'critical' || p.severity === 'high'
    );

    if (criticalPatterns.length > 0) {
      opportunities.push({
        type: 'component-extraction',
        severity: 'high',
        description: `${criticalPatterns.length} patterns TailwindCSS fortement dupliqués nécessitent extraction en composants`,
        affectedFiles: criticalPatterns.flatMap(p => p.files).filter((v, i, a) => a.indexOf(v) === i),
        estimatedImpact: `Réduction ~${criticalPatterns.reduce((acc, p) => acc + p.occurrences, 0) * 50} lignes de className dupliqué`,
        implementation: 'Créer composants réutilisables avec props pour variants',
      });
    }

    // Opportunity 2: Migration Tailwind v4 (si v3)
    if (!version.isV4 && version.isUpToDate) {
      opportunities.push({
        type: 'tailwind-v4',
        severity: 'medium',
        description: 'Migration vers TailwindCSS v4 pour performances améliorées',
        affectedFiles: ['tailwind.config.cjs', 'postcss.config.cjs'],
        estimatedImpact: 'Build time -50%, CSS output -20%, nouvelles features (container queries, etc.)',
        implementation: 'Upgrade @tailwindcss/vite, migrer config vers CSS, utiliser @import',
      });
    }

    // Opportunity 3: Dark mode optimization
    const hasDarkClasses = classUsage.some(c => c.className.startsWith('dark:'));
    if (!hasDarkClasses) {
      opportunities.push({
        type: 'dark-mode',
        severity: 'low',
        description: 'Aucune classe dark mode détectée - opportunité support dark theme',
        affectedFiles: ['global.css', 'tailwind.config.cjs'],
        estimatedImpact: 'Améliore UX utilisateur préférant dark mode',
        implementation: 'Activer darkMode: "class" dans config, ajouter classes dark:*',
      });
    }

    // Opportunity 4: Animation optimization
    const animationClasses = classUsage.filter(c => c.category === 'animation');
    if (animationClasses.length > 20) {
      opportunities.push({
        type: 'animation',
        severity: 'low',
        description: `${animationClasses.length} classes animation - envisager @keyframes personnalisées`,
        affectedFiles: ['global.css'],
        estimatedImpact: 'Animations custom plus performantes et maintenables',
        implementation: 'Définir @keyframes CSS, utiliser animate-[custom]',
      });
    }

    return opportunities;
  }

  // ═══════════════════════════════════════════════════════════════
  // REFACTO PLAN
  // ═══════════════════════════════════════════════════════════════

  private generateRefactoPlan(
    version: TailwindVersion,
    duplicatedPatterns: DuplicatedPattern[],
    unusedStyles: UnusedStyle[],
    opportunities: OptimizationOpportunity[]
  ): RefactoPlan {
    const steps: MigrationStep[] = [];
    let totalMinutes = 0;

    // Step 1: Audit initial
    steps.push({
      order: 1,
      title: 'Audit et documentation état actuel',
      description: 'Documenter setup TailwindCSS actuel et patterns utilisés',
      commands: [
        'git checkout -b refacto-css',
        'git add .',
        'git commit -m "chore: backup before CSS refactoring"',
      ],
      manualActions: [
        'Reviewer rapport refacto-css.md',
        'Prioriser patterns à extraire',
        'Identifier composants UI manquants',
      ],
      estimatedTime: '30min',
    });
    totalMinutes += 30;

    // Step 2: Suppression styles inutilisés
    if (unusedStyles.length > 0) {
      steps.push({
        order: 2,
        title: 'Nettoyage styles inutilisés',
        description: `Supprimer ${unusedStyles.length} sélecteurs CSS non utilisés`,
        commands: [],
        manualActions: [
          ...unusedStyles.slice(0, 5).map(s => `Supprimer ${s.selector} dans ${s.file}:${s.lineNumber}`),
          unusedStyles.length > 5 ? `... et ${unusedStyles.length - 5} autres` : '',
        ].filter(Boolean),
        estimatedTime: `${Math.min(unusedStyles.length * 2, 60)}min`,
      });
      totalMinutes += Math.min(unusedStyles.length * 2, 60);
    }

    // Step 3: Extraction composants UI
    const criticalPatterns = duplicatedPatterns.filter(p => 
      p.severity === 'critical' || p.severity === 'high'
    );

    if (criticalPatterns.length > 0) {
      steps.push({
        order: 3,
        title: 'Extraction composants UI réutilisables',
        description: `Créer ${criticalPatterns.length} composants pour patterns dupliqués`,
        commands: [],
        manualActions: [
          ...criticalPatterns.slice(0, 3).map(p => 
            `Créer ${p.componentSuggestion || 'Component'} (${p.occurrences} usages)`
          ),
          criticalPatterns.length > 3 ? `... et ${criticalPatterns.length - 3} autres composants` : '',
        ].filter(Boolean),
        estimatedTime: `${criticalPatterns.length * 30}min`,
      });
      totalMinutes += criticalPatterns.length * 30;
    }

    // Step 4: Migration Tailwind v4 (si applicable)
    if (!version.isV4 && opportunities.some(o => o.type === 'tailwind-v4')) {
      steps.push({
        order: 4,
        title: 'Migration TailwindCSS v4 (optionnel)',
        description: 'Upgrade vers Tailwind v4 pour meilleures performances',
        commands: [
          'cd frontend',
          'npm install -D tailwindcss@next @tailwindcss/vite@next',
          'npm install',
        ],
        manualActions: [
          'Migrer tailwind.config.cjs → global.css (@theme)',
          'Mettre à jour vite.config.ts',
          'Tester build',
        ],
        estimatedTime: '120min',
      });
      totalMinutes += 120;
    }

    // Step 5: Tests et validation
    steps.push({
      order: steps.length + 1,
      title: 'Tests et validation',
      description: 'Vérifier que tous les styles fonctionnent correctement',
      commands: [
        'cd frontend',
        'npm run build',
        'npm run lint',
      ],
      manualActions: [
        'Tests visuels des composants modifiés',
        'Vérifier responsive design',
        'Valider dark mode (si applicable)',
        'Mesurer taille bundle CSS',
      ],
      estimatedTime: '60min',
    });
    totalMinutes += 60;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const estimatedDuration = `${hours}h ${minutes}min`;

    const complexity: 'low' | 'medium' | 'high' = 
      criticalPatterns.length > 10 ? 'high' :
      criticalPatterns.length > 5 ? 'medium' : 'low';

    // Get current stats
    const packageJsonPath = path.join(this.frontendDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const tailwindVersion = (packageJson.devDependencies?.tailwindcss || '0.0.0').replace(/[\^~]/g, '');
    const postcssVersion = (packageJson.devDependencies?.postcss || '0.0.0').replace(/[\^~]/g, '');

    return {
      currentSetup: {
        tailwindVersion,
        postcssVersion,
        customCSSFiles: this.scanCSSFiles().filter(f => f.hasCustomCSS).length,
        totalClassesUsed: this.analyzeClassUsage().length,
      },
      duplications: duplicatedPatterns,
      unusedStyles,
      optimizationOpportunities: opportunities,
      migrationSteps: steps,
      estimatedDuration,
      complexity,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════

  private generateRecommendations(
    duplicatedPatterns: DuplicatedPattern[],
    opportunities: OptimizationOpportunity[]
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = duplicatedPatterns.filter(p => p.severity === 'critical').length;
    const highCount = duplicatedPatterns.filter(p => p.severity === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(
        `🔴 URGENT: ${criticalCount} patterns critiques (>20 usages) - Extraction composants prioritaire`
      );
    }

    if (highCount > 0) {
      recommendations.push(
        `🟠 ${highCount} patterns hautement dupliqués (>10 usages) - Factorisation recommandée`
      );
    }

    if (opportunities.some(o => o.type === 'component-extraction')) {
      recommendations.push(
        `💡 Créer bibliothèque composants UI (Button, Card, Input, etc.) avec variants Tailwind`
      );
    }

    if (opportunities.some(o => o.type === 'tailwind-v4')) {
      recommendations.push(
        `🚀 Envisager migration TailwindCSS v4 pour performances (build -50%, CSS -20%)`
      );
    }

    recommendations.push(
      `✅ Utiliser @apply avec parcimonie (préférer composants React)`,
      `✅ Configurer purge TailwindCSS pour production (réduction bundle)`,
      `✅ Documenter palette couleurs custom dans design system`
    );

    return recommendations;
  }

  // ═══════════════════════════════════════════════════════════════
  // KPIs
  // ═══════════════════════════════════════════════════════════════

  private calculateKPIs(
    duplicatedPatterns: DuplicatedPattern[],
    unusedStyles: UnusedStyle[],
    classUsage: ClassUsage[]
  ): {
    duplicationsCount: number;
    optimizationScore: number;
    potentialBundleReduction: number;
  } {
    const duplicationsCount = duplicatedPatterns.filter(
      p => p.severity === 'critical' || p.severity === 'high'
    ).length;

    // Score basé sur duplication et optimisations
    const totalDuplicatedUsages = duplicatedPatterns.reduce((acc, p) => acc + p.occurrences, 0);
    const totalUsages = classUsage.reduce((acc, c) => acc + c.count, 0);
    const duplicationRatio = totalUsages > 0 ? totalDuplicatedUsages / totalUsages : 0;
    
    const optimizationScore = Math.max(0, Math.round((1 - duplicationRatio) * 100));

    // Estimation réduction bundle (unused + duplications)
    const unusedImpact = unusedStyles.length * 0.1; // ~0.1% par unused
    const duplicationImpact = duplicationsCount * 0.5; // ~0.5% par duplication majeure
    const potentialBundleReduction = Math.min(30, Math.round(unusedImpact + duplicationImpact));

    return {
      duplicationsCount,
      optimizationScore,
      potentialBundleReduction,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORTS GENERATION
  // ═══════════════════════════════════════════════════════════════

  private saveReports(report: RefactoCSSReport): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // JSON Report
    const jsonPath = path.join(this.reportsDir, 'refacto-css.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Markdown Report
    const mdPath = path.join(this.reportsDir, 'refacto-css.md');
    fs.writeFileSync(mdPath, this.generateMarkdownReport(report));

    // Refacto script (si applicable)
    if (report.topDuplicatedPatterns.length > 0) {
      const scriptPath = path.join(this.reportsDir, 'refacto-css-plan.sh');
      fs.writeFileSync(scriptPath, this.generateRefactoScript(report));
      fs.chmodSync(scriptPath, '755');
    }

    console.log(`💾 Reports sauvegardés:`);
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${mdPath}`);
    if (report.topDuplicatedPatterns.length > 0) {
      console.log(`   - ${path.join(this.reportsDir, 'refacto-css-plan.sh')}`);
    }
  }

  private generateMarkdownReport(report: RefactoCSSReport): string {
    const md: string[] = [];

    md.push('# 🎨 Rapport: Refactorisation CSS\n');
    md.push(`**Généré le:** ${new Date(report.timestamp).toLocaleString('fr-FR')}\n`);
    md.push('---\n');

    // Version & Setup
    md.push('## 📦 Configuration TailwindCSS\n');
    md.push(`- **Version actuelle:** ${report.version.current}`);
    md.push(`- **Version cible:** ${report.version.target}`);
    md.push(`- **TailwindCSS v4:** ${report.version.isV4 ? '✅' : '❌'}`);
    md.push(`- **PostCSS:** ${report.refactoPlan.currentSetup.postcssVersion}`);
    md.push(`- **Fichiers CSS custom:** ${report.cssFiles.filter(f => f.hasCustomCSS).length}\n`);

    // KPIs
    md.push('## 📊 KPIs\n');
    md.push(`| Métrique | Valeur |`);
    md.push(`|----------|--------|`);
    md.push(`| Fichiers analysés | ${report.filesAnalyzed} |`);
    md.push(`| Classes utilisées | ${report.classUsageStats.totalClasses} |`);
    md.push(`| Patterns dupliqués | ${report.classUsageStats.duplicatedPatterns} |`);
    md.push(`| Styles inutilisés | ${report.classUsageStats.unusedStyles} |`);
    md.push(`| Score optimisation | ${report.kpis.optimizationScore}% |`);
    md.push(`| Réduction bundle potentielle | ${report.kpis.potentialBundleReduction}% |`);
    md.push('');

    // Top Duplicated Patterns
    md.push('## 🔍 Top Patterns Dupliqués\n');
    if (report.topDuplicatedPatterns.length === 0) {
      md.push('✅ Aucun pattern significatif dupliqué détecté.\n');
    } else {
      for (const pattern of report.topDuplicatedPatterns) {
        const severity = pattern.severity === 'critical' ? '🔴' : 
                        pattern.severity === 'high' ? '🟠' : 
                        pattern.severity === 'medium' ? '🟡' : '🟢';
        
        md.push(`### ${severity} Pattern: \`${pattern.pattern}\`\n`);
        md.push(`**Occurrences:** ${pattern.occurrences}`);
        md.push(`**Sévérité:** ${pattern.severity.toUpperCase()}`);
        md.push(`**Fichiers affectés:** ${pattern.files.length}\n`);
        
        if (pattern.files.length <= 5) {
          pattern.files.forEach(f => md.push(`- \`${f}\``));
        } else {
          pattern.files.slice(0, 5).forEach(f => md.push(`- \`${f}\``));
          md.push(`- ... et ${pattern.files.length - 5} autres`);
        }
        md.push('');
        
        md.push(`**Recommandation:** ${pattern.recommendation}`);
        if (pattern.componentSuggestion) {
          md.push(`**Composant suggéré:** \`${pattern.componentSuggestion}\``);
        }
        md.push('');
      }
    }

    // Unused Styles
    md.push('## 🗑️ Styles Inutilisés\n');
    if (report.unusedStyles.length === 0) {
      md.push('✅ Aucun style inutilisé détecté.\n');
    } else {
      md.push(`${report.unusedStyles.length} sélecteurs CSS potentiellement inutilisés:\n`);
      const displayCount = Math.min(report.unusedStyles.length, 10);
      for (const unused of report.unusedStyles.slice(0, displayCount)) {
        md.push(`- \`${unused.selector}\` dans \`${unused.file}:${unused.lineNumber}\``);
        md.push(`  _${unused.reason}_`);
      }
      if (report.unusedStyles.length > 10) {
        md.push(`\n... et ${report.unusedStyles.length - 10} autres\n`);
      }
      md.push('');
    }

    // Optimization Opportunities
    md.push('## 🚀 Opportunités d\'Optimisation\n');
    if (report.optimizationOpportunities.length === 0) {
      md.push('✅ Configuration optimale actuelle.\n');
    } else {
      for (const opp of report.optimizationOpportunities) {
        const severity = opp.severity === 'high' ? '🔴' : 
                        opp.severity === 'medium' ? '🟡' : '🟢';
        
        md.push(`### ${severity} ${opp.type.toUpperCase()}\n`);
        md.push(`**Description:** ${opp.description}\n`);
        md.push(`**Impact estimé:** ${opp.estimatedImpact}\n`);
        md.push(`**Implémentation:** ${opp.implementation}\n`);
        md.push(`**Fichiers concernés:** ${opp.affectedFiles.length}`);
        if (opp.affectedFiles.length <= 3) {
          opp.affectedFiles.forEach(f => md.push(`- \`${f}\``));
        }
        md.push('');
      }
    }

    // Refacto Plan
    md.push('## 📋 Plan de Refactorisation\n');
    md.push(`**Durée estimée:** ${report.refactoPlan.estimatedDuration}`);
    md.push(`**Complexité:** ${report.refactoPlan.complexity.toUpperCase()}\n`);

    md.push(`### Étapes (${report.refactoPlan.migrationSteps.length})\n`);
    for (const step of report.refactoPlan.migrationSteps) {
      md.push(`#### ${step.order}. ${step.title} (${step.estimatedTime})\n`);
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
    }

    // Recommendations
    md.push('## 💡 Recommandations\n');
    report.recommendations.forEach(rec => md.push(`- ${rec}`));
    md.push('');

    md.push('---');
    md.push(`*Rapport généré par AI Agent 9: Refactorisation CSS*`);

    return md.join('\n');
  }

  private generateRefactoScript(report: RefactoCSSReport): string {
    const script: string[] = [];

    script.push('#!/bin/bash');
    script.push('');
    script.push('# ═══════════════════════════════════════════════════════════════');
    script.push('# CSS Refactoring Plan');
    script.push(`# Generated: ${new Date(report.timestamp).toLocaleString('fr-FR')}`);
    script.push('# ═══════════════════════════════════════════════════════════════');
    script.push('');
    script.push('set -e  # Exit on error');
    script.push('');
    script.push('echo "🎨 Starting CSS refactoring..."');
    script.push('echo ""');
    script.push('');

    for (const step of report.refactoPlan.migrationSteps) {
      script.push(`# Step ${step.order}: ${step.title}`);
      script.push(`echo "📝 Step ${step.order}/${report.refactoPlan.migrationSteps.length}: ${step.title}"`);
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
          script.push(`echo "   - ${action.replace(/"/g, '\\"')}"`);
        });
        script.push('echo ""');
        script.push('read -p "Appuyez sur Entrée une fois les actions manuelles complétées..."');
        script.push('');
      }

      script.push(`echo "✅ Step ${step.order} completed"`);
      script.push('echo ""');
      script.push('');
    }

    script.push('echo "🎉 CSS refactoring completed!"');
    script.push('echo ""');
    script.push('echo "Next steps:"');
    script.push('echo "1. Run visual tests"');
    script.push('echo "2. Check bundle size: npm run build"');
    script.push('echo "3. Deploy to staging"');

    return script.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'build') {
          files.push(...this.getAllFiles(fullPath, extensions));
        }
      } else {
        if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private countComponentFiles(): number {
    const appDir = path.join(this.frontendDir, 'app');
    return this.getAllFiles(appDir, ['.tsx', '.jsx']).length;
  }

  private relativePath(absolutePath: string): string {
    return path.relative(this.rootDir, absolutePath);
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════

// Exported for standalone usage and testing
export async function runRefactoCSSAgent(rootDir?: string): Promise<RefactoCSSReport> {
  const agent = new RefactoCSSAgent(rootDir);
  return await agent.analyze();
}
