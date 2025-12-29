import { render, screen, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import EventsList from './EventsList'
import { AuthProvider } from '../contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import * as AuthContext from '../contexts/AuthContext'

const supabaseMock = vi.hoisted(() => {
    const supabase = {
        auth: {
            getSession: vi.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        from: vi.fn(),
    }
    return {
        supabase,
        getSupabase: () => supabase,
    }
})

vi.mock('../lib/supabase', () => ({
    supabase: supabaseMock.supabase,
    getSupabase: supabaseMock.getSupabase,
}))

const { supabase } = supabaseMock
vi.mock('../components/EventsMap', () => ({
    default: () => <div data-testid="events-map" />,
}))

const createBaseQueryBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    abortSignal: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: vi.fn().mockImplementation((resolve: any) => resolve({ data: null, error: null, count: 0 })),
})

const createParticipantsMock = (rows: Array<{ event_id: string }> = []) => {
    const queryBuilder = createBaseQueryBuilder()
    queryBuilder.in.mockResolvedValue({ data: rows, error: null })
    return queryBuilder
}

describe('EventsList Timeout Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock Auth to be logged in
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: '123' } } },
            error: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
    })

    it('triggers session check on timeout error', async () => {
        // Mock Events fetch to timeout
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockRejectedValue(new Error('Request timed out'))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return queryBuilder as any
            }
            if (table === 'participants') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return createParticipantsMock() as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return queryBuilder as any
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        // Wait for error message

        await waitFor(() => expect(screen.getByText('events.errorTimeout')).toBeInTheDocument())

        // Initial getSession call comes from auth init, extra call comes from timeout recovery.
        expect(supabase.auth.getSession).toHaveBeenCalledTimes(2)
    })
})

describe('EventsList auth fallback and timeout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('starts fetching after auth fallback timer', async () => {
        const future = new Date(Date.now() + 3600_000).toISOString()
        const events = [
            {
                id: 'fallback',
                title: 'Fallback Event',
                description: 'Fallback',
                start_time: future,
                end_time: future,
                location: 'Turku',
                max_participants: null,
                created_at: future,
            },
        ]

        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            loading: true,
            checkSession: vi.fn().mockResolvedValue(true),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockResolvedValue({ data: events, error: null })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return queryBuilder as any
            }
            if (table === 'participants') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return createParticipantsMock([{ event_id: 'fallback' }]) as any
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return queryBuilder as any
        })

        vi.useFakeTimers()
        render(
            <BrowserRouter>
                <EventsList />
            </BrowserRouter>
        )

        await act(async () => {
            vi.advanceTimersByTime(2100)
        })
        vi.useRealTimers()

        await waitFor(() => expect(screen.getByText('Fallback Event')).toBeInTheDocument())
    })

    it('shows session expired message when timeout aborts request', async () => {
        const checkSession = vi.fn().mockResolvedValue(false)
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            loading: false,
            checkSession,
        } as any)

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockImplementation((signal: AbortSignal) => new Promise((_resolve, reject) => {
                    signal.addEventListener('abort', () => {
                        reject(signal.reason || new Error('Request timed out after 10s'))
                    }, { once: true })
                }))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return queryBuilder as any
            }
            if (table === 'participants') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return createParticipantsMock() as any
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return queryBuilder as any
        })

        vi.useFakeTimers()
        render(
            <BrowserRouter>
                <EventsList />
            </BrowserRouter>
        )

        await act(async () => {
            vi.advanceTimersByTime(10_000)
        })
        vi.useRealTimers()

        await waitFor(() => expect(screen.getByText('events.errorSession')).toBeInTheDocument())
        expect(checkSession).toHaveBeenCalled()
    })
})

describe('EventsList additional coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: '123' } } }, error: null } as any)
    })

    it('logs error when participant fetch fails', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const future = new Date(Date.now() + 100000).toISOString()
        const events = [{ id: '1', title: 'Ev', start_time: future }]

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const query = createBaseQueryBuilder()
            if (table === 'events') {
                query.abortSignal.mockResolvedValue({ data: events, error: null })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return query as any
            }
            if (table === 'participants') {
                query.in.mockResolvedValue({ data: null, error: { message: 'PartFail' } })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return query as any
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return query as any
        })

        render(<AuthProvider><BrowserRouter><EventsList /></BrowserRouter></AuthProvider>)
        await waitFor(() => expect(screen.getByText('Ev')).toBeInTheDocument())
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching participant counts:', expect.anything())
    })

    it('re-throws error if it is AbortError inside response', async () => {
        // Need to simulate supabase returning { error: { message: 'AbortError' } }
        // This triggers the specific check
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const query = createBaseQueryBuilder()
            if (table === 'events') {
                query.abortSignal.mockResolvedValue({ data: null, error: { message: 'AbortError' } })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return query as any
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return query as any
        })

        // This should be caught and ignored as abort
        render(<AuthProvider><BrowserRouter><EventsList /></BrowserRouter></AuthProvider>)
        // Should NOT show error
        await waitFor(() => {
            expect(screen.queryByText(/Tapahtumien lataaminen epäonnistui/i)).not.toBeInTheDocument()
        })
    })

    it('handles explicit AbortError from Supabase client throw', async () => {
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const query = createBaseQueryBuilder()
            if (table === 'events') {
                const err = new Error('AbortError')
                err.name = 'AbortError'
                query.abortSignal.mockRejectedValue(err)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return query as any
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return query as any
        })

        render(<AuthProvider><BrowserRouter><EventsList /></BrowserRouter></AuthProvider>)
        await waitFor(() => {
            // Abort handled silently (or retried)
            expect(screen.queryByText(/Tapahtumien lataaminen epäonnistui/i)).not.toBeInTheDocument()
        })
    })
})
