const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkLatency() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.log('Supabase URL:', url);

  const start = Date.now();
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
  });
  const duration = Date.now() - start;
  console.log('Response status:', res.status);
  console.log('Latency (ms):', duration);
  console.log('Server headers:', res.headers.raw ? res.headers.raw() : res.headers);
}

checkLatency();
