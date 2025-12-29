import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import EventsList from './EventsList'
import { AuthProvider } from '../contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import * as AuthContext from '../contexts/AuthContext'

const supabaseMock = vi.hoisted(() => {
    const supabase = {
        auth: {
            getSession: vi.fn(),
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
    then: vi.fn().mockImplementation((resolve: any) => resolve({ data: null, error: null, count: 0 })),
})

const createParticipantsMock = (rows: Array<{ event_id: string }> = []) => {
    const queryBuilder = createBaseQueryBuilder()
    queryBuilder.in.mockResolvedValue({ data: rows, error: null })
    return queryBuilder
}



describe('EventsList ordering and past events', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: '123' } } },
            error: null,
        } as any)
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)
    })

    it('orders upcoming events by date and hides past events by default', async () => {
        const now = new Date()
        const past = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString()
        const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString()
        const later = new Date(now.getTime() + 1000 * 60 * 60 * 48).toISOString()

        const events = [
            {
                id: 'past',
                title: 'Past Event',
                description: 'Past',
                start_time: past,
                end_time: past,
                location: 'Helsinki',
                max_participants: null,
                created_at: past,
            },
            {
                id: 'later',
                title: 'Later Event',
                description: 'Later',
                start_time: later,
                end_time: later,
                location: 'Espoo',
                max_participants: null,
                created_at: later,
            },
            {
                id: 'soon',
                title: 'Soon Event',
                description: 'Soon',
                start_time: soon,
                end_time: soon,
                location: 'Vantaa',
                max_participants: null,
                created_at: soon,
            },
        ]

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockResolvedValue({ data: events, error: null })
                return queryBuilder as any
            }
            if (table === 'participants') {
                return createParticipantsMock([
                    { event_id: 'soon' },
                    { event_id: 'soon' },
                    { event_id: 'later' },
                ]) as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText('Soon Event')).toBeInTheDocument())

        const titles = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)
        expect(titles[0]).toContain('Soon Event')
        expect(titles[1]).toContain('Later Event')
        expect(screen.getByText('2 osallistujaa')).toBeInTheDocument()
        expect(screen.getByText('1 osallistujaa')).toBeInTheDocument()
        expect(screen.queryByText('Past Event')).not.toBeInTheDocument()

        const toggle = screen.getByRole('button', { name: /Näytä menneet tapahtumat/i })
        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(await screen.findByText('Past Event')).toBeInTheDocument()
    })
})

describe('EventsList edge states', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: '123' } } },
            error: null,
        } as any)
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)
    })

    it('shows empty state when no events are returned', async () => {
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockResolvedValue({ data: [], error: null })
                return queryBuilder as any
            }
            if (table === 'participants') {
                return createParticipantsMock() as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText(/Ei tulevia tapahtumia/i)).toBeInTheDocument())
    })

    it('shows error state on fetch failure', async () => {
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockResolvedValue({ data: null, error: new Error('boom') })
                return queryBuilder as any
            }
            if (table === 'participants') {
                return createParticipantsMock() as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText(/Tapahtumien lataaminen epäonnistui/i)).toBeInTheDocument())
        expect(screen.getByRole('button', { name: /Yritä uudelleen/i })).toBeInTheDocument()
    })

    it('retries when request is aborted', async () => {
        const future = new Date(Date.now() + 3600_000).toISOString()
        const events = [
            {
                id: 'retry',
                title: 'Retry Event',
                description: 'Retry',
                start_time: future,
                end_time: future,
                location: 'Helsinki',
                max_participants: null,
                created_at: future,
            },
        ]

        let call = 0
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockImplementation(() => {
                    call += 1
                    if (call === 1) {
                        const abortError = Object.assign(new Error('AbortError: signal is aborted'), {
                            name: 'AbortError',
                        })
                        return Promise.reject(abortError)
                    }
                    return Promise.resolve({ data: events, error: null })
                })
                return queryBuilder as any
            }
            if (table === 'participants') {
                return createParticipantsMock([{ event_id: 'retry' }]) as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText('Retry Event')).toBeInTheDocument())
        expect(screen.queryByText(/Tapahtumien lataaminen epäonnistui/i)).not.toBeInTheDocument()
    })

    it('keeps invalid dates in upcoming list', async () => {
        const events = [
            {
                id: 'invalid',
                title: 'Invalid Date Event',
                description: 'Invalid',
                start_time: new Date(Date.now() - 86400000).toISOString(),
                end_time: 'not-a-date',
                location: 'Oulu',
                max_participants: null,
                created_at: new Date().toISOString(),
            },
        ]

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockResolvedValue({ data: events, error: null })
                return queryBuilder as any
            }
            if (table === 'participants') {
                return createParticipantsMock([{ event_id: 'invalid' }]) as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText('Invalid Date Event')).toBeInTheDocument())
        expect(screen.queryByText(/Näytä menneet tapahtumat/i)).not.toBeInTheDocument()
    })

    it('retries fetch when clicking retry button', async () => {
        const future = new Date(Date.now() + 3600_000).toISOString()
        const events = [
            {
                id: 'recovered',
                title: 'Recovered Event',
                description: 'Recovered',
                start_time: future,
                end_time: future,
                location: 'Espoo',
                max_participants: null,
                created_at: future,
            },
        ]

        let call = 0
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder.abortSignal.mockImplementation(() => {
                    call += 1
                    if (call === 1) {
                        return Promise.resolve({ data: null, error: new Error('boom') })
                    }
                    return Promise.resolve({ data: events, error: null })
                })
                return queryBuilder as any
            }
            if (table === 'participants') {
                return createParticipantsMock([{ event_id: 'recovered' }]) as any
            }
            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { role: 'user' }, error: null })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText(/Tapahtumien lataaminen epäonnistui/i)).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /Yritä uudelleen/i }))

        await waitFor(() => expect(screen.getByText('Recovered Event')).toBeInTheDocument())
        expect(call).toBeGreaterThan(1)
    })
})


