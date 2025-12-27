// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initAuthOnce } from '../lib/authBootstrap'

// Mock Supabase client
// Use vi.hoisted to share mocks between factory and tests
const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    from: vi.fn(),
}))

vi.mock('../lib/supabase', () => {
    const mockClient = {
        auth: {
            getSession: mocks.getSession,
            getUser: mocks.getUser,
            signOut: mocks.signOut,
            onAuthStateChange: mocks.onAuthStateChange,
        },
        from: mocks.from,
    }
    return {
        supabase: mockClient,
        getSupabase: () => mockClient
    }
})

vi.mock('../lib/authBootstrap', () => ({
    initAuthOnce: vi.fn(),
}))

// Test component to consume context
const TestComponent = () => {
    const { loading, user } = useAuth()
    if (loading) return <div>Loading...</div>
    return <div>{user ? 'Logged In' : 'Logged Out'}</div>
}

const ActionsComponent = () => {
    const { loading, user, signOut, checkSession } = useAuth()
    if (loading) return <div>Loading...</div>
    return (
        <div>
            <div>{user ? 'Logged In' : 'Logged Out'}</div>
            <button onClick={() => signOut()}>Sign Out</button>
            <button onClick={() => checkSession()}>Check Session</button>
        </div>
    )
}

describe('AuthProvider Regression Test', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: null,
            user: null,
            initialized: true,
            timedOut: false,
        } as any)
        mocks.from.mockImplementation(() => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: { role: 'user' }, error: null }),
                }),
            }),
        }))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should stop loading even if supabase.auth.getSession throws an error', async () => {
        // Simulate a critical failure (e.g. network error)
        vi.mocked(initAuthOnce).mockRejectedValue(new Error('Network Error'))

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
        expect(initAuthOnce).toHaveBeenCalledTimes(1)
    })

    it('should recover from a hanging session check (timeout)', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: null,
            user: null,
            initialized: true,
            timedOut: true,
        } as any)
        mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })

        // Use fake timers to fast-forward the 2s timeout
        vi.useFakeTimers()

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        expect(screen.getByText('Loading...')).toBeInTheDocument()

        // Fast-forward past the retry delay
        vi.advanceTimersByTime(2500)
        vi.useRealTimers()

        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })
    })

    it('should show logged in when session is found', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })
    })

    it('clears session when signOut is called', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.signOut.mockResolvedValue({})

        render(
            <AuthProvider>
                <ActionsComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Sign Out'))

        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })
        expect(mocks.signOut).toHaveBeenCalled()
    })

    it('logs error when signOut fails', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.signOut.mockRejectedValue(new Error('signout failed'))

        render(
            <AuthProvider>
                <ActionsComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Sign Out'))

        await waitFor(() => {
            expect(errorSpy).toHaveBeenCalled()
        })

        errorSpy.mockRestore()
    })

    it('returns false from checkSession when session is missing', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
        mocks.signOut.mockResolvedValue({})

        render(
            <AuthProvider>
                <ActionsComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Check Session'))

        await waitFor(() => {
            expect(mocks.signOut).toHaveBeenCalled()
        })

        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })
    })

    it('refreshes session on window focus', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.getSession.mockResolvedValue({ data: { session: { user: { id: '123' } } }, error: null })

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        const initialCalls = mocks.getSession.mock.calls.length
        window.dispatchEvent(new Event('focus'))

        await waitFor(() => {
            expect(mocks.getSession.mock.calls.length).toBeGreaterThan(initialCalls)
        })
    })

    it('clears user when focus refresh returns null session', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        window.dispatchEvent(new Event('focus'))

        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })
    })

    it('refreshes session on visibility change', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.getSession.mockResolvedValue({ data: { session: { user: { id: '123' } } }, error: null })

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            configurable: true,
        })

        const initialCalls = mocks.getSession.mock.calls.length
        document.dispatchEvent(new Event('visibilitychange'))

        await waitFor(() => {
            expect(mocks.getSession.mock.calls.length).toBeGreaterThan(initialCalls)
        })
    })

    it('sets admin flag when profile role is admin', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: 'admin' } },
            user: { id: 'admin' },
            initialized: true,
            timedOut: false,
        } as any)

        const AdminComponent = () => {
            const { isAdmin, loading } = useAuth()
            if (loading) return <div>Loading...</div>
            return <div>{isAdmin ? 'Admin' : 'User'}</div>
        }

        mocks.from.mockImplementation(() => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
                }),
            }),
        }))

        render(
            <AuthProvider>
                <AdminComponent />
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
    })

    it('handles admin role lookup errors', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: 'admin' } },
            user: { id: 'admin' },
            initialized: true,
            timedOut: false,
        } as any)

        const AdminComponent = () => {
            const { isAdmin, loading } = useAuth()
            if (loading) return <div>Loading...</div>
            return <div>{isAdmin ? 'Admin' : 'User'}</div>
        }

        mocks.from.mockImplementation(() => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.reject(new Error('bad role lookup')),
                }),
            }),
        }))

        render(
            <AuthProvider>
                <AdminComponent />
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByText('User')).toBeInTheDocument())
        expect(errorSpy).toHaveBeenCalled()
        errorSpy.mockRestore()
    })

    it('populates session after retry when timed out', async () => {
        vi.useFakeTimers()
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: null,
            user: null,
            initialized: true,
            timedOut: true,
        } as any)
        mocks.getSession.mockResolvedValue({
            data: { session: { user: { id: 'retry' } } },
            error: null,
        })

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await vi.runAllTimersAsync()
        vi.useRealTimers()

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })
    })

    it('handles bootstrap errors gracefully', async () => {
        vi.mocked(initAuthOnce).mockRejectedValue(new Error('boom'))

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged Out')).toBeInTheDocument()
        })
    })

    it('returns false when checkSession throws', async () => {
        vi.mocked(initAuthOnce).mockResolvedValue({
            session: { user: { id: '123' } },
            user: { id: '123' },
            initialized: true,
            timedOut: false,
        } as any)
        mocks.getSession.mockRejectedValue(new Error('offline'))
        mocks.signOut.mockResolvedValue({})

        render(
            <AuthProvider>
                <ActionsComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged In')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Check Session'))

        await waitFor(() => {
            expect(mocks.signOut).toHaveBeenCalled()
        })
    })
})
