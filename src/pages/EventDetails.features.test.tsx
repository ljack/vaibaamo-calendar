
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
        t: (key: string) => key,
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

describe('EventDetails Features', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)

        // Mock Auth
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' } as any,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        // Mock Clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn(),
            },
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const setupEventMock = (eventData: any) => {
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                queryBuilder._data = eventData
                return queryBuilder as any
            }
            if (table === 'participants') {
                queryBuilder._count = 0
                queryBuilder._data = []
                return queryBuilder as any
            }
            if (table === 'profiles') {
                queryBuilder._data = { role: 'user' }
                return queryBuilder as any
            }
            return queryBuilder as any
        })
    }

    it('renders Plan tab when plan content exists', async () => {
        const event = {
            id: 'event-plan',
            title: 'Plan Event',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            created_at: new Date().toISOString(),
            plan_markdown: '# The Plan',
            recap_markdown: null,
            media_assets: []
        }
        setupEventMock(event)

        render(
            <MemoryRouter initialEntries={['/events/event-plan']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Plan Event')).toBeInTheDocument())

        // Info tab is default
        expect(screen.getByText('events.details.tabInfo')).toBeInTheDocument()

        // Plan tab should be visible
        expect(screen.getByText('events.details.tabPlan')).toBeInTheDocument()

        // Recap tab should NOT be visible
        expect(screen.queryByText('events.details.tabRecap')).not.toBeInTheDocument()

        // Switch to Plan tab
        fireEvent.click(screen.getByText('events.details.tabPlan'))

        // Verify markdown content
        expect(screen.getByTestId('markdown')).toHaveTextContent('# The Plan')

        // Verify Share button
        expect(screen.getByText(/events.details.share/)).toBeInTheDocument()
    })

    it('renders Recap tab when recap content exists', async () => {
        const event = {
            id: 'event-recap',
            title: 'Recap Event',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            created_at: new Date().toISOString(),
            plan_markdown: null,
            recap_markdown: 'Recap content',
            media_assets: []
        }
        setupEventMock(event)

        render(
            <MemoryRouter initialEntries={['/events/event-recap']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Recap Event')).toBeInTheDocument())

        expect(screen.getByText('events.details.tabRecap')).toBeInTheDocument()
        fireEvent.click(screen.getByText('events.details.tabRecap'))

        expect(screen.getByTestId('markdown')).toHaveTextContent('Recap content')
    })

    it('renders Media Galleries in tabs', async () => {
        const event = {
            id: 'event-media',
            title: 'Media Event',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            created_at: new Date().toISOString(),
            plan_markdown: 'Plan',
            recap_markdown: 'Recap',
            media_assets: [
                { url: 'http://img.com/1.jpg', section: 'plan', caption: 'Plan Img' },
                { url: 'http://img.com/2.jpg', section: 'recap', caption: 'Recap Img' }
            ]
        }
        setupEventMock(event)

        render(
            <MemoryRouter initialEntries={['/events/event-media']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Media Event')).toBeInTheDocument())

        // Check Plan Gallery
        fireEvent.click(screen.getByText('events.details.tabPlan'))
        expect(screen.getByText('events.details.galleryPlan')).toBeInTheDocument()
        expect(screen.getByAltText('Plan Img')).toBeInTheDocument()
        expect(screen.queryByAltText('Recap Img')).not.toBeInTheDocument()

        // Check Recap Gallery
        fireEvent.click(screen.getByText('events.details.tabRecap'))
        expect(screen.getByText('events.details.galleryRecap')).toBeInTheDocument()
        expect(screen.getByAltText('Recap Img')).toBeInTheDocument()
    })

    it('copies tab link to clipboard', async () => {
        const event = {
            id: 'event-copy',
            title: 'Copy Event',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            created_at: new Date().toISOString(),
            plan_markdown: 'Plan',
        }
        setupEventMock(event)

        render(
            <MemoryRouter initialEntries={['/events/event-copy']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Copy Event')).toBeInTheDocument())

        fireEvent.click(screen.getByText('events.details.tabPlan'))

        const shareBtn = screen.getByText(/events.details.share/)
        fireEvent.click(shareBtn)

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/events/event-copy?tab=plan'))
        expect(screen.getByText(/events.details.copied/)).toBeInTheDocument()
    })
})
