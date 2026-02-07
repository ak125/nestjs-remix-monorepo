require("dotenv").config();

// Import the compiled service
const { HomepageRpcService } = require("./dist/modules/catalog/services/homepage-rpc.service");
const { CacheService } = require("./dist/cache/cache.service");  // Use the one from src/cache/
const { ConfigService } = require("@nestjs/config");

// Mock ConfigService
class MockConfigService {
  get(key, defaultValue) {
    return process.env[key] || defaultValue;
  }
}

async function test() {
  try {
    console.log("1. Creating CacheService...");
    const configService = new MockConfigService();
    const cacheService = new CacheService(configService);
    
    // Wait for cache service to initialize
    if (cacheService.onModuleInit) {
      console.log("   Calling onModuleInit...");
      await cacheService.onModuleInit();
    }
    
    console.log("2. Creating HomepageRpcService...");
    const homepageRpcService = new HomepageRpcService(cacheService);
    
    console.log("3. Calling getHomepageDataOptimized...");
    const result = await homepageRpcService.getHomepageDataOptimized();
    
    console.log("\n✅ SUCCESS");
    console.log("Keys:", Object.keys(result));
    process.exit(0);
  } catch (error) {
    console.log("\n❌ ERROR:", error.message);
    console.log("Stack:", error.stack);
    process.exit(1);
  }
}

test();
