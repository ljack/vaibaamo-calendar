import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the real supabase client
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockReturnValue(Promise.resolve({ data: { session: null } })),
            getUser: vi.fn().mockReturnValue(Promise.resolve({ data: { user: null } })),
            onAuthStateChange: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn()
                }))
            }))
        }))
    },
}))

const TestComponent = () => {
    const { user, loading, isAdmin } = useAuth()
    if (loading) return <div>Loading...</div>
    return (
        <div>
            <div data-testid="user">{user ? user.email : 'No User'}</div>
            <div data-testid="admin">{isAdmin ? 'Admin' : 'Not Admin'}</div>
        </div>
    )
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('provides user session when authenticated', async () => {
        vi.clearAllMocks() // Ensure clean state
        const mockSession = { user: { id: '123', email: 'test@example.com' } }

        // Mock getSession
        const getSessionMock = vi.mocked(supabase.auth.getSession)
        getSessionMock.mockResolvedValue({ data: { session: mockSession } } as any)

        // Mock getUser (NEW validation)
        const getUserMock = vi.mocked(supabase.auth.getUser)
        getUserMock.mockResolvedValue({ data: { user: mockSession.user } } as any)

        // Mock onAuthStateChange
        const onAuthStateChangeMock = vi.mocked(supabase.auth.onAuthStateChange)
        onAuthStateChangeMock.mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } }
        } as any);

        // Mock profile check (not admin)
        // Mock profile check (not admin)
        // Access the mock directly from the imported object since we mocked the module
        (supabase.from as any).mockImplementation(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { role: 'user' } })
                }))
            }))
        }))


        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
            expect(screen.getByTestId('admin')).toHaveTextContent('Not Admin')
        })
    })

    it('detects admin role correctly', async () => {
        vi.clearAllMocks() // Ensure clean state
        const mockSession = { user: { id: 'admin123', email: 'admin@example.com' } }

        const getSessionMock = vi.mocked(supabase.auth.getSession)
        getSessionMock.mockResolvedValue({ data: { session: mockSession } } as any)

        const getUserMock = vi.mocked(supabase.auth.getUser)
        getUserMock.mockResolvedValue({ data: { user: mockSession.user } } as any)

        const onAuthStateChangeMock = vi.mocked(supabase.auth.onAuthStateChange)
        onAuthStateChangeMock.mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } }
        } as any);

        // Mock profile check (IS admin)
        (supabase.from as any).mockImplementation(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { role: 'admin' } })
                }))
            }))
        }))

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('admin@example.com')
            expect(screen.getByTestId('admin')).toHaveTextContent('Admin')
        })
    })

    it('handles unauthenticated state', async () => {
        const getSessionMock = vi.mocked(supabase.auth.getSession)
        getSessionMock.mockResolvedValue({ data: { session: null } } as any)

        const onAuthStateChangeMock = vi.mocked(supabase.auth.onAuthStateChange)
        onAuthStateChangeMock.mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } }
        } as any)

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('No User')
        })
    })

    it('calls signOut successfully', async () => {
        const signOutMock = vi.mocked(supabase.auth.signOut)
        signOutMock.mockResolvedValue({ error: null })

        const TestSignOut = () => {
            const { signOut } = useAuth()
            return <button onClick={signOut}>Sign Out</button>
        }

        render(
            <AuthProvider>
                <TestSignOut />
            </AuthProvider>
        )

        fireEvent.click(screen.getByText('Sign Out'))
        expect(signOutMock).toHaveBeenCalled()
    })
})
