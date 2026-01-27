import fs from 'fs';

const TOKEN = "sbp_3985705a56e1f265447aed1ef6ff51e4e6c1c091";
const PROJECT_ID = "cxpojprgwgubzjyqzmoq";

// Read SQL file
const sql = fs.readFileSync('sql/fix-rpc-v3-integer-cast.sql', 'utf8');

console.log('SQL file size:', sql.length, 'bytes');
console.log('Deploying RPC V7 fix to Supabase...');

// Send to Supabase API
const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
});

const result = await response.text();
console.log('Response status:', response.status);
console.log('Response:', result.substring(0, 500));

if (response.ok) {
  console.log('✅ RPC V6 deployed successfully!');

  // Test the function
  console.log('\nTesting RPC V3...');
  const testResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: "SELECT (get_pieces_for_type_gamme_v3(100413, 42))->>'version' as version" })
  });
  const testResult = await testResponse.json();
  console.log('Version:', testResult[0]?.version || 'unknown');
} else {
  console.log('❌ Deployment failed');
  process.exit(1);
}
