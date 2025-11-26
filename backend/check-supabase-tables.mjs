import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const supabase = createClient(supabaseUrl, supabaseKey);

const tablesToCheck = [
  '___config',
  '___xtr_admin_users',
  '___xtr_alerts', 
  '___xtr_cms_articles',
  '___xtr_cms_marque_content',
  '___xtr_cms_sites',
  '___xtr_deliveries',
  '___xtr_email_campaigns',
  '___xtr_faq',
  '___xtr_invoices',
  '___xtr_newsletter',
  '___xtr_order_notes',
  '___xtr_shipping',
  '___xtr_tickets',
  '___xtr_user_wishlists'
];

console.log('🔍 Vérification des tables dans Supabase...\n');

for (const table of tablesToCheck) {
  try {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: existe (${count || 0} lignes)`);
    }
  } catch (err) {
    console.log(`❌ ${table}: ${err.message}`);
  }
}
