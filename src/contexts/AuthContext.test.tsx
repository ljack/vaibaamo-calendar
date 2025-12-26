import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Supabase client
const mockGetSession = vi.fn()
const mockGetUser = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: () => mockGetSession(),
            getUser: () => mockGetUser(),
            signOut: () => mockSignOut(),
            onAuthStateChange: () => mockOnAuthStateChange(),
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: { role: 'user' } })
                })
            })
        })
    }
}))

// Test component to consume context
const TestComponent = () => {
    const { loading, user } = useAuth()
    if (loading) return <div>Loading...</div>
    return <div>{user ? 'Logged In' : 'Logged Out'}</div>
}

describe('AuthProvider Regression Test', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should stop loading even if supabase.auth.getSession throws an error', async () => {
        // Simulate a critical failure (e.g. network error)
        mockGetSession.mockRejectedValue(new Error('Network Error'))

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        // It should initially show loading
        expect(screen.getByText('Loading...')).toBeInTheDocument()

        // But eventually it MUST resolve to "Logged Out" (or just not loading)
        // If the bug exists, this will timeout waiting for 'Logged Out'
        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })

        // Verify the error didn't crash the app, just handled gracefully
        expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it('should stop loading if session is found but invalid', async () => {
        // Simulate finding a session but getUser fails (e.g. user deleted)
        mockGetSession.mockResolvedValue({ data: { session: { user: { id: '123' } } }, error: null })
        mockGetUser.mockRejectedValue(new Error('User not found'))

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })
    })
})
