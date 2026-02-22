const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const mainJsPath = path.join(__dirname, 'dist', 'main.js');
const maxWaitTime = 120000; // 2 minutes
const checkIntervalMs = 500; // Check every 500ms
let elapsed = 0;

// 🧹 Auto-cleanup old processes to prevent port conflicts and memory leaks
function cleanupOldProcesses() {
  console.log('🧹 Checking for old dev processes...');

  const currentPid = process.pid;
  const parentPid = process.ppid;

  // Helper: kill OLD processes matching a pattern (older than minAgeSec seconds)
  // This avoids killing sibling processes from the same turbo run
  function killOldByPattern(pattern, minAgeSec = 30) {
    try {
      // Get PIDs with their elapsed time (seconds since start)
      const lines = execSync(
        `ps -eo pid,etimes,args | grep -F "${pattern}" | grep -v grep || true`,
        { encoding: 'utf-8' }
      ).trim().split('\n').filter(Boolean);

      let killed = 0;
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0]);
        const ageSec = parseInt(parts[1]);
        if (!pid || pid === currentPid || pid === parentPid) return;
        if (ageSec < minAgeSec) return; // Skip fresh processes (sibling turbo tasks)
        console.log(`   Killing old process PID ${pid} (${pattern}, age ${ageSec}s)`);
        execSync(`kill -9 ${pid} 2>/dev/null || true`);
        killed++;
      });
      return killed;
    } catch (e) {
      return 0;
    }
  }

  // Phase 1: Always kill orphan watchers (tsc, tsup) — they accumulate across restarts
  const watcherPatterns = [
    'tsc --build --watch',
    'tsc --watch',
    'tsup --watch',
  ];

  let watchersKilled = 0;
  watcherPatterns.forEach(pattern => {
    watchersKilled += killOldByPattern(pattern, 30);
  });

  if (watchersKilled > 0) {
    console.log(`   Killed ${watchersKilled} orphan watcher(s)`);
  }

  // Phase 2: Kill server processes only if port 3000 is occupied
  const serverPatterns = [
    'node dist/main',
    'nodemon.*dist',
  ];

  try {
    const portCheck = execSync('ss -tlnp | grep ":3000 " || true', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (portCheck) {
      console.log('⚠️  Port 3000 is in use, cleaning up old server processes...');
      serverPatterns.forEach(pattern => killOldByPattern(pattern, 5));
      console.log('   Waiting for port to be released...');
      execSync('sleep 2');
    }
  } catch (error) {
    console.log('⚠️  Could not check port status:', error.message);
  }

  console.log('✅ Process cleanup done');
}

// 🚀 Auto-start Redis with Docker
async function ensureRedisRunning() {
  console.log('🔍 Checking Redis status...');
  
  try {
    // Check if redis-dev container exists and is running
    const containerStatus = execSync('docker ps -a --filter "name=redis-dev" --format "{{.Status}}"', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    if (containerStatus.startsWith('Up')) {
      console.log('✅ Redis is already running');
      return true;
    }
    
    // Check if container exists but is stopped
    if (containerStatus) {
      console.log('🔄 Starting existing Redis container...');
      execSync('docker start redis-dev', { stdio: 'inherit' });
      console.log('✅ Redis started');
      return true;
    }
    
    // Container doesn't exist, create it
    console.log('🐳 Creating and starting Redis container...');
    execSync('docker run -d --name redis-dev -p 6379:6379 redis:7-alpine', { stdio: 'inherit' });
    console.log('✅ Redis container created and started');
    
    // Wait a bit for Redis to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
    
  } catch (error) {
    // Docker might not be running or not installed
    if (error.message && error.message.includes('Cannot connect to the Docker daemon')) {
      console.log('⚠️  Docker is not running. Please start Docker Desktop.');
      console.log('   The application will start without Redis cache (degraded mode).');
      return false;
    }
    
    if (error.message && error.message.includes('is not recognized')) {
      console.log('⚠️  Docker is not installed.');
      console.log('   The application will start without Redis cache (degraded mode).');
      return false;
    }
    
    // Other error, try to continue
    console.log('⚠️  Could not start Redis:', error.message);
    console.log('   The application will start without Redis cache (degraded mode).');
    return false;
  }
}

/**
 * 🔄 ENV FILE WATCHER
 *
 * Problème résolu: Page blanche + boucle infinie après modification .env
 *
 * Cause: Vite garde les anciennes valeurs d'environnement en cache.
 * Quand .env change, le serveur SSR et le client ont des valeurs différentes,
 * causant un mismatch d'hydration React → page blanche → boucle HMR.
 *
 * Solution: Surveiller .env et redémarrer automatiquement quand il change.
 *
 * @see https://github.com/ak125/nestjs-remix-monorepo - commit fix(dev): env watcher
 */
function watchEnvFile() {
  const envPath = path.join(__dirname, '.env');
  let debounceTimer = null;

  // Vérifier que le fichier existe
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  Fichier .env non trouvé, watcher désactivé');
    return;
  }

  console.log('👀 Surveillance du fichier .env activée');

  fs.watch(envPath, (eventType) => {
    if (eventType === 'change') {
      // Debounce pour éviter les redémarrages multiples (éditions rapides)
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔄 FICHIER .env MODIFIÉ - Redémarrage automatique...');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');

        // Nettoyer le cache Vite pour éviter les modules stale
        // C'est CRITIQUE pour éviter le mismatch SSR/client
        const viteCachePath = path.join(__dirname, '..', 'frontend', 'node_modules', '.vite');
        if (fs.existsSync(viteCachePath)) {
          try {
            fs.rmSync(viteCachePath, { recursive: true, force: true });
            console.log('🧹 Cache Vite nettoyé');
          } catch (err) {
            console.warn('⚠️  Impossible de nettoyer le cache Vite:', err.message);
          }
        }

        // Envoyer SIGUSR2 pour redémarrer nodemon proprement
        // (nodemon écoute ce signal pour un restart graceful)
        console.log('🔁 Envoi du signal de redémarrage à nodemon...');
        process.kill(process.pid, 'SIGUSR2');
      }, 1000); // Attendre 1s pour éviter les faux positifs
    }
  });
}

// Main startup
(async () => {
  // First, cleanup any old processes blocking port 3000
  cleanupOldProcesses();

  // Then, ensure Redis is running
  await ensureRedisRunning();

  // Activer la surveillance du fichier .env
  watchEnvFile();
  
  console.log('\n⏳ Waiting for initial TypeScript compilation to complete...');
  console.log(`   Looking for: ${mainJsPath}`);

  const intervalId = setInterval(() => {
    if (fs.existsSync(mainJsPath)) {
      clearInterval(intervalId);
      console.log('✅ Compilation complete! Starting nodemon...\n');
      
      // Start nodemon
      const nodemon = spawn('nodemon', ['--delay', '2000ms', '--watch', 'dist', 'dist/main.js'], {
        stdio: 'inherit',
        shell: true
      });
      
      nodemon.on('error', (error) => {
        console.error('Failed to start nodemon:', error);
        process.exit(1);
      });
      
      nodemon.on('exit', (code) => {
        process.exit(code || 0);
      });
      
    } else if (elapsed >= maxWaitTime) {
      clearInterval(intervalId);
      console.error('❌ Timeout: dist/main.js was not created after 2 minutes');
      console.error('   Please check TypeScript compilation errors');
      process.exit(1);
    } else {
      elapsed += checkIntervalMs;
      if (elapsed % 5000 === 0) {
        console.log(`   Still waiting... (${elapsed / 1000}s)`);
      }
    }
  }, checkIntervalMs);
})();
