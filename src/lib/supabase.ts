import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://hfvhiirrmfpnukynwody.supabase.co') as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmdmhpaXJybWZwbnVreW53b2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzIzNDMsImV4cCI6MjEwMDcwODM0M30.PE7u_FC_jL92aRqSkNRJOOb4-nqQjoT9niWsXmCiomI') as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
