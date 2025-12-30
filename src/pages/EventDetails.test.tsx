
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EventDetails from './EventDetails'
import { supabase } from '../lib/supabase'
import * as AuthContext from '../contexts/AuthContext'

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
    },
}))

vi.mock('../components/EventsMap', () => ({
    default: () => <div data-testid="event-map" />,
}))

const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    }
})

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) => {
            if (key === 'events.details.participantsCount') return `${options.count} participants_mock`
            return key
        },
        i18n: {
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}))

const createBaseQueryBuilder = () => {
    const builder: any = {
        _data: null,
        _error: null,
        _count: 0,
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        abortSignal: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: any) =>
            resolve({ data: builder._data, error: builder._error, count: builder._count })
        ),
    }
    return builder
}

describe('EventDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
    })

    it('allows admin to delete an event', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-1',
            title: 'Test Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: 'Helsinki',
            max_participants: null,
            created_at: new Date().toISOString(),
            creator_id: 'admin',
        }

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder._data = event
                return queryBuilder as any
            }
            if (table === 'participants') {
                queryBuilder._count = 2
                queryBuilder._data = []
                return queryBuilder as any
            }
            if (table === 'profiles') {
                queryBuilder._data = { role: 'user' }
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(
            <MemoryRouter initialEntries={['/events/event-1']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Test Event')).toBeInTheDocument())
        expect(screen.getByText('events.details.participants')).toBeInTheDocument()
        expect(screen.getByText('2 participants_mock')).toBeInTheDocument()

        const deleteButton = screen.getByRole('button', { name: 'events.details.delete' })
        fireEvent.click(deleteButton)

        await waitFor(() => {
            expect(confirmSpy).toHaveBeenCalled()
            expect(mockedNavigate).toHaveBeenCalledWith('/')
        })
    })

    it('shows not found when event fetch fails', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                queryBuilder._error = new Error('not found')
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <MemoryRouter initialEntries={['/events/missing']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('events.details.notFound')).toBeInTheDocument())
    })

    it('allows user to register and cancel participation', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' } as any,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-2',
            title: 'Join Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: null,
            max_participants: null,
            created_at: new Date().toISOString(),
            creator_id: 'owner-1',
        }

        let queryCall = 0
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                queryBuilder._data = event
                return queryBuilder as any
            }
            if (table === 'participants') {
                queryBuilder.then.mockImplementation((resolve: any) => {
                    queryCall++
                    // 1st call: fetchEvent -> count
                    // 2nd call: fetchEvent -> user participant status (single)
                    // These happen in sequence in fetchEvent

                    if (queryCall === 2 || queryCall === 5) { // Single check
                        // If we've inserted, return the record. 
                        // We can check if insert was called or just use call counts.
                        if (queryCall > 3) return resolve({ data: { id: 'p1' }, error: null })
                        return resolve({ data: null, error: null })
                    }
                    if (queryCall === 4) { // insert/cancel operation itself
                        return resolve({ data: null, error: null })
                    }
                    // Counts or other
                    return resolve({ data: [], count: 0, error: null })
                })
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-2']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Join Event')).toBeInTheDocument())

        const registerBtn = await screen.findByText('events.details.join')
        fireEvent.click(registerBtn)

        await waitFor(() => expect(screen.getByText('events.details.leave')).toBeInTheDocument())

        fireEvent.click(screen.getByText('events.details.leave'))
        await waitFor(() => expect(screen.getByText('events.details.join')).toBeInTheDocument())
    })

    it('surfaces delete errors', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-3',
            title: 'Delete Error Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: null,
            max_participants: null,
            created_at: new Date().toISOString(),
            creator_id: 'admin',
        }

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                queryBuilder._data = event

                queryBuilder.delete.mockImplementation(() => {
                    queryBuilder._error = new Error('fail')
                    queryBuilder._data = null
                    return queryBuilder
                })

                return queryBuilder as any
            }
            if (table === 'participants') {
                queryBuilder._count = 1
                queryBuilder._data = []
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(
            <MemoryRouter initialEntries={['/events/event-3']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Delete Error Event')).toBeInTheDocument())
        fireEvent.click(screen.getByText('events.details.delete'))

        await waitFor(() => expect(screen.getByText('fail')).toBeInTheDocument())
    })

    it('shows participant emails to event owner', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'owner-1' } as any,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-4',
            title: 'Owner Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: null,
            max_participants: 10,
            created_at: new Date().toISOString(),
            creator_id: 'owner-1',
        }

        vi.mocked(supabase.rpc).mockResolvedValue({
            data: [
                { user_id: 'u1', email: 'alice@example.com' },
                { user_id: 'u2', email: 'bob@example.com' },
            ],
            error: null,
        } as any)

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                queryBuilder._data = event
                return queryBuilder as any
            }
            if (table === 'participants') {
                queryBuilder._count = 2
                queryBuilder._data = []
                return queryBuilder as any
            }
            return queryBuilder as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-4']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Owner Event')).toBeInTheDocument())
        expect(screen.getByText('2 / 10')).toBeInTheDocument()
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
        expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    })

    it('renders event details for unauthenticated user (email list hidden)', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-public',
            title: 'Public Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: 'Helsinki',
            max_participants: 10,
            created_at: new Date().toISOString(),
            creator_id: 'creator',
        }

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const query = createBaseQueryBuilder()
            if (table === 'events') {
                query._data = event
                return query as any
            }
            if (table === 'participants') {
                // Counts
                query._count = 0
                return query as any
            }
            return query as any
        })

        render(<MemoryRouter initialEntries={['/events/event-public']}><Routes><Route path="/events/:id" element={<EventDetails />} /></Routes></MemoryRouter>)

        await waitFor(() => expect(screen.getByText('Public Event')).toBeInTheDocument())
        expect(screen.queryByText('events.details.registered')).not.toBeInTheDocument()
        expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument()
    })

    it('handles registration error with alert', async () => {
        const user = { id: 'u1' }
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, isAdmin: false, loading: false } as any)
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

        const event = { id: 'ev-reg-fail', title: 'Reg Fail', creator_id: 'c1', start_time: new Date().toISOString(), end_time: new Date().toISOString(), created_at: new Date().toISOString() }

        let calls = 0
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const q = createBaseQueryBuilder()
            if (table === 'events') { q._data = event; return q as any }
            if (table === 'participants') {
                calls++
                // 1. count, 2. check status -> return null (not regged)
                if (calls <= 2) { q._data = null; q._count = 0; return q as any }
                // 3. insert -> fail
                q.insert.mockReturnValue({
                    then: vi.fn((cb) => cb({ data: null, error: { message: 'RegFailed' } }))
                } as any)
                return q as any
            }
            return q as any
        })

        // Ensure insert mock above works or adjust createBaseQueryBuilder to allow overriding insert behavior dynamicly?
        // createBaseQueryBuilder returns object with mocked methods.
        // My implementation above overrides insert return value.

        render(<MemoryRouter initialEntries={['/events/ev-reg-fail']}><Routes><Route path="/events/:id" element={<EventDetails />} /></Routes></MemoryRouter>)

        const btn = await screen.findByText('events.details.join')
        fireEvent.click(btn)

        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('RegFailed')))
    })

    it('handles cancellation error with alert', async () => {
        const user = { id: 'u1' }
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, isAdmin: false, loading: false } as any)
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })
        const event = { id: 'ev-cancel-fail', title: 'Cancel Fail', creator_id: 'c1', start_time: new Date().toISOString(), end_time: new Date().toISOString(), created_at: new Date().toISOString() }

        let calls = 0
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const q = createBaseQueryBuilder()
            if (table === 'events') { q._data = event; return q as any }
            if (table === 'participants') {
                // 1 count, 2 check status -> return VALID participant logic
                calls++
                if (calls <= 2) {
                    q._data = { id: 'p1', status: 'registered' } // User is registered
                    // Override 'single' to return this
                    q.single.mockReturnValue({ then: (cb: any) => cb({ data: q._data, error: null }) })
                    return q as any
                }
                // 3 delete -> fail
                // delete().eq(...)
                q.delete.mockReturnThis()
                q.eq.mockReturnValue({
                    then: vi.fn((cb) => cb({ data: null, error: { message: 'CancelFailed' } }))
                } as any)
                return q as any
            }
            return q as any
        })

        render(<MemoryRouter initialEntries={['/events/ev-cancel-fail']}><Routes><Route path="/events/:id" element={<EventDetails />} /></Routes></MemoryRouter>)

        const btn = await screen.findByText('events.details.leave')
        fireEvent.click(btn)

        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('CancelFailed')))
    })
})
