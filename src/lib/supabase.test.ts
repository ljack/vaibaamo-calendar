import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createBrowserClient } from '@supabase/ssr'

vi.mock('@supabase/ssr', () => ({
    createBrowserClient: vi.fn(() => ({
        auth: {
            onAuthStateChange: vi.fn(),
        },
    })),
}))

describe('supabase client', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('creates a singleton client and enables debug hook', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
        vi.stubEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
        vi.stubEnv('VITE_SUPABASE_DEBUG_AUTH', 'true')

        const module = await import('./supabase')
        const client = module.getSupabase()
        const clientAgain = module.getSupabase()

        expect(client).toBe(clientAgain)
        expect(createBrowserClient).toHaveBeenCalledTimes(1)
        expect((client as any).auth.onAuthStateChange).toHaveBeenCalled()
    })

    it('throws when required env vars are missing', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '')
        vi.stubEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', '')

        await expect(import('./supabase')).rejects.toThrow('Missing env var')
    })
})
