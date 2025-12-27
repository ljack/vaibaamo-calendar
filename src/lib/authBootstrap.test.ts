import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createSupabaseMock = () => ({
    auth: {
        getSession: vi.fn(),
    },
})

const mockConsole = () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const error = vi.spyOn(console, 'error').mockImplementation(() => { })
    return { warn, error }
}

describe('initAuthOnce', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns session when getSession resolves quickly', async () => {
        const supabaseMock = createSupabaseMock()
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } },
            error: null,
        })

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabaseMock,
        }))

        const { initAuthOnce } = await import('./authBootstrap')

        const result = await initAuthOnce(50)
        expect(result.session?.user.id).toBe('user-1')
        expect(result.timedOut).toBe(false)
    })

    it('returns timeout state when session hangs', async () => {
        const supabaseMock = createSupabaseMock()
        supabaseMock.auth.getSession.mockImplementation(() => new Promise(() => { }))

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabaseMock,
        }))

        const { initAuthOnce } = await import('./authBootstrap')
        const { warn } = mockConsole()

        vi.useFakeTimers()
        const promise = initAuthOnce(10)
        vi.advanceTimersByTime(20)
        const result = await promise

        expect(result.timedOut).toBe(true)
        expect(result.error).toMatch(/timed out/i)
        expect(warn).toHaveBeenCalled()
    })

    it('logs when getSession resolves after timeout', async () => {
        const supabaseMock = createSupabaseMock()
        let resolveSession: ((value: any) => void) | null = null
        const sessionPromise = new Promise((resolve) => {
            resolveSession = resolve
        })
        supabaseMock.auth.getSession.mockReturnValue(sessionPromise)

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabaseMock,
        }))

        const { initAuthOnce } = await import('./authBootstrap')
        const { warn } = mockConsole()

        vi.useFakeTimers()
        const promise = initAuthOnce(10)
        vi.advanceTimersByTime(20)
        const result = await promise

        expect(result.timedOut).toBe(true)

        resolveSession?.({
            data: { session: { user: { id: 'late-user' } } },
            error: null,
        })

        await Promise.resolve()

        const hasLateWarning = warn.mock.calls.some(([message]) =>
            String(message).includes('getSession resolved after timeout')
        )
        expect(hasLateWarning).toBe(true)
    })

    it('logs getSession error when debug is enabled', async () => {
        vi.stubEnv('VITE_SUPABASE_DEBUG_AUTH', 'true')
        const supabaseMock = createSupabaseMock()
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: new Error('bad session'),
        })

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabaseMock,
        }))

        const { initAuthOnce } = await import('./authBootstrap')
        const { error } = mockConsole()

        const result = await initAuthOnce(50)
        expect(result.error).toMatch(/bad session/i)
        expect(error).toHaveBeenCalled()
    })

    it('logs getSession resolved when debug is enabled', async () => {
        vi.stubEnv('VITE_SUPABASE_DEBUG_AUTH', 'true')
        const supabaseMock = createSupabaseMock()
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } },
            error: null,
        })

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabaseMock,
        }))

        const { initAuthOnce } = await import('./authBootstrap')
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

        const result = await initAuthOnce(50)
        expect(result.session?.user.id).toBe('user-1')
        expect(logSpy).toHaveBeenCalled()
        logSpy.mockRestore()
    })

    it('captures errors from getSession when debug is enabled', async () => {
        vi.stubEnv('VITE_SUPABASE_DEBUG_AUTH', 'true')
        const supabaseMock = createSupabaseMock()
        supabaseMock.auth.getSession.mockRejectedValue(new Error('boom'))

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabaseMock,
        }))

        const { initAuthOnce } = await import('./authBootstrap')
        const { error } = mockConsole()

        const result = await initAuthOnce(50)
        expect(result.session).toBeNull()
        expect(result.error).toMatch(/boom/i)
        expect(error).toHaveBeenCalled()
    })
})
