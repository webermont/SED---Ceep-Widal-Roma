import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Lazy initialization to prevent crash on startup if keys are missing
let supabaseInstance: any = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL and Anon Key are required. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or the REACT_APP equivalents) in your environment variables.');
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        // Explicitly use global fetch to avoid issues with some environments 
        // trying to polyfill or override it incorrectly
        fetch: (url, options) => fetch(url, options),
      },
    });
  }
  return supabaseInstance;
};

// For backward compatibility but should be used carefully
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: (url, options) => fetch(url, options) }
    })
  : null;
