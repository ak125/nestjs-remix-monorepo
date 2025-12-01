const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const mainJsPath = path.join(__dirname, 'dist', 'main.js');
const maxWaitTime = 120000; // 2 minutes
const checkIntervalMs = 500; // Check every 500ms
let elapsed = 0;

console.log('⏳ Waiting for initial TypeScript compilation to complete...');
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
