import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { listenToAuthEvents } from './authEvents'

const supabaseMock = vi.hoisted(() => {
    const unsubscribe = vi.fn()
    const onAuthStateChange = vi.fn(() => ({
        data: { subscription: { unsubscribe } },
    }))
    const supabase = {
        auth: {
            onAuthStateChange,
        },
    }
    return {
        supabase,
        getSupabase: () => supabase,
        unsubscribe,
        onAuthStateChange,
    }
})

vi.mock('./supabase', () => ({
    supabase: supabaseMock.supabase,
    getSupabase: supabaseMock.getSupabase,
}))

describe('listenToAuthEvents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('forwards auth events and cleans up', () => {
        const handler = vi.fn()
        const cleanup = listenToAuthEvents(handler)

        expect(supabaseMock.onAuthStateChange).toHaveBeenCalled()

        const callback = supabaseMock.onAuthStateChange.mock.calls[0][0]
        const session = { user: { id: 'user-1' } }
        callback('SIGNED_IN', session)

        expect(handler).toHaveBeenCalledWith('SIGNED_IN', session)

        cleanup()
        expect(supabaseMock.unsubscribe).toHaveBeenCalled()
    })

    it('logs debug output when enabled', async () => {
        vi.resetModules()
        vi.stubEnv('VITE_SUPABASE_DEBUG_AUTH', 'true')

        const unsubscribe = vi.fn()
        const onAuthStateChange = vi.fn(() => ({
            data: { subscription: { unsubscribe } },
        }))
        const supabase = { auth: { onAuthStateChange } }

        vi.doMock('./supabase', () => ({
            getSupabase: () => supabase,
        }))

        const { listenToAuthEvents } = await import('./authEvents')
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => { })

        const handler = vi.fn()
        const cleanup = listenToAuthEvents(handler)

        const callback = onAuthStateChange.mock.calls[0][0]
        callback('SIGNED_OUT', null)

        expect(handler).toHaveBeenCalledWith('SIGNED_OUT', null)
        expect(debugSpy).toHaveBeenCalled()

        cleanup()
        debugSpy.mockRestore()
    })
})
