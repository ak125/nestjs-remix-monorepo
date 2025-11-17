#!/usr/bin/env node
/**
 * 🔍 Script de diagnostic des problèmes de performance
 * 
 * Analyse:
 * - Requêtes répétées dans les logs
 * - Temps de réponse par endpoint
 * - Patterns de cache hit/miss
 * - Recommendations d'optimisation
 * 
 * Usage: node diagnose-performance.js [logs-file]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SLOW_THRESHOLD_MS = 1000; // Requêtes > 1s considérées lentes
const DUPLICATE_THRESHOLD = 3; // Alerte si même requête > 3x en 10s

class PerformanceAnalyzer {
  constructor() {
    this.requests = [];
    this.endpoints = new Map();
    this.cacheStats = { hits: 0, misses: 0 };
    this.slowQueries = [];
    this.duplicates = new Map();
  }

  /**
   * Analyser les logs depuis stdin ou fichier
   */
  async analyzeLogs(input) {
    console.log('🔍 Analyse des logs en cours...\n');
    
    const lines = input.split('\n');
    let currentTime = null;
    const requestWindow = new Map(); // Fenêtre glissante 10s pour détection duplicates

    for (const line of lines) {
      // Extraire timestamp
      const timeMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M)/);
      if (timeMatch) {
        currentTime = new Date(timeMatch[1]);
      }

      // Détecter endpoints API
      const endpointMatch = line.match(/\[([A-Z]+)\] (\/api\/[^\s]+)/);
      if (endpointMatch) {
        const [, method, endpoint] = endpointMatch;
        const key = `${method} ${endpoint}`;
        
        if (!this.endpoints.has(key)) {
          this.endpoints.set(key, { count: 0, times: [], endpoint, method });
        }
        this.endpoints.get(key).count++;

        // Fenêtre glissante pour duplicates
        if (currentTime) {
          if (!requestWindow.has(key)) {
            requestWindow.set(key, []);
          }
          requestWindow.get(key).push(currentTime.getTime());

          // Nettoyer requêtes > 10s
          const tenSecondsAgo = currentTime.getTime() - 10000;
          requestWindow.set(
            key,
            requestWindow.get(key).filter(t => t >= tenSecondsAgo)
          );

          // Détecter duplicates
          if (requestWindow.get(key).length >= DUPLICATE_THRESHOLD) {
            const count = requestWindow.get(key).length;
            if (!this.duplicates.has(key) || this.duplicates.get(key) < count) {
              this.duplicates.set(key, count);
            }
          }
        }
      }

      // Détecter temps d'exécution
      const timeExecMatch = line.match(/([\d.]+)ms/);
      if (timeExecMatch && endpointMatch) {
        const execTime = parseFloat(timeExecMatch[1]);
        const key = `${endpointMatch[1]} ${endpointMatch[2]}`;
        
        if (this.endpoints.has(key)) {
          this.endpoints.get(key).times.push(execTime);
        }

        if (execTime > SLOW_THRESHOLD_MS) {
          this.slowQueries.push({
            endpoint: endpointMatch[2],
            method: endpointMatch[1],
            time: execTime,
            line: line.substring(0, 150)
          });
        }
      }

      // Détecter cache hits/misses
      if (line.includes('Cache HIT') || line.includes('⚡ Cache HIT')) {
        this.cacheStats.hits++;
      } else if (line.includes('Cache MISS') || line.includes('🔍 Cache MISS')) {
        this.cacheStats.misses++;
      }

      // Détecter requêtes Supabase
      const supabaseMatch = line.match(/\[PARALLEL\] (\d+) relations → (\d+) pièces/);
      if (supabaseMatch) {
        const [, relations, pieces] = supabaseMatch;
        // Analyser complexité requêtes
      }
    }

    this.generateReport();
  }

  /**
   * Générer rapport d'analyse
   */
  generateReport() {
    console.log('=' .repeat(80));
    console.log('📊 RAPPORT DE PERFORMANCE'.padStart(50));
    console.log('='.repeat(80));
    console.log();

    // 1. Endpoints les plus appelés
    console.log('🔥 TOP 10 ENDPOINTS LES PLUS APPELÉS');
    console.log('-'.repeat(80));
    const sortedByCount = [...this.endpoints.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    sortedByCount.forEach(([key, data], i) => {
      const avgTime = data.times.length > 0
        ? (data.times.reduce((a, b) => a + b, 0) / data.times.length).toFixed(0)
        : 'N/A';
      console.log(`${i + 1}. ${key}`);
      console.log(`   📊 Appels: ${data.count}x | ⏱️  Temps moyen: ${avgTime}ms`);
    });
    console.log();

    // 2. Requêtes répétées (duplicates)
    if (this.duplicates.size > 0) {
      console.log('⚠️  REQUÊTES RÉPÉTÉES DÉTECTÉES');
      console.log('-'.repeat(80));
      const sortedDuplicates = [...this.duplicates.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      sortedDuplicates.forEach(([key, count]) => {
        console.log(`❌ ${key}`);
        console.log(`   🔁 ${count} appels consécutifs en < 10s`);
        
        // Recommendations
        if (key.includes('/equipementiers')) {
          console.log('   💡 Recommandation: Implémenter cache React Query avec staleTime: 300000');
        } else if (key.includes('/hierarchy')) {
          console.log('   💡 Recommandation: Charger dans root.tsx loader, utiliser useMatches()');
        } else if (key.includes('/conseils') || key.includes('/advice')) {
          console.log('   💡 Recommandation: Cache frontend + defer pour streaming');
        }
      });
      console.log();
    }

    // 3. Requêtes lentes
    if (this.slowQueries.length > 0) {
      console.log('🐌 REQUÊTES LENTES (> 1s)');
      console.log('-'.repeat(80));
      const uniqueSlow = [...new Map(this.slowQueries.map(q => [q.endpoint, q])).values()]
        .sort((a, b) => b.time - a.time)
        .slice(0, 10);

      uniqueSlow.forEach((query, i) => {
        console.log(`${i + 1}. ${query.method} ${query.endpoint}`);
        console.log(`   ⏱️  ${query.time.toFixed(0)}ms`);
        
        // Recommendations
        if (query.endpoint.includes('/seo')) {
          console.log('   💡 Paralléliser getVehicleInfo (type + marque + modèle)');
        } else if (query.endpoint.includes('/pieces')) {
          console.log('   💡 Ajouter index DB: (rtp_type_id, rtp_pg_id, rtp_display)');
        } else if (query.endpoint.includes('/cross-selling')) {
          console.log('   💡 Cache Redis + index sur pieces_gamme_cross.pgc_pg_id');
        }
      });
      console.log();
    }

    // 4. Statistiques cache
    console.log('💾 STATISTIQUES CACHE REDIS');
    console.log('-'.repeat(80));
    const totalCache = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = totalCache > 0
      ? ((this.cacheStats.hits / totalCache) * 100).toFixed(1)
      : '0.0';
    
    console.log(`✅ Cache Hits:   ${this.cacheStats.hits}`);
    console.log(`❌ Cache Misses: ${this.cacheStats.misses}`);
    console.log(`📊 Hit Rate:     ${hitRate}%`);
    
    if (parseFloat(hitRate) < 50) {
      console.log('\n⚠️  WARNING: Taux de cache < 50%, optimisations nécessaires!');
      console.log('💡 Suggestions:');
      console.log('   - Augmenter TTL pour données statiques (équipementiers, hierarchy)');
      console.log('   - Implémenter warm-up cache au démarrage');
      console.log('   - Vérifier clés de cache (composite keys pour SEO)');
    }
    console.log();

    // 5. Recommendations globales
    console.log('🎯 RECOMMENDATIONS PRIORITAIRES');
    console.log('-'.repeat(80));
    
    const recommendations = [];
    
    if (this.duplicates.size > 3) {
      recommendations.push({
        priority: '🔴 HAUTE',
        issue: 'Requêtes répétées massives détectées',
        action: 'Implémenter React Query/SWR avec dedupe + staleTime'
      });
    }

    if (this.slowQueries.length > 5) {
      recommendations.push({
        priority: '🟠 MOYENNE',
        issue: 'Multiples requêtes lentes (> 1s)',
        action: 'Paralléliser requêtes Supabase + ajouter index DB'
      });
    }

    if (parseFloat(hitRate) < 50 && totalCache > 10) {
      recommendations.push({
        priority: '🟡 BASSE',
        issue: 'Taux de cache insuffisant',
        action: 'Augmenter TTL Redis + warm-up cache'
      });
    }

    if (recommendations.length === 0) {
      console.log('✅ Aucun problème critique détecté!');
    } else {
      recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec.priority}`);
        console.log(`   ❌ ${rec.issue}`);
        console.log(`   ✅ ${rec.action}`);
        console.log();
      });
    }

    console.log('='.repeat(80));
    console.log('📝 NEXT STEPS:');
    console.log('-'.repeat(80));
    console.log('1. Vérifier frontend/app/routes/_index.tsx pour useEffect duplicates');
    console.log('2. Implémenter React Query dans frontend/app/root.tsx');
    console.log('3. Ajouter index DB: CREATE INDEX idx_rtp_type_pg ON pieces_relation_type(rtp_type_id, rtp_pg_id)');
    console.log('4. Monitorer avec: tail -f logs/nest.log | grep -E "Cache|ms"');
    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const analyzer = new PerformanceAnalyzer();

  // Lire depuis stdin ou fichier
  if (process.stdin.isTTY) {
    // Mode fichier
    const logFile = process.argv[2] || '../logs/nest.log';
    
    if (!fs.existsSync(logFile)) {
      console.error(`❌ Fichier non trouvé: ${logFile}`);
      console.log('\nUsage:');
      console.log('  node diagnose-performance.js [logs-file]');
      console.log('  tail -n 1000 logs/nest.log | node diagnose-performance.js');
      process.exit(1);
    }

    const logs = fs.readFileSync(logFile, 'utf-8');
    await analyzer.analyzeLogs(logs);
  } else {
    // Mode pipe
    let logs = '';
    process.stdin.setEncoding('utf-8');
    
    for await (const chunk of process.stdin) {
      logs += chunk;
    }
    
    await analyzer.analyzeLogs(logs);
  }
}

main().catch(console.error);
