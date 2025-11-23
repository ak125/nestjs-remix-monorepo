const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cxpojprgwgubzjyqzmoq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MzQ1OTUsImV4cCI6MjA2ODExMDU5NX0.4sdE4f8QRwDU1De5-Kf8ZCD1otS8mgTRBds1I0gYDOg'
);

async function checkLogos() {
  const { data, error } = await supabase
    .from('rack_marque')
    .select('marque_id, marque_name, marque_logo')
    .not('marque_logo', 'is', null)
    .limit(10);

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log('✅ Marques avec logos:', data);
  
  // Test d'une URL
  if (data.length > 0) {
    const testUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/marques-equipementiers/${data[0].marque_logo}`;
    console.log('\n🔗 URL test:', testUrl);
  }
}

checkLogos();
