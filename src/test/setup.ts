import '@testing-library/jest-dom'

// Mock environment variables for testing
// These are required by src/lib/supabase.ts which is imported by many components
Object.assign(import.meta.env, {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_SUPABASE_DEBUG_AUTH: 'false',
});
