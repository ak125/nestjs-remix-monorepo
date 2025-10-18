/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AGENT 7: Upgrade React Analyzer                            ║
 * ║  Analyse React 18+ patterns, optimisations, breaking changes ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * @description
 * Analyse l'utilisation de React dans le monorepo pour :
 * 1. Détecter patterns obsolètes (lifecycle methods deprecated)
 * 2. Identifier opportunités d'optimisation (Suspense, transitions, concurrent)
 * 3. Recommander migrations vers React 18+ features
 * 4. Analyser rendering performance patterns
 * 
 * @metrics
 * - Nombre de composants analysés
 * - Patterns obsolètes détectés
 * - Opportunités d'optimisation identifiées
 * - Score d'adoption React 18
 * 
 * @outputs
 * - upgrade-react.json : Résultats détaillés
 * - upgrade-react.md : Rapport lisible
 * - migrate-react-18.sh : Script de migration (si applicable)
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus,
  AgentType,
  KPI,
} from '../types';
import { Project, SyntaxKind, ClassDeclaration, FunctionDeclaration, ArrowFunction, MethodDeclaration } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

interface ReactVersion {
  current: string;
  target: string;
  isUpToDate: boolean;
  hasReact18Features: boolean;
}

interface ReactBreakingChange {
  id: string;
  category: 'lifecycle' | 'api' | 'optimization' | 'deprecated' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  pattern: string;
  affectedFiles: string[];
  recommendation: string;
  effort: 'low' | 'medium' | 'high';
  codeExample?: {
    before: string;
    after: string;
  };
}

interface ComponentAnalysis {
  filePath: string;
  componentName: string;
  type: 'class' | 'function';
  hasClassComponent: boolean;
  hasDeprecatedLifecycle: boolean;
  deprecatedMethods: string[];
  canUseSuspense: boolean;
  canUseTransitions: boolean;
  canUseConcurrent: boolean;
  hasUnoptimizedRendering: boolean;
  optimizationOpportunities: string[];
  usesReact18Features: boolean;
  react18FeaturesUsed: string[];
}

interface OptimizationOpportunity {
  type: 'suspense' | 'transition' | 'memo' | 'useMemo' | 'useCallback' | 'concurrent' | 'lazy';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedFiles: string[];
  estimatedImpact: string;
  implementation: string;
}

interface DependencyAnalysis {
  package: string;
  currentVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  breakingChanges: boolean;
}

interface ReactMigrationStep {
  order: number;
  title: string;
  description: string;
  commands: string[];
  manualActions: string[];
  estimatedTime: string;
  risk: 'low' | 'medium' | 'high';
  rollbackPlan: string;
}

interface ReactMigrationPlan {
  currentVersion: string;
  targetVersion: string;
  totalSteps: number;
  estimatedDuration: string;
  risk: 'low' | 'medium' | 'high';
  automationLevel: number;
  steps: ReactMigrationStep[];
  recommendations: string[];
}

interface UpgradeReactReport {
  timestamp: string;
  version: ReactVersion;
  componentsAnalyzed: number;
  breakingChanges: ReactBreakingChange[];
  componentAnalysis: ComponentAnalysis[];
  optimizationOpportunities: OptimizationOpportunity[];
  dependencies: DependencyAnalysis[];
  migrationPlan: ReactMigrationPlan;
  recommendations: string[];
  kpis: {
    criticalBreakingChanges: number;
    deprecatedPatternsCount: number;
    react18AdoptionScore: number;
    optimizationPotential: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// AGENT CLASS
// ═══════════════════════════════════════════════════════════════

export class UpgradeReactAgent implements IAgent {
  public readonly name = 'Upgrade React Analyzer';
  public readonly type: AgentType = 'upgrade-react';
  public readonly description = 'Analyse React 18+ patterns, optimisations et breaking changes';
  public readonly version = '1.0.0';

  private project!: Project;
  private rootDir: string;
  private frontendDir: string;
  private reportsDir: string;
  private componentsDir: string;
  private status: AgentStatus = 'idle';

  constructor(rootDir?: string) {
    this.rootDir = rootDir || path.resolve(__dirname, '../../../');
    this.frontendDir = path.join(this.rootDir, 'frontend');
    this.componentsDir = path.join(this.frontendDir, 'app');
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
        report.kpis.criticalBreakingChanges > 0 ? 'warning' : 'success';

      // Construire les KPIs
      const kpis: KPI[] = [
        {
          name: 'Breaking Changes Critiques',
          value: report.kpis.criticalBreakingChanges,
          unit: 'critiques',
          status: report.kpis.criticalBreakingChanges === 0 ? 'ok' : 'critical',
        },
        {
          name: 'Patterns Obsolètes',
          value: report.kpis.deprecatedPatternsCount,
          unit: 'composants',
          status: report.kpis.deprecatedPatternsCount === 0 ? 'ok' : 'warning',
        },
        {
          name: 'Score Adoption React 18',
          value: report.kpis.react18AdoptionScore,
          unit: '%',
          status: report.kpis.react18AdoptionScore >= 50 ? 'ok' : 'warning',
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

  async analyze(): Promise<UpgradeReactReport> {
    console.log('\n🔍 Upgrade React - Analyse en cours...');

    // 1. Détection version React
    console.log('📦 Détection version React...');
    const version = this.detectReactVersion();
    console.log(`✓ Version actuelle: ${version.current} → cible: ${version.target}`);

    // 2. Initialisation projet TypeScript
    console.log('📂 Initialisation projet TypeScript...');
    this.initializeProject();

    // 3. Analyse des composants
    console.log('⚛️  Analyse des composants React...');
    const componentAnalysis = this.analyzeComponents();
    console.log(`✓ ${componentAnalysis.length} composants analysés`);

    // 4. Détection breaking changes
    console.log('🔍 Analyse des breaking changes...');
    const breakingChanges = this.analyzeBreakingChanges(componentAnalysis);
    console.log(`✓ ${breakingChanges.length} breaking changes détectés`);

    // 5. Identification opportunités d'optimisation
    console.log('🚀 Identification opportunités d\'optimisation...');
    const optimizationOpportunities = this.identifyOptimizationOpportunities(componentAnalysis);
    console.log(`✓ ${optimizationOpportunities.length} opportunités identifiées`);

    // 6. Analyse dépendances
    console.log('📚 Analyse des dépendances...');
    const dependencies = this.analyzeDependencies();
    console.log(`✓ ${dependencies.filter(d => d.needsUpdate).length} dépendances à mettre à jour`);

    // 7. Plan de migration
    console.log('📋 Génération du plan de migration...');
    const migrationPlan = this.generateMigrationPlan(version, breakingChanges, dependencies);

    // 8. Recommandations
    console.log('💡 Génération des recommandations...');
    const recommendations = this.generateRecommendations(componentAnalysis, optimizationOpportunities);

    // 9. KPIs
    const kpis = this.calculateKPIs(breakingChanges, componentAnalysis, optimizationOpportunities);

    const report: UpgradeReactReport = {
      timestamp: new Date().toISOString(),
      version,
      componentsAnalyzed: componentAnalysis.length,
      breakingChanges,
      componentAnalysis,
      optimizationOpportunities,
      dependencies,
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

  private detectReactVersion(): ReactVersion {
    const packageJsonPath = path.join(this.frontendDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const currentVersion = packageJson.dependencies?.react || packageJson.devDependencies?.react || '0.0.0';
    const current = currentVersion.replace(/[\^~]/g, '');
    const target = '18.3.1'; // Latest stable

    // Détection React 18 features usage
    const hasReact18Features = this.detectReact18FeaturesUsage();

    return {
      current,
      target,
      isUpToDate: current >= target,
      hasReact18Features,
    };
  }

  private detectReact18FeaturesUsage(): boolean {
    const searchPatterns = [
      'useTransition',
      'useDeferredValue',
      'startTransition',
      'createRoot',
      'hydrateRoot',
    ];

    const appDir = this.componentsDir;
    return this.searchInDirectory(appDir, searchPatterns);
  }

  private searchInDirectory(dir: string, patterns: string[]): boolean {
    if (!fs.existsSync(dir)) return false;

    const files = this.getAllFiles(dir, ['.tsx', '.jsx', '.ts', '.js']);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (patterns.some(pattern => content.includes(pattern))) {
        return true;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // PROJECT INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  private initializeProject(): void {
    const tsconfigPath = path.join(this.frontendDir, 'tsconfig.json');
    
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPONENTS ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeComponents(): ComponentAnalysis[] {
    const componentFiles = this.project.getSourceFiles()
      .filter(sf => {
        const filePath = sf.getFilePath();
        return (filePath.includes('/app/') || filePath.includes('/components/')) &&
               (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'));
      });

    const analyses: ComponentAnalysis[] = [];

    for (const sourceFile of componentFiles) {
      const filePath = sourceFile.getFilePath();
      
      // Analyse des classes components
      const classDeclarations = sourceFile.getClasses();
      for (const classDecl of classDeclarations) {
        if (this.isReactComponent(classDecl)) {
          analyses.push(this.analyzeClassComponent(filePath, classDecl));
        }
      }

      // Analyse des fonction components
      const functionDeclarations = sourceFile.getFunctions();
      for (const funcDecl of functionDeclarations) {
        if (this.isFunctionComponent(funcDecl)) {
          analyses.push(this.analyzeFunctionComponent(filePath, funcDecl));
        }
      }

      // Analyse des arrow function components (export default)
      const variableStatements = sourceFile.getVariableStatements();
      for (const varStmt of variableStatements) {
        for (const declaration of varStmt.getDeclarations()) {
          const initializer = declaration.getInitializer();
          if (initializer && (initializer.getKind() === SyntaxKind.ArrowFunction || initializer.getKind() === SyntaxKind.FunctionExpression)) {
            const name = declaration.getName();
            if (this.looksLikeComponent(name)) {
              analyses.push(this.analyzeArrowFunctionComponent(filePath, name, initializer as ArrowFunction));
            }
          }
        }
      }
    }

    return analyses;
  }

  private isReactComponent(classDecl: ClassDeclaration): boolean {
    const heritage = classDecl.getHeritageClauses();
    for (const clause of heritage) {
      const types = clause.getTypeNodes();
      for (const type of types) {
        const text = type.getText();
        if (text.includes('Component') || text.includes('PureComponent')) {
          return true;
        }
      }
    }
    return false;
  }

  private isFunctionComponent(funcDecl: FunctionDeclaration): boolean {
    const name = funcDecl.getName();
    if (!name) return false;
    
    // Convention: composants commencent par majuscule
    if (!/^[A-Z]/.test(name)) return false;

    // Vérifier si retourne JSX
    const returnStatements = funcDecl.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    for (const ret of returnStatements) {
      const expr = ret.getExpression();
      if (expr && this.isJSXExpression(expr)) {
        return true;
      }
    }

    return false;
  }

  private looksLikeComponent(name: string): boolean {
    return /^[A-Z]/.test(name);
  }

  private isJSXExpression(expr: any): boolean {
    const kind = expr.getKind();
    return kind === SyntaxKind.JsxElement || 
           kind === SyntaxKind.JsxSelfClosingElement ||
           kind === SyntaxKind.JsxFragment;
  }

  private analyzeClassComponent(filePath: string, classDecl: ClassDeclaration): ComponentAnalysis {
    const componentName = classDecl.getName() || 'Unknown';
    const methods = classDecl.getMethods();
    
    const deprecatedMethods: string[] = [];
    const deprecatedLifecycleMethods = [
      'componentWillMount',
      'componentWillReceiveProps',
      'componentWillUpdate',
      'UNSAFE_componentWillMount',
      'UNSAFE_componentWillReceiveProps',
      'UNSAFE_componentWillUpdate',
    ];

    for (const method of methods) {
      const methodName = method.getName();
      if (deprecatedLifecycleMethods.includes(methodName)) {
        deprecatedMethods.push(methodName);
      }
    }

    return {
      filePath: this.relativePath(filePath),
      componentName,
      type: 'class',
      hasClassComponent: true,
      hasDeprecatedLifecycle: deprecatedMethods.length > 0,
      deprecatedMethods,
      canUseSuspense: false, // Classes can't use Suspense directly
      canUseTransitions: false, // Would need conversion to function
      canUseConcurrent: false,
      hasUnoptimizedRendering: this.hasUnoptimizedRendering(classDecl),
      optimizationOpportunities: this.getClassComponentOptimizations(classDecl, deprecatedMethods),
      usesReact18Features: false,
      react18FeaturesUsed: [],
    };
  }

  private analyzeFunctionComponent(filePath: string, funcDecl: FunctionDeclaration): ComponentAnalysis {
    const componentName = funcDecl.getName() || 'Unknown';
    const sourceFile = funcDecl.getSourceFile();
    const content = sourceFile.getText();

    const react18Features = [
      'useTransition',
      'useDeferredValue',
      'useId',
      'useSyncExternalStore',
      'startTransition',
    ];

    const react18FeaturesUsed = react18Features.filter(feature => content.includes(feature));

    return {
      filePath: this.relativePath(filePath),
      componentName,
      type: 'function',
      hasClassComponent: false,
      hasDeprecatedLifecycle: false,
      deprecatedMethods: [],
      canUseSuspense: true,
      canUseTransitions: true,
      canUseConcurrent: true,
      hasUnoptimizedRendering: this.functionHasUnoptimizedRendering(funcDecl),
      optimizationOpportunities: this.getFunctionComponentOptimizations(funcDecl),
      usesReact18Features: react18FeaturesUsed.length > 0,
      react18FeaturesUsed,
    };
  }

  private analyzeArrowFunctionComponent(filePath: string, name: string, arrowFunc: ArrowFunction): ComponentAnalysis {
    const sourceFile = arrowFunc.getSourceFile();
    const content = sourceFile.getText();

    const react18Features = [
      'useTransition',
      'useDeferredValue',
      'useId',
      'useSyncExternalStore',
      'startTransition',
    ];

    const react18FeaturesUsed = react18Features.filter(feature => content.includes(feature));

    return {
      filePath: this.relativePath(filePath),
      componentName: name,
      type: 'function',
      hasClassComponent: false,
      hasDeprecatedLifecycle: false,
      deprecatedMethods: [],
      canUseSuspense: true,
      canUseTransitions: true,
      canUseConcurrent: true,
      hasUnoptimizedRendering: false,
      optimizationOpportunities: [],
      usesReact18Features: react18FeaturesUsed.length > 0,
      react18FeaturesUsed,
    };
  }

  private hasUnoptimizedRendering(classDecl: ClassDeclaration): boolean {
    // Check si pas de shouldComponentUpdate ou PureComponent
    const heritage = classDecl.getHeritageClauses();
    let isPure = false;
    
    for (const clause of heritage) {
      const types = clause.getTypeNodes();
      for (const type of types) {
        if (type.getText().includes('PureComponent')) {
          isPure = true;
        }
      }
    }

    if (isPure) return false;

    const methods = classDecl.getMethods();
    const hasShouldComponentUpdate = methods.some(m => m.getName() === 'shouldComponentUpdate');
    
    return !hasShouldComponentUpdate;
  }

  private functionHasUnoptimizedRendering(funcDecl: FunctionDeclaration): boolean {
    const sourceFile = funcDecl.getSourceFile();
    const content = sourceFile.getText();
    
    // Check si wrapped avec React.memo
    const funcText = funcDecl.getText();
    const beforeFunc = content.substring(0, content.indexOf(funcText));
    
    return !beforeFunc.includes('memo(') && !content.includes(`memo(${funcDecl.getName()})`);
  }

  private getClassComponentOptimizations(classDecl: ClassDeclaration, deprecatedMethods: string[]): string[] {
    const optimizations: string[] = [];

    if (deprecatedMethods.length > 0) {
      optimizations.push('Convert to function component with hooks');
    }

    if (this.hasUnoptimizedRendering(classDecl)) {
      optimizations.push('Extend PureComponent or implement shouldComponentUpdate');
      optimizations.push('Consider converting to function component with React.memo');
    }

    const methods = classDecl.getMethods();
    if (methods.some(m => m.getName() === 'componentDidMount')) {
      optimizations.push('Consider using useEffect hook after conversion');
    }

    return optimizations;
  }

  private getFunctionComponentOptimizations(funcDecl: FunctionDeclaration): string[] {
    const optimizations: string[] = [];
    const sourceFile = funcDecl.getSourceFile();
    const content = sourceFile.getText();

    // Check for expensive operations in render
    if (content.includes('.map(') || content.includes('.filter(')) {
      optimizations.push('Consider useMemo for expensive array operations');
    }

    // Check for inline functions as props
    if (content.match(/\s+\w+={(.*?)\s*=>/g)) {
      optimizations.push('Consider useCallback for inline function props');
    }

    // Check for context usage
    if (content.includes('useContext')) {
      optimizations.push('Consider React.memo to prevent unnecessary re-renders from context');
    }

    return optimizations;
  }

  // ═══════════════════════════════════════════════════════════════
  // BREAKING CHANGES ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeBreakingChanges(componentAnalysis: ComponentAnalysis[]): ReactBreakingChange[] {
    const breakingChanges: ReactBreakingChange[] = [];

    // BC001: Deprecated lifecycle methods
    const deprecatedLifecycleFiles = componentAnalysis
      .filter(c => c.hasDeprecatedLifecycle)
      .map(c => c.filePath);

    if (deprecatedLifecycleFiles.length > 0) {
      breakingChanges.push({
        id: 'REACT-001',
        category: 'lifecycle',
        severity: 'high',
        title: 'Deprecated Lifecycle Methods',
        description: 'Usage of deprecated lifecycle methods (componentWillMount, componentWillReceiveProps, componentWillUpdate)',
        pattern: 'componentWill* | UNSAFE_componentWill*',
        affectedFiles: deprecatedLifecycleFiles,
        recommendation: 'Migrate to useEffect hook or getDerivedStateFromProps',
        effort: 'medium',
        codeExample: {
          before: `class MyComponent extends Component {
  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.setState({ value: nextProps.value });
    }
  }
}`,
          after: `function MyComponent({ value }) {
  const [state, setState] = useState(value);
  
  useEffect(() => {
    setState(value);
  }, [value]);
  
  return <div>{state}</div>;
}`
        }
      });
    }

    // BC002: Class components without optimization
    const unoptimizedClassFiles = componentAnalysis
      .filter(c => c.hasClassComponent && c.hasUnoptimizedRendering)
      .map(c => c.filePath);

    if (unoptimizedClassFiles.length > 0) {
      breakingChanges.push({
        id: 'REACT-002',
        category: 'performance',
        severity: 'medium',
        title: 'Unoptimized Class Components',
        description: 'Class components without shouldComponentUpdate or PureComponent optimization',
        pattern: 'class * extends Component (without optimization)',
        affectedFiles: unoptimizedClassFiles,
        recommendation: 'Convert to function component with React.memo or extend PureComponent',
        effort: 'low',
        codeExample: {
          before: `class MyComponent extends Component {
  render() {
    return <div>{this.props.value}</div>;
  }
}`,
          after: `const MyComponent = React.memo(({ value }) => {
  return <div>{value}</div>;
});`
        }
      });
    }

    // BC003: Missing React 18 concurrent features
    const canUseConcurrentFiles = componentAnalysis
      .filter(c => c.canUseConcurrent && !c.usesReact18Features)
      .map(c => c.filePath);

    if (canUseConcurrentFiles.length > 10) { // Only if significant
      breakingChanges.push({
        id: 'REACT-003',
        category: 'optimization',
        severity: 'low',
        title: 'React 18 Concurrent Features Not Used',
        description: 'Components could benefit from React 18 concurrent features (useTransition, useDeferredValue)',
        pattern: 'Function components without concurrent hooks',
        affectedFiles: canUseConcurrentFiles.slice(0, 10), // Top 10
        recommendation: 'Consider using useTransition for non-urgent updates, useDeferredValue for expensive computations',
        effort: 'low',
        codeExample: {
          before: `function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    fetchResults(query).then(setResults);
  }, [query]);
  
  return <List items={results} />;
}`,
          after: `function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();
  
  useEffect(() => {
    startTransition(() => {
      fetchResults(query).then(setResults);
    });
  }, [query]);
  
  return (
    <>
      {isPending && <Spinner />}
      <List items={results} />
    </>
  );
}`
        }
      });
    }

    // BC004: Potential React.lazy opportunities
    const largeComponentFiles = componentAnalysis
      .filter(c => {
        const fullPath = path.join(this.rootDir, c.filePath);
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          return stats.size > 10 * 1024; // > 10KB
        }
        return false;
      })
      .map(c => c.filePath);

    if (largeComponentFiles.length > 5) {
      breakingChanges.push({
        id: 'REACT-004',
        category: 'optimization',
        severity: 'medium',
        title: 'Large Components Without Lazy Loading',
        description: 'Large components that could benefit from React.lazy and Suspense',
        pattern: 'Components > 10KB without lazy loading',
        affectedFiles: largeComponentFiles.slice(0, 5),
        recommendation: 'Use React.lazy() with Suspense for code splitting',
        effort: 'low',
        codeExample: {
          before: `import HeavyComponent from './HeavyComponent';

function App() {
  return <HeavyComponent />;
}`,
          after: `import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}`
        }
      });
    }

    return breakingChanges;
  }

  // ═══════════════════════════════════════════════════════════════
  // OPTIMIZATION OPPORTUNITIES
  // ═══════════════════════════════════════════════════════════════

  private identifyOptimizationOpportunities(componentAnalysis: ComponentAnalysis[]): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // Opportunity 1: Convert class to function components
    const classComponents = componentAnalysis.filter(c => c.hasClassComponent);
    if (classComponents.length > 0) {
      opportunities.push({
        type: 'concurrent',
        severity: 'medium',
        description: `${classComponents.length} class components could be converted to function components to leverage hooks`,
        affectedFiles: classComponents.map(c => c.filePath),
        estimatedImpact: 'Better code reusability, access to React 18 features, improved maintainability',
        implementation: 'Refactor class components to function components using hooks (useState, useEffect, etc.)'
      });
    }

    // Opportunity 2: React.memo optimization
    const unmemoizedComponents = componentAnalysis.filter(c => 
      c.type === 'function' && c.hasUnoptimizedRendering
    );
    if (unmemoizedComponents.length > 5) {
      opportunities.push({
        type: 'memo',
        severity: 'medium',
        description: `${unmemoizedComponents.length} function components could benefit from React.memo`,
        affectedFiles: unmemoizedComponents.slice(0, 10).map(c => c.filePath),
        estimatedImpact: 'Reduced unnecessary re-renders, improved performance',
        implementation: 'Wrap components with React.memo(), add custom comparison function if needed'
      });
    }

    // Opportunity 3: useTransition for better UX
    const transitionCandidates = componentAnalysis.filter(c => 
      c.canUseTransitions && !c.react18FeaturesUsed.includes('useTransition')
    );
    if (transitionCandidates.length > 10) {
      opportunities.push({
        type: 'transition',
        severity: 'low',
        description: `${transitionCandidates.length} components could use useTransition for non-urgent updates`,
        affectedFiles: transitionCandidates.slice(0, 10).map(c => c.filePath),
        estimatedImpact: 'Better perceived performance, smoother user interactions',
        implementation: 'Use useTransition() for search, filtering, pagination updates'
      });
    }

    // Opportunity 4: Suspense for data fetching
    const suspenseCandidates = componentAnalysis.filter(c => c.canUseSuspense);
    if (suspenseCandidates.length > 10) {
      opportunities.push({
        type: 'suspense',
        severity: 'low',
        description: `${suspenseCandidates.length} components could use Suspense for better loading states`,
        affectedFiles: suspenseCandidates.slice(0, 10).map(c => c.filePath),
        estimatedImpact: 'Declarative loading states, better code organization',
        implementation: 'Wrap components with <Suspense> boundary, use suspense-enabled data fetching'
      });
    }

    return opportunities;
  }

  // ═══════════════════════════════════════════════════════════════
  // DEPENDENCIES ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeDependencies(): DependencyAnalysis[] {
    const packageJsonPath = path.join(this.frontendDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const reactPackages = [
      'react',
      'react-dom',
      '@types/react',
      '@types/react-dom',
    ];

    const dependencies: DependencyAnalysis[] = [];

    for (const pkg of reactPackages) {
      const currentVersion = (packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg] || '0.0.0')
        .replace(/[\^~]/g, '');

      const latestVersions: Record<string, string> = {
        'react': '18.3.1',
        'react-dom': '18.3.1',
        '@types/react': '18.3.11',
        '@types/react-dom': '18.3.1',
      };

      const latestVersion = latestVersions[pkg] || currentVersion;
      const needsUpdate = currentVersion < latestVersion;

      dependencies.push({
        package: pkg,
        currentVersion,
        latestVersion,
        needsUpdate,
        breakingChanges: needsUpdate && currentVersion.startsWith('17'),
      });
    }

    return dependencies;
  }

  // ═══════════════════════════════════════════════════════════════
  // MIGRATION PLAN
  // ═══════════════════════════════════════════════════════════════

  private generateMigrationPlan(
    version: ReactVersion,
    breakingChanges: ReactBreakingChange[],
    dependencies: DependencyAnalysis[]
  ): ReactMigrationPlan {
    const steps: ReactMigrationStep[] = [];
    let totalMinutes = 0;

    // Step 1: Backup
    steps.push({
      order: 1,
      title: 'Backup et préparation',
      description: 'Créer un backup complet avant migration',
      commands: [
        'git checkout -b react-18-migration',
        'git add .',
        'git commit -m "chore: backup before React 18 migration"',
      ],
      manualActions: [
        'Informer l\'équipe de la migration',
        'Vérifier que tous les tests passent',
      ],
      estimatedTime: '15min',
      risk: 'low',
      rollbackPlan: 'git checkout main && git branch -D react-18-migration'
    });
    totalMinutes += 15;

    // Step 2: Update dependencies (si nécessaire)
    if (dependencies.some(d => d.needsUpdate)) {
      const updateCommands = dependencies
        .filter(d => d.needsUpdate)
        .map(d => `npm install ${d.package}@${d.latestVersion}`);

      steps.push({
        order: 2,
        title: 'Mise à jour des dépendances React',
        description: 'Mettre à jour React, ReactDOM et types vers les dernières versions',
        commands: [
          'cd frontend',
          ...updateCommands,
          'npm install',
        ],
        manualActions: [
          'Vérifier package-lock.json',
          'Vérifier absence de conflits de versions',
        ],
        estimatedTime: '30min',
        risk: 'medium',
        rollbackPlan: 'git checkout package.json package-lock.json && npm install'
      });
      totalMinutes += 30;
    }

    // Step 3: Fix deprecated lifecycle methods
    const deprecatedBC = breakingChanges.find(bc => bc.id === 'REACT-001');
    if (deprecatedBC) {
      steps.push({
        order: 3,
        title: 'Migration lifecycle methods obsolètes',
        description: 'Convertir les lifecycle methods deprecated vers hooks',
        commands: [],
        manualActions: [
          `Convertir ${deprecatedBC.affectedFiles.length} composants classes vers fonction + hooks`,
          'Remplacer componentWillReceiveProps par useEffect',
          'Remplacer componentWillMount par useEffect(() => {}, [])',
          'Tester chaque composant après conversion',
        ],
        estimatedTime: `${deprecatedBC.affectedFiles.length * 15}min`,
        risk: 'high',
        rollbackPlan: 'git checkout frontend/app/components/'
      });
      totalMinutes += deprecatedBC.affectedFiles.length * 15;
    }

    // Step 4: Optimization - React.memo
    const memoBC = breakingChanges.find(bc => bc.id === 'REACT-002');
    if (memoBC && memoBC.affectedFiles.length > 0) {
      steps.push({
        order: 4,
        title: 'Optimisation avec React.memo',
        description: 'Wrapper les composants fréquemment re-rendus avec React.memo',
        commands: [],
        manualActions: [
          `Analyser ${memoBC.affectedFiles.length} composants non optimisés`,
          'Wrapper avec React.memo les composants avec props stables',
          'Ajouter custom comparison si nécessaire',
          'Mesurer performance avant/après',
        ],
        estimatedTime: `${Math.min(memoBC.affectedFiles.length * 5, 120)}min`,
        risk: 'low',
        rollbackPlan: 'Retirer les React.memo wrapping si problèmes'
      });
      totalMinutes += Math.min(memoBC.affectedFiles.length * 5, 120);
    }

    // Step 5: Adopt React 18 features (optional)
    const concurrentBC = breakingChanges.find(bc => bc.id === 'REACT-003');
    if (concurrentBC) {
      steps.push({
        order: 5,
        title: 'Adoption features React 18 (optionnel)',
        description: 'Introduire progressivement useTransition, Suspense, useDeferredValue',
        commands: [],
        manualActions: [
          'Identifier composants bénéficiant de useTransition (recherche, filtres)',
          'Wrapper routes avec <Suspense> pour code splitting',
          'Utiliser useDeferredValue pour calculs coûteux',
          'Tester comportement concurrent',
        ],
        estimatedTime: '180min',
        risk: 'low',
        rollbackPlan: 'Retirer progressivement les features React 18'
      });
      totalMinutes += 180;
    }

    // Step 6: Tests & validation
    steps.push({
      order: steps.length + 1,
      title: 'Tests et validation',
      description: 'Exécuter tous les tests et valider en staging',
      commands: [
        'cd frontend',
        'npm run test',
        'npm run build',
        'npm run lint',
      ],
      manualActions: [
        'Tests manuels des flows critiques',
        'Vérifier performance (Lighthouse)',
        'Valider en staging',
        'Tests régression visuels',
      ],
      estimatedTime: '120min',
      risk: 'low',
      rollbackPlan: 'git checkout main'
    });
    totalMinutes += 120;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const estimatedDuration = `${hours}h ${minutes}min`;

    const criticalChanges = breakingChanges.filter(bc => bc.severity === 'critical' || bc.severity === 'high').length;
    const risk: 'low' | 'medium' | 'high' = criticalChanges > 5 ? 'high' : criticalChanges > 2 ? 'medium' : 'low';

    const automationLevel = this.calculateAutomationLevel(breakingChanges);

    return {
      currentVersion: version.current,
      targetVersion: version.target,
      totalSteps: steps.length,
      estimatedDuration,
      risk,
      automationLevel,
      steps,
      recommendations: [
        'Migration progressive recommandée (par composant)',
        'Prioriser composants critiques en premier',
        'Mesurer performance avant/après',
        'Documenter changements pour l\'équipe',
      ],
    };
  }

  private calculateAutomationLevel(breakingChanges: ReactBreakingChange[]): number {
    let automated = 0;
    let manual = 0;

    for (const bc of breakingChanges) {
      if (bc.effort === 'low') {
        automated += bc.affectedFiles.length;
      } else if (bc.effort === 'medium') {
        automated += bc.affectedFiles.length * 0.5;
        manual += bc.affectedFiles.length * 0.5;
      } else {
        manual += bc.affectedFiles.length;
      }
    }

    const total = automated + manual;
    return total > 0 ? Math.round((automated / total) * 100) : 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════

  private generateRecommendations(
    componentAnalysis: ComponentAnalysis[],
    optimizationOpportunities: OptimizationOpportunity[]
  ): string[] {
    const recommendations: string[] = [];

    const classComponents = componentAnalysis.filter(c => c.hasClassComponent).length;
    const totalComponents = componentAnalysis.length;
    const classPercentage = Math.round((classComponents / totalComponents) * 100);

    if (classPercentage > 20) {
      recommendations.push(
        `🔄 ${classPercentage}% des composants sont des classes - Migrer progressivement vers fonction components pour React 18`
      );
    }

    const deprecatedCount = componentAnalysis.filter(c => c.hasDeprecatedLifecycle).length;
    if (deprecatedCount > 0) {
      recommendations.push(
        `⚠️  ${deprecatedCount} composants utilisent lifecycle methods obsolètes - Migration critique requise`
      );
    }

    const react18Adoption = componentAnalysis.filter(c => c.usesReact18Features).length;
    const adoptionPercentage = Math.round((react18Adoption / totalComponents) * 100);
    if (adoptionPercentage < 10) {
      recommendations.push(
        `📈 Seulement ${adoptionPercentage}% des composants utilisent React 18 features - Opportunité d'optimisation`
      );
    }

    if (optimizationOpportunities.length > 0) {
      recommendations.push(
        `🚀 ${optimizationOpportunities.length} opportunités d'optimisation identifiées - Prioriser par impact performance`
      );
    }

    recommendations.push(
      `✅ Utiliser React DevTools Profiler pour identifier bottlenecks de performance`,
      `✅ Implémenter code splitting avec React.lazy pour réduire bundle size`,
      `✅ Considérer Server Components pour améliorer SSR performance (Remix compatible)`
    );

    return recommendations;
  }

  // ═══════════════════════════════════════════════════════════════
  // KPIs CALCULATION
  // ═══════════════════════════════════════════════════════════════

  private calculateKPIs(
    breakingChanges: ReactBreakingChange[],
    componentAnalysis: ComponentAnalysis[],
    optimizationOpportunities: OptimizationOpportunity[]
  ): {
    criticalBreakingChanges: number;
    deprecatedPatternsCount: number;
    react18AdoptionScore: number;
    optimizationPotential: number;
  } {
    const criticalBreakingChanges = breakingChanges.filter(
      bc => bc.severity === 'critical' || bc.severity === 'high'
    ).length;

    const deprecatedPatternsCount = componentAnalysis.filter(
      c => c.hasDeprecatedLifecycle
    ).length;

    const react18Users = componentAnalysis.filter(c => c.usesReact18Features).length;
    const react18AdoptionScore = Math.round((react18Users / componentAnalysis.length) * 100);

    const highImpactOpportunities = optimizationOpportunities.filter(
      o => o.severity === 'high'
    ).length;
    const optimizationPotential = highImpactOpportunities;

    return {
      criticalBreakingChanges,
      deprecatedPatternsCount,
      react18AdoptionScore,
      optimizationPotential,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORTS GENERATION
  // ═══════════════════════════════════════════════════════════════

  private saveReports(report: UpgradeReactReport): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // JSON Report
    const jsonPath = path.join(this.reportsDir, 'upgrade-react.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Markdown Report
    const mdPath = path.join(this.reportsDir, 'upgrade-react.md');
    fs.writeFileSync(mdPath, this.generateMarkdownReport(report));

    // Migration Script (si nécessaire)
    if (report.breakingChanges.length > 0) {
      const scriptPath = path.join(this.reportsDir, 'migrate-react-18.sh');
      fs.writeFileSync(scriptPath, this.generateMigrationScript(report));
      fs.chmodSync(scriptPath, '755');
    }

    console.log(`💾 Reports sauvegardés:`);
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${mdPath}`);
    if (report.breakingChanges.length > 0) {
      console.log(`   - ${path.join(this.reportsDir, 'migrate-react-18.sh')}`);
    }
  }

  private generateMarkdownReport(report: UpgradeReactReport): string {
    const md: string[] = [];

    md.push('# 🔍 Rapport: Upgrade React Analyzer\n');
    md.push(`**Généré le:** ${new Date(report.timestamp).toLocaleString('fr-FR')}\n`);
    md.push('---\n');

    // Version
    md.push('## 📦 Version React\n');
    md.push(`- **Version actuelle:** ${report.version.current}`);
    md.push(`- **Version cible:** ${report.version.target}`);
    md.push(`- **À jour:** ${report.version.isUpToDate ? '✅' : '❌'}`);
    md.push(`- **Utilise React 18 features:** ${report.version.hasReact18Features ? '✅' : '❌'}\n`);

    // KPIs
    md.push('## 📊 KPIs\n');
    md.push(`| Métrique | Valeur |`);
    md.push(`|----------|--------|`);
    md.push(`| Composants analysés | ${report.componentsAnalyzed} |`);
    md.push(`| Breaking changes critiques | ${report.kpis.criticalBreakingChanges} |`);
    md.push(`| Patterns obsolètes | ${report.kpis.deprecatedPatternsCount} |`);
    md.push(`| Score adoption React 18 | ${report.kpis.react18AdoptionScore}% |`);
    md.push(`| Potentiel optimisation | ${report.kpis.optimizationPotential} |`);
    md.push('');

    // Breaking Changes
    md.push('## 🚨 Breaking Changes\n');
    if (report.breakingChanges.length === 0) {
      md.push('✅ Aucun breaking change détecté.\n');
    } else {
      for (const bc of report.breakingChanges) {
        const severity = bc.severity === 'critical' ? '🔴' : bc.severity === 'high' ? '🟠' : bc.severity === 'medium' ? '🟡' : '🟢';
        md.push(`### ${severity} ${bc.id}: ${bc.title}\n`);
        md.push(`**Catégorie:** ${bc.category}`);
        md.push(`**Sévérité:** ${bc.severity.toUpperCase()}`);
        md.push(`**Effort:** ${bc.effort}\n`);
        md.push(`**Description:**`);
        md.push(`${bc.description}\n`);
        md.push(`**Fichiers affectés:** ${bc.affectedFiles.length}`);
        if (bc.affectedFiles.length <= 5) {
          bc.affectedFiles.forEach(f => md.push(`- \`${f}\``));
        } else {
          bc.affectedFiles.slice(0, 5).forEach(f => md.push(`- \`${f}\``));
          md.push(`- ... et ${bc.affectedFiles.length - 5} autres`);
        }
        md.push('');
        md.push(`**Recommandation:**`);
        md.push(`${bc.recommendation}\n`);
        
        if (bc.codeExample) {
          md.push(`**Exemple de migration:**\n`);
          md.push('**Avant:**');
          md.push('```tsx');
          md.push(bc.codeExample.before);
          md.push('```\n');
          md.push('**Après:**');
          md.push('```tsx');
          md.push(bc.codeExample.after);
          md.push('```\n');
        }
      }
    }

    // Optimization Opportunities
    md.push('## 🚀 Opportunités d\'Optimisation\n');
    if (report.optimizationOpportunities.length === 0) {
      md.push('✅ Aucune opportunité majeure détectée.\n');
    } else {
      for (const opp of report.optimizationOpportunities) {
        const severity = opp.severity === 'high' ? '🔴' : opp.severity === 'medium' ? '🟡' : '🟢';
        md.push(`### ${severity} ${opp.type.toUpperCase()}\n`);
        md.push(`**Description:** ${opp.description}\n`);
        md.push(`**Impact estimé:** ${opp.estimatedImpact}\n`);
        md.push(`**Implémentation:** ${opp.implementation}\n`);
        md.push(`**Fichiers concernés:** ${opp.affectedFiles.length}`);
        if (opp.affectedFiles.length <= 5) {
          opp.affectedFiles.forEach(f => md.push(`- \`${f}\``));
        }
        md.push('');
      }
    }

    // Dependencies
    md.push('## 📦 Dépendances\n');
    md.push(`| Package | Version Actuelle | Dernière Version | Mise à jour |`);
    md.push(`|---------|------------------|------------------|-------------|`);
    for (const dep of report.dependencies) {
      const status = dep.needsUpdate ? '⚠️  OUI' : '✅ À jour';
      md.push(`| ${dep.package} | ${dep.currentVersion} | ${dep.latestVersion} | ${status} |`);
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
    md.push(`*Rapport généré par AI Agent 7: Upgrade React Analyzer*`);

    return md.join('\n');
  }

  private generateMigrationScript(report: UpgradeReactReport): string {
    const script: string[] = [];

    script.push('#!/bin/bash');
    script.push('');
    script.push('# ═══════════════════════════════════════════════════════════════');
    script.push('# React 18 Migration Script');
    script.push(`# Generated: ${new Date(report.timestamp).toLocaleString('fr-FR')}`);
    script.push('# ═══════════════════════════════════════════════════════════════');
    script.push('');
    script.push('set -e  # Exit on error');
    script.push('');
    script.push('echo "🚀 Starting React 18 migration..."');
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

    script.push('echo "🎉 React 18 migration completed!"');
    script.push('echo ""');
    script.push('echo "Next steps:"');
    script.push('echo "1. Run tests: npm run test"');
    script.push('echo "2. Build project: npm run build"');
    script.push('echo "3. Deploy to staging"');
    script.push('echo "4. Monitor performance"');

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
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
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

  private relativePath(absolutePath: string): string {
    return path.relative(this.rootDir, absolutePath);
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════

// Exported for standalone usage and testing
export async function runUpgradeReactAgent(rootDir?: string): Promise<UpgradeReactReport> {
  const agent = new UpgradeReactAgent(rootDir);
  return await agent.analyze();
}
