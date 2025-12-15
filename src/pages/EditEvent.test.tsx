
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import EditEvent from './EditEvent'
import { AuthProvider } from '../contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: '123' }),
    }
})

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
}

describe('EditEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders edit form with fetched data', async () => {
        // Mock session for AuthProvider
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: mockUser } as any },
            error: null,
        })
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)

        // Mock profiles check (admin check)
        vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'profiles') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: { role: 'user' }, error: null }),
                        }),
                    }),
                } as any
            }
            if (table === 'events') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({
                                data: {
                                    id: '123',
                                    title: 'Old Title',
                                    description: 'Old Desc',
                                    start_time: '2025-12-01T12:00:00Z',
                                    end_time: '2025-12-01T14:00:00Z',
                                    location: 'Oulu',
                                    max_participants: 10,
                                    creator_id: 'user-123'
                                },
                                error: null
                            })
                        })
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: () => Promise.resolve({ error: null }) // Mock update success
                    })
                } as any
            }
            return {} as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EditEvent />
                </BrowserRouter>
            </AuthProvider>
        )

        // Initial loading state
        expect(screen.getByText('Ladataan...')).toBeInTheDocument()

        // Wait for form to populate
        await waitFor(() => {
            expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument()
            expect(screen.getByDisplayValue('Old Desc')).toBeInTheDocument()
        })
    })

    it('updates event on submit', async () => {
        // Re-mock same setup
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: mockUser } as any },
            error: null,
        })
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)

        const updateMock = vi.fn().mockImplementation(() => ({
            eq: () => Promise.resolve({ error: null })
        }))

        vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'profiles') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: { role: 'user' }, error: null }),
                        }),
                    }),
                } as any
            }
            if (table === 'events') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({
                                data: {
                                    id: '123',
                                    title: 'Old Title',
                                    description: 'Old Desc',
                                    start_time: '2025-12-01T12:00:00Z',
                                    end_time: '2025-12-01T14:00:00Z',
                                    location: 'Oulu',
                                    max_participants: 10,
                                    creator_id: 'user-123'
                                },
                                error: null
                            })
                        })
                    }),
                    update: updateMock
                } as any
            }
            return {} as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EditEvent />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument())

        const titleInput = screen.getByLabelText('Otsikko')
        fireEvent.change(titleInput, { target: { value: 'New Title' } })

        const submitBtn = screen.getByText('Tallenna muutokset')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(updateMock).toHaveBeenCalled()
            // Verify payload contains new title
            expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
                title: 'New Title'
            }))
            expect(mockNavigate).toHaveBeenCalledWith('/events/123')
        })
    })
})
