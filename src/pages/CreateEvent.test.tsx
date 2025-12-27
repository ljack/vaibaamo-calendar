import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CreateEvent from '../pages/CreateEvent'
import { supabase } from '../lib/supabase'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import * as AuthContext from '../contexts/AuthContext'

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            insert: vi.fn()
        }))
    }
}))

// Mock navigate
const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockedNavigate
    }
})

describe('CreateEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('redirects or shows unauth message if not admin', () => {
        // Mock useAuth to return non-admin
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: '123' } as any,
            isAdmin: false,
            loading: false,
            signOut: vi.fn()
        } as any)

        render(
            <BrowserRouter>
                <CreateEvent />
            </BrowserRouter>
        )

        expect(screen.getByText(/Ei oikeuksia/i)).toBeInTheDocument()
    })

    it('renders form for admin', () => {
        // Mock useAuth to return admin
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn()
        } as any)

        render(
            <BrowserRouter>
                <CreateEvent />
            </BrowserRouter>
        )

        expect(screen.getByText(/Luo uusi tapahtuma/i)).toBeInTheDocument()
    })

    it('submits form successfully', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn()
        } as any)

        // Mock insert to return an object with select
        const insertMock = vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

        const fromMock = vi.fn((table) => {
            if (table === 'profiles') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
                        }),
                    }),
                } as any
            }
            if (table === 'events') {
                return {
                    insert: insertMock,
                } as any
            }
            return {} as any
        })

        vi.mocked(supabase.from).mockImplementation(fromMock)

        render(
            <BrowserRouter>
                <CreateEvent />
            </BrowserRouter>
        )

        fireEvent.change(screen.getByLabelText(/Otsikko/i), { target: { value: 'New Event' } })
        fireEvent.change(screen.getByLabelText(/Kuvaus/i), { target: { value: 'Description' } })
        fireEvent.change(screen.getByLabelText(/Alkaa/i), { target: { value: '2025-12-24T12:00' } })
        fireEvent.change(screen.getByLabelText(/Päättyy/i), { target: { value: '2025-12-24T14:00' } })

        fireEvent.click(screen.getByRole('button', { name: /Luo tapahtuma/i }))

        await waitFor(() => {
            expect(insertMock).toHaveBeenCalled()
            expect(mockedNavigate).toHaveBeenCalledWith('/')
        })
    })

    it('does not submit when user is missing', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            isAdmin: true,
            loading: false,
            signOut: vi.fn()
        } as any)

        render(
            <BrowserRouter>
                <CreateEvent />
            </BrowserRouter>
        )

        fireEvent.change(screen.getByLabelText(/Otsikko/i), { target: { value: 'No User Event' } })
        fireEvent.change(screen.getByLabelText(/Kuvaus/i), { target: { value: 'Description' } })
        fireEvent.change(screen.getByLabelText(/Alkaa/i), { target: { value: '2025-12-24T12:00' } })
        fireEvent.change(screen.getByLabelText(/Päättyy/i), { target: { value: '2025-12-24T14:00' } })

        fireEvent.click(screen.getByRole('button', { name: /Luo tapahtuma/i }))

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('No user found')
        })
        expect(supabase.from).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('shows alert when create fails', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn()
        } as any)

        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

        const insertMock = vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: new Error('nope') }),
        })

        vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'events') {
                return {
                    insert: insertMock,
                } as any
            }
            return {} as any
        })

        render(
            <BrowserRouter>
                <CreateEvent />
            </BrowserRouter>
        )

        fireEvent.change(screen.getByLabelText(/Otsikko/i), { target: { value: 'Fail Event' } })
        fireEvent.change(screen.getByLabelText(/Kuvaus/i), { target: { value: 'Description' } })
        fireEvent.change(screen.getByLabelText(/Alkaa/i), { target: { value: '2025-12-24T12:00' } })
        fireEvent.change(screen.getByLabelText(/Päättyy/i), { target: { value: '2025-12-24T14:00' } })

        fireEvent.click(screen.getByRole('button', { name: /Luo tapahtuma/i }))

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalled()
        })
        alertSpy.mockRestore()
    })
})
