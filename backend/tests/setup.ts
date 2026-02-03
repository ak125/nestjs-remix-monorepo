/**
 * Jest Setup File
 *
 * This file runs BEFORE all tests to configure the test environment.
 * It loads environment variables from .env.test for Supabase credentials.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test BEFORE any test runs
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Log loaded environment (debug only - comment out in CI)
// console.log('Test environment loaded:', {
//   SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
//   SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
// });
