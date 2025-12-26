import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import EventsList from './EventsList'
import { AuthProvider } from '../contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase')

describe('EventsList Timeout Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock Auth to be logged in
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: '123' } } },
            error: null,
        } as any)
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: { id: '123' } },
            error: null,
        } as any)
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)
    })

    it('triggers session check on timeout error', async () => {
        // Mock Events fetch to timeout
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') {
                return {
                    select: () => ({
                        order: () => ({
                            abortSignal: () => Promise.reject(new Error('Request timed out'))
                        })
                    })
                } as any
            }
            if (table === 'profiles') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: { role: 'user' }, error: null })
                        })
                    })
                } as any
            }
            return { select: vi.fn() } as any
        })

        // We want to verify that checkSession (or getUser) is called when timeout happens
        // Since we can't easily spy on the internal context method, we spy on supabase.auth.getUser
        // which checkSession should call.

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EventsList />
                </BrowserRouter>
            </AuthProvider>
        )

        // Wait for error message
        await waitFor(() => expect(screen.getByText(/Yhteys aikakatkaistiin/i)).toBeInTheDocument())

        // Verify getUser was called again (provenance: checkSession called it)
        // Initial calls: getSession (1), getUser (1) for auth init.
        // Recovery call: checkSession -> getUser (1)
        expect(supabase.auth.getUser).toHaveBeenCalledTimes(2)
    })
})
