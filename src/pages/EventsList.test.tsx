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

describe('EventsList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders loading state initially', () => {
        // Basic mock just to not crash
        const fromMock = vi.mocked(supabase.from)
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue(new Promise(() => { })) // Never resolves to keep loading
            })
        } as any)

        render(<EventsList />)
        expect(screen.getByText(/Ladataan tapahtumia/i)).toBeInTheDocument()
    })

    it('renders events list after data fetch', async () => {
        const mockEvents = [
            { id: '1', title: 'Test Event 1', description: 'Desc 1', start_time: new Date().toISOString() },
            { id: '2', title: 'Test Event 2', description: 'Desc 2', start_time: new Date().toISOString() }
        ]

        const fromMock = vi.mocked(supabase.from)
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockEvents, error: null })
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
                order: vi.fn().mockResolvedValue({ data: [], error: null })
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
})
