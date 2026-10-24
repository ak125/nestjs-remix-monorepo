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

  // Seuls les processus de CE backend/ sont visés : cwd du processus = ce répertoire.
  // Sans ce filtre, le démarrage d'un stack dans n'importe quel worktree de la machine
  // tuait (kill -9) les watchers et le serveur du stack DEV:3000, et inversement.
  // Un cwd illisible (processus disparu, autre utilisateur) n'est jamais tué.
  const ownDir = fs.realpathSync(__dirname);
  const cwdOf = (pid) => {
    try {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch (e) {
      return null;
    }
  };

  // Helper: kill OLD processes matching a pattern (older than minAgeSec seconds)
  // This avoids killing sibling processes from the same turbo run
  function killOldByPattern(pattern, minAgeSec = 30) {
    try {
      // Get PIDs with their elapsed time (seconds since start)
      const lines = execSync('ps -eo pid=,etimes=,args=', { encoding: 'utf-8' })
        .split('\n')
        .filter(Boolean);

      let killed = 0;
      let foreign = 0;
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0]);
        const ageSec = parseInt(parts[1]);
        if (!new RegExp(pattern).test(parts.slice(2).join(' '))) return;
        if (!pid || pid === currentPid || pid === parentPid) return;
        if (ageSec < minAgeSec) return; // Skip fresh processes (sibling turbo tasks)
        if (cwdOf(pid) !== ownDir) {
          foreign++;
          return;
        }
        console.log(`   Killing old process PID ${pid} (${pattern}, age ${ageSec}s)`);
        try {
          process.kill(pid, 'SIGKILL');
          killed++;
        } catch (e) {
          // déjà terminé entre ps et kill
        }
      });
      if (foreign > 0) {
        console.log(`   ${foreign} process(es) ${pattern} hors de ${ownDir} laissé(s) en place`);
      }
      return killed;
    } catch (e) {
      return 0;
    }
  }

  // Phase 1: Always kill orphan watchers (tsc, tsup) — they accumulate across restarts
  const watcherPatterns = [
    'dev-compile-watch.js',
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
  // Motifs lus comme expressions régulières : sous `grep -F`, « nodemon.*dist » était
  // cherché en texte littéral et ne trouvait jamais de nodemon.
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

        // Redémarrer l'app par le watcher de nodemon sur dist/ (arrêt gracieux compris).
        // Jamais de signal à ce processus : sans handler, SIGUSR2 le tue, et run-p arrête
        // alors toute la chaîne dev (tsc, tsc-alias, nodemon). Sans dist/main.js, nodemon
        // n'a pas encore démarré : son premier démarrage lira le nouveau .env.
        if (fs.existsSync(mainJsPath)) {
          console.log('🔁 Redémarrage de l\'app (dist/main.js touché)...');
          const now = new Date();
          fs.utimesSync(mainJsPath, now, now);
        }
      }, 1000); // Attendre 1s pour éviter les faux positifs
    }
  });
}

/**
 * 🔁 RELANCE APRÈS CRASH
 *
 * Sans --exitcrash, nodemon attend une modification de fichier après un crash de
 * l'app : le backend DEV restait arrêté jusqu'au prochain changement de code ou à
 * une intervention manuelle. Avec --exitcrash, nodemon sort en code 1 ; il est
 * relancé ici avec un délai croissant, remis au minimum après une exécution stable.
 * Chaque relance écrit une ligne DEV_APP_CRASH : sous le service systemd elle
 * arrive dans le journal, où scripts/ops/sync-dev-runtime.sh compte les crashs.
 */
const RESPAWN_MIN_MS = 2000;
const RESPAWN_MAX_MS = 30000;
const STABLE_RUN_MS = 60000;
let respawnDelayMs = RESPAWN_MIN_MS;
let crashCount = 0;

function startNodemon() {
  const startedAt = Date.now();
  const nodemon = spawn('nodemon', ['--exitcrash', '--delay', '2000ms', '--watch', 'dist', 'dist/main.js'], {
    stdio: 'inherit',
    shell: true
  });

  nodemon.on('error', (error) => {
    console.error('Failed to start nodemon:', error);
    process.exit(1);
  });

  nodemon.on('exit', (code) => {
    // Code 1 = crash de l'app (--exitcrash). Tout autre code reprend l'ancien
    // comportement : 0, nodemon tué par un signal (le shell intermédiaire rend
    // 128 + n), 127 nodemon introuvable — relancer ne changerait rien.
    if (code !== 1) {
      process.exit(code || 0);
    }
    if (Date.now() - startedAt >= STABLE_RUN_MS) {
      respawnDelayMs = RESPAWN_MIN_MS;
    }
    crashCount++;
    console.error(`DEV_APP_CRASH count=${crashCount} exit=${code} restart_in=${respawnDelayMs / 1000}s`);
    setTimeout(startNodemon, respawnDelayMs);
    respawnDelayMs = Math.min(respawnDelayMs * 2, RESPAWN_MAX_MS);
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

  // tsc emits dist/**/*.js with `require("@auth/...")` placeholders;
  // tsc-alias rewrites them into relative paths AFTER tsc finishes.
  // Booting nodemon before that race lands → MODULE_NOT_FOUND on @alias
  // — and the failing file may be config/app.config.js, not main.js,
  // so we cannot just check main.js. Use grep -rl to scan the whole dist/.
  const ALIAS_GREP_PATTERN = "require([\"']@(auth|cache|common|config|database|security|modules)/";

  const distHasAliasResidual = () => {
    try {
      // grep -l (any hit), -r (recursive), -E (regex), --include for .js only.
      // Returns 0 if hit found, 1 if not. Use child_process.execSync.
      const { execSync } = require('child_process');
      execSync(
        `grep -rlE '${ALIAS_GREP_PATTERN}' --include='*.js' ${path.join(__dirname, 'dist')}`,
        { stdio: 'pipe' }
      );
      return true; // exit 0 = at least one file still has @alias residual
    } catch (e) {
      return false; // exit 1 = no match = dist/ is clean
    }
  };

  const intervalId = setInterval(() => {
    if (fs.existsSync(mainJsPath)) {
      if (distHasAliasResidual()) {
        // tsc compiled but tsc-alias has not transformed all files yet — wait.
        elapsed += checkIntervalMs;
        if (elapsed % 5000 === 0) {
          console.log(`   Waiting for tsc-alias to finish (dist/ still has @alias residuals)… (${elapsed / 1000}s)`);
        }
        return;
      }
      clearInterval(intervalId);
      console.log('✅ Compilation complete! Starting nodemon...\n');
      startNodemon();

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
