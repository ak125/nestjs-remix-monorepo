require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const Redis = require("ioredis");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("SUPABASE_URL:", supabaseUrl ? "SET" : "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "SET" : "MISSING");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
});

const CACHE_KEY = "homepage:rpc:v1";
const CACHE_TTL = 300;
const RPC_TIMEOUT = 2000;

async function test() {
  const startTime = Date.now();
  
  console.log("1. Checking cache...");
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    console.log("   CACHE HIT (" + cached.length + " chars)");
    redis.disconnect();
    return;
  }
  console.log("   CACHE MISS");

  console.log("2. Calling RPC with " + RPC_TIMEOUT + "ms timeout...");
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("RPC_TIMEOUT")), RPC_TIMEOUT);
  });
  
  const rpcPromise = supabase.rpc("get_homepage_data_optimized");
  
  let result;
  try {
    result = await Promise.race([rpcPromise, timeoutPromise]);
  } catch (e) {
    console.log("   RACE ERROR:", e.message);
    redis.disconnect();
    return;
  }
  
  const { data, error: rpcError } = result;
  
  if (rpcError) {
    console.log("   RPC ERROR:", JSON.stringify(rpcError));
    redis.disconnect();
    return;
  }
  
  console.log("   RPC SUCCESS in " + (Date.now() - startTime) + "ms");
  
  console.log("3. Validating data...");
  console.log("   data.success = " + (data && data.success));
  
  if (data === null || data === undefined || data.success !== true) {
    console.log("   INVALID DATA!");
    redis.disconnect();
    return;
  }
  
  console.log("4. Caching result...");
  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
  console.log("   CACHED OK");
  
  console.log("\n✅ ALL TESTS PASSED");
  console.log("Data keys:", Object.keys(data));
  redis.disconnect();
}

test().catch(err => {
  console.log("ERROR:", err.message);
  redis.disconnect();
});
