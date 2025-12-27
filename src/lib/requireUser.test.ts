import { describe, it, expect, beforeEach, vi } from 'vitest'
import { requireUser, AuthRequiredError } from './requireUser'

const supabaseMock = vi.hoisted(() => {
    const supabase = {
        auth: {
            getUser: vi.fn(),
            getSession: vi.fn(),
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

describe('requireUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns user from getUser when available', async () => {
        supabaseMock.supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        })

        const user = await requireUser()
        expect(user.id).toBe('user-1')
    })

    it('falls back to session when getUser fails', async () => {
        supabaseMock.supabase.auth.getUser.mockRejectedValue(new Error('offline'))
        supabaseMock.supabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'user-2' } } },
        })

        const user = await requireUser()
        expect(user.id).toBe('user-2')
    })

    it('throws AuthRequiredError when no user is available', async () => {
        supabaseMock.supabase.auth.getUser.mockRejectedValue(new Error('offline'))
        supabaseMock.supabase.auth.getSession.mockResolvedValue({
            data: { session: null },
        })

        await expect(requireUser()).rejects.toBeInstanceOf(AuthRequiredError)
    })

    it('falls back when getUser returns an error result', async () => {
        supabaseMock.supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: new Error('missing session'),
        })
        supabaseMock.supabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'user-3' } } },
        })

        const user = await requireUser()
        expect(user.id).toBe('user-3')
    })
})
