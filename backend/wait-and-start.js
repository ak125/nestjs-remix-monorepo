const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const mainJsPath = path.join(__dirname, 'dist', 'main.js');
const maxWaitTime = 120000; // 2 minutes
const checkIntervalMs = 500; // Check every 500ms
let elapsed = 0;

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

// Main startup
(async () => {
  // First, ensure Redis is running
  await ensureRedisRunning();
  
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
