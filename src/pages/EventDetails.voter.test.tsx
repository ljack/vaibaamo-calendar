
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EventDetails from './EventDetails'
import { supabase } from '../lib/supabase'
import * as AuthContext from '../contexts/AuthContext'

// Mocks
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
    },
}))

vi.mock('../components/EventsMap', () => ({
    default: () => <div data-testid="event-map" />,
}))

vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
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
        t: (key: string) => {
            if (key === 'common.dateLocale') return 'en-US'
            return key
        },
        i18n: {
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}))

const createBaseQueryBuilder = (data: any = null, error: any = null, count: number = 0) => {
    const builder: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error, count }),
        abortSignal: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: any) =>
            resolve({ data, error, count })
        ),
    }
    return builder
}

describe('EventDetails Voter & Auth', () => {
    const alertSpy = vi.fn()
    vi.stubGlobal('alert', alertSpy)

    beforeEach(() => {
        vi.clearAllMocks()
        alertSpy.mockClear()
        vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const setupMocks = (user: any, eventData: any, votes: any[] = []) => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: user,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') {
                return createBaseQueryBuilder(eventData) as any
            }
            if (table === 'event_options') {
                return createBaseQueryBuilder(eventData.scheduler_options || []) as any
            }
            if (table === 'event_votes') {
                return createBaseQueryBuilder(votes) as any
            }
            if (table === 'participants') {
                return createBaseQueryBuilder(null) as any
            }
            if (table === 'profiles') {
                return createBaseQueryBuilder({ role: 'user' }) as any
            }
            return createBaseQueryBuilder() as any
        })
    }

    const event = {
        id: 'event-voters',
        title: 'Voter Test',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        scheduling_status: 'voting' as const,
        scheduler_options: [
            { id: 'opt-1', start_time: new Date().toISOString(), end_time: new Date().toISOString() }
        ]
    }

    const votes = [
        {
            id: 'v-1',
            option_id: 'opt-1',
            user_id: 'user-voter',
            profiles: {
                full_name: 'John Doe',
                display_name: 'johndoe'
            }
        }
    ]

    it('shows Anonymous to guests even if name is present', async () => {
        setupMocks(null, event, votes)

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Voter Test')).toBeInTheDocument())

        // Wait for scheduler options to render
        await waitFor(() => expect(screen.getByText(/1 events.scheduler.votes/)).toBeInTheDocument())
        
        // Should NOT see 'John Doe'
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        
        // Should see 'common.anonymous'
        expect(screen.getByText('common.anonymous')).toBeInTheDocument()
    })

    it('shows display name (preferring it over full name) to logged-in users', async () => {
        setupMocks({ id: 'user-1' }, event, votes)

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Voter Test')).toBeInTheDocument())

        // Wait for scheduler options
        await waitFor(() => expect(screen.getByText('johndoe')).toBeInTheDocument())
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.queryByText('common.anonymous')).not.toBeInTheDocument()
    })

    it('prefers event-specific display name over global display name', async () => {
        const customVotes = [
            {
                id: 'v-1',
                option_id: 'opt-1',
                user_id: 'user-voter',
                profiles: {
                    full_name: 'John Doe',
                    display_name: 'johndoe'
                }
            }
        ]
        
        // Mock profile
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') return createBaseQueryBuilder(event) as any
            if (table === 'event_options') return createBaseQueryBuilder(event.scheduler_options) as any
            if (table === 'event_votes') return createBaseQueryBuilder(customVotes) as any
            if (table === 'participants') {
                return createBaseQueryBuilder([
                    { user_id: 'user-voter', display_name: 'Event-Spec Name' }
                ]) as any
            }
            if (table === 'profiles') return createBaseQueryBuilder({ id: 'user-voter', display_name: 'johndoe' }) as any
            return createBaseQueryBuilder() as any
        })

        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' },
            isAdmin: false,
        } as any)

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Event-Spec Name')).toBeInTheDocument())
        expect(screen.queryByText('johndoe')).not.toBeInTheDocument()
    })

    it('allows joining with a custom display name', async () => {
        setupMocks({ id: 'user-1' }, event, [])
        
        const insertMock = vi.fn().mockResolvedValue({ error: null })
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') return createBaseQueryBuilder(event) as any
            if (table === 'event_options') return createBaseQueryBuilder(event.scheduler_options) as any
            if (table === 'event_votes') return createBaseQueryBuilder([]) as any
            if (table === 'participants') {
                const builder = createBaseQueryBuilder(null)
                builder.insert = insertMock
                return builder as any
            }
            if (table === 'profiles') return createBaseQueryBuilder({ id: 'user-1', display_name: 'global-name' }) as any
            return createBaseQueryBuilder() as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Voter Test')).toBeInTheDocument())

        const input = screen.getByPlaceholderText('profile.displayName')
        fireEvent.change(input, { target: { value: 'My Custom Name' } })
        
        const joinBtn = screen.getByText('events.details.join')
        fireEvent.click(joinBtn)

        await waitFor(() => {
            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                display_name: 'My Custom Name',
                event_id: 'event-voters',
                user_id: 'user-1'
            }))
        })
    })

    it('prompts guest to login when clicking Vote', async () => {
        setupMocks(null, event, votes)

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Voter Test')).toBeInTheDocument())

        const voteBtn = await screen.findByText('events.scheduler.vote')
        fireEvent.click(voteBtn)

        expect(alertSpy).toHaveBeenCalledWith('events.details.loginToJoin')
        expect(mockedNavigate).toHaveBeenCalledWith('/login')
    })

    it('grants access if code is in localStorage but missing from URL', async () => {
        const hiddenEvent = { ...event, event_type: 'hidden', access_code: 'SECRET' }
        
        // Mock localStorage
        const storageKey = `event_access_code_event-voters`
        vi.stubGlobal('localStorage', {
            getItem: vi.fn().mockImplementation((key) => key === storageKey ? 'SECRET' : null),
            setItem: vi.fn(),
        })

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') return createBaseQueryBuilder(hiddenEvent) as any
            if (table === 'event_options') return createBaseQueryBuilder([]) as any
            if (table === 'event_votes') return createBaseQueryBuilder([]) as any
            if (table === 'participants') return createBaseQueryBuilder(null) as any
            if (table === 'profiles') return createBaseQueryBuilder({ id: 'user-1' }) as any
            return createBaseQueryBuilder() as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        // Should NOT see the code input prompt
        await waitFor(() => expect(screen.queryByPlaceholderText('Access Code')).not.toBeInTheDocument())
        expect(screen.getByText('Voter Test')).toBeInTheDocument()
    })

    it('shows an alert when voting fails', async () => {
        setupMocks({ id: 'user-1' }, event, [])
        
        // Mock error during vote insert
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') return createBaseQueryBuilder(event) as any
            if (table === 'event_options') return createBaseQueryBuilder(event.scheduler_options) as any
            if (table === 'event_votes') {
                const builder = createBaseQueryBuilder([])
                builder.insert = vi.fn().mockResolvedValue({ error: new Error('DB Error') })
                return builder as any
            }
            if (table === 'participants') return createBaseQueryBuilder({ id: 'p1', user_id: 'user-1' }) as any
            if (table === 'profiles') return createBaseQueryBuilder({ id: 'user-1' }) as any
            return createBaseQueryBuilder() as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-voters']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        const voteBtn = await screen.findByText('events.scheduler.vote')
        fireEvent.click(voteBtn)

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('events.details.voteError')
        })
    })
})
