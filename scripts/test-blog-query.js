const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('Testing blog articles with ba_create...\n');
  
  const { data, error } = await supabase
    .from('__blog_advice')
    .select('ba_id, ba_alias, ba_create')
    .limit(5);
  
  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('SUCCESS - Found', data.length, 'articles:');
    data.forEach(a => console.log(' -', a.ba_create, a.ba_alias));
    
    // Check years
    const years = [...new Set(data.map(a => new Date(a.ba_create).getFullYear()))];
    console.log('\nYears found:', years.join(', '));
  }
}

test();
