/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_PUBLIC_SUPABASE_ANON_KEY: string
    readonly VITE_SUPABASE_DEBUG_AUTH: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
