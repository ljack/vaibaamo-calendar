
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
    const updateMock = vi.fn().mockResolvedValue({ error: null })

    beforeEach(() => {
        vi.clearAllMocks()

        // Default Auth Mocks
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: mockUser } as any },
            error: null,
        })
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: mockUser } as any,
            error: null
        })

        const eqMock = vi.fn().mockResolvedValue({ error: null })
        updateMock.mockImplementation(() => ({ eq: eqMock }))

        // Default DB Mocks
        vi.mocked(supabase.from).mockImplementation((table) => {
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
            return {
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: { role: 'user' }, error: null })
                    })
                })
            } as any
        })
    })

    it('renders edit form with fetched data', async () => {
        // Mocks already set in beforeEach

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
        const form = submitBtn.closest('form')
        fireEvent.submit(form!)

        await waitFor(() => {
            // Check that update was called with correct payload
            // Since we remocked in beforeEach, we can't easily access the exact function instance
            // from the describe scope unless we store it.
            // But we can check the calls to the mock we injected.

            // Wait, we need to access `updateFn` defined in beforeEach.
            // But variables in beforeEach are not accessible here unless outer scoped.
            // Let's rely on the fact that we can get the mock from the call.
        })

        // Actually, better to just scope updateFn outside
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            title: 'New Title'
        }))
    })
})
