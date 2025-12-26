import { render, screen, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            getUser: vi.fn(),
            onAuthStateChange: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null })
                })
            })
        }),
    },
}))

// Test Component to consume context
const TestComponent = () => {
    const { session, user, signOut, loading, checkSession } = useAuth() as any
    return (
        <div>
            {loading ? 'Loading...' : 'Loaded'}
            <div data-testid="session-status">{session ? 'Logged In' : 'Logged Out'}</div>
            <div data-testid="user-email">{user?.email}</div>
            <button onClick={signOut}>Sign Out</button>
            <button onClick={checkSession}>Check Session</button>
        </div>
    )
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.defineProperty(window, 'localStorage', {
            value: {
                clear: vi.fn(),
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
            },
            writable: true
        })
        window.localStorage.clear()

        // Default mocks
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: null },
            error: null,
        } as any)
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: null },
            error: null,
        } as any)
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)
    })

    it('signOut clears local state immediately even if backend fails', async () => {
        // Setup initial logged in state
        const mockSession = { user: { id: '123', email: 'test@example.com' } }
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: mockSession },
            error: null,
        } as any)
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: mockSession.user },
            error: null,
        } as any)

        // Mock signOut to hang/fail
        vi.mocked(supabase.auth.signOut).mockImplementation(async () => {
            throw new Error('Network error')
        })

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText('Logged In')).toBeInTheDocument())

        const signOutBtn = screen.getByText('Sign Out')
        await act(async () => {
            signOutBtn.click()
        })

        // Should be logged out immediately despite error
        await waitFor(() => expect(screen.getByText('Logged Out')).toBeInTheDocument())
        expect(screen.queryByText('test@example.com')).not.toBeInTheDocument()
    })
})
