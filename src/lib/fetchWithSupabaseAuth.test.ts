import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchWithSupabaseAuth } from './fetchWithSupabaseAuth'

const supabaseMock = vi.hoisted(() => {
    const supabase = {
        auth: {
            getSession: vi.fn(),
            signOut: vi.fn(),
        },
    }
    return {
        supabase,
        getSupabase: () => supabase,
    }
})

vi.mock('./supabase', () => ({
    supabase: supabaseMock.supabase,
    getSupabase: supabaseMock.getSupabase,
}))

describe('fetchWithSupabaseAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('adds Authorization header when session exists', async () => {
        supabaseMock.supabase.auth.getSession.mockResolvedValue({
            data: { session: { access_token: 'token-123' } },
        })

        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

        await fetchWithSupabaseAuth('/api/test', { headers: { 'X-Test': 'yes' } })

        expect(fetchSpy).toHaveBeenCalled()
        const [, init] = fetchSpy.mock.calls[0]
        expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-123')
    })

    it('signs out on 401 responses', async () => {
        supabaseMock.supabase.auth.getSession.mockResolvedValue({
            data: { session: { access_token: 'token-123' } },
        })
        vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))

        await fetchWithSupabaseAuth('/api/test')

        expect(supabaseMock.supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    })
})
