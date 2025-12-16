import { render, screen, waitFor } from '@testing-library/react'
import EventsList from '../pages/EventsList'
import { supabase } from '../lib/supabase'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn() // Chainable mock setups below
            }))
        }))
    }
}))

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(() => ({ loading: false }))
}))

describe('EventsList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders loading state initially', () => {
        const fromMock = vi.mocked(supabase.from)
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                    abortSignal: vi.fn().mockReturnValue(new Promise(() => { })) // Never resolves
                })
            })
        } as any)

        render(<EventsList />)
        const skeletons = document.getElementsByClassName('animate-pulse')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders events list after data fetch', async () => {
        const mockEvents = [
            { id: '1', title: 'Test Event 1', description: 'Desc 1', start_time: new Date().toISOString() },
            { id: '2', title: 'Test Event 2', description: 'Desc 2', start_time: new Date().toISOString() }
        ]

        const fromMock = vi.mocked(supabase.from)
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                    abortSignal: vi.fn().mockResolvedValue({ data: mockEvents, error: null })
                })
            })
        } as any)

        render(
            <BrowserRouter>
                <EventsList />
            </BrowserRouter>
        )

        await waitFor(() => {
            expect(screen.getByText('Test Event 1')).toBeInTheDocument()
            expect(screen.getByText('Test Event 2')).toBeInTheDocument()
        })
    })

    it('renders empty state when no events', async () => {
        const fromMock = vi.mocked(supabase.from)
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        } as any)

        render(
            <BrowserRouter>
                <EventsList />
            </BrowserRouter>
        )

        await waitFor(() => {
            expect(screen.getByText(/Ei tulevia tapahtumia/i)).toBeInTheDocument()
        })
    })

    it('renders error state on fetch failure', async () => {
        const fromMock = vi.mocked(supabase.from)
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                    abortSignal: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } })
                })
            })
        } as any)

        render(
            <BrowserRouter>
                <EventsList />
            </BrowserRouter>
        )

        await waitFor(() => {
            expect(screen.getByText(/Tapahtumien lataaminen epäonnistui/i)).toBeInTheDocument()
        })
    })
})
