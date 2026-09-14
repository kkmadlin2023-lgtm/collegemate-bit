import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://bzvwqhgwnrigvypjttmf.supabase.co';
const defaultAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6dndxaGd3bnJpZ3Z5cGp0dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNTQ5NjksImV4cCI6MjEwNDkzMDk2OX0.A9zM35xbQRiQ2YMx99GHA1iINXtuI-4yph8eVFXBNC0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultAnonKey;

export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'campusmate_auth_token',
  },
});
