
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
        expect(screen.getByText(/Osallistujat/i)).toBeInTheDocument()
        expect(screen.getByText('2 osallistujaa')).toBeInTheDocument()

        const deleteButton = screen.getByRole('button', { name: /Poista/i })
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

        await waitFor(() => expect(screen.getByText(/Tapahtumaa ei löytynyt/i)).toBeInTheDocument())
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

        const registerBtn = await screen.findByText(/Ilmoittaudu mukaan/i)
        fireEvent.click(registerBtn)

        await waitFor(() => expect(screen.getByText(/Peru ilmoittautuminen/i)).toBeInTheDocument())

        fireEvent.click(screen.getByText(/Peru ilmoittautuminen/i))
        await waitFor(() => expect(screen.getByText(/Ilmoittaudu mukaan/i)).toBeInTheDocument())
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
        fireEvent.click(screen.getByText('Poista'))

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
})
