import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Login from './Login'
import { supabase } from '../lib/supabase'
import * as AuthContext from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            signInWithOtp: vi.fn(),
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signInWithOAuth: vi.fn(),
        },
    },
}))

vi.mock('../lib/passkeyService', () => ({
    passkeyService: {
        login: vi.fn(),
    },
}))

const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    }
})

describe('Login', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
        } as any)
    })

    it('sends magic link when password is disabled', async () => {
        vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ error: null } as any)

        render(<Login />)

        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'test@example.com' },
        })

        fireEvent.click(screen.getByRole('button', { name: 'login.submitSendLink' }))

        await waitFor(() => {
            expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
                email: 'test@example.com',
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: window.location.origin,
                },
            })
        })
    })

    it('uses password login when enabled', async () => {
        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ error: null } as any)

        render(<Login />)

        fireEvent.click(screen.getByLabelText('login.usePassword'))
        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'test@example.com' },
        })
        fireEvent.change(screen.getByPlaceholderText('login.passwordPlaceholder'), {
            target: { value: 'secret' },
        })

        fireEvent.click(screen.getByRole('button', { name: 'login.submitLogin' }))

        await waitFor(() => {
            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'secret',
            })
        })
    })

    it('allows password signup', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null } as any)

        render(<Login />)

        fireEvent.click(screen.getByLabelText('login.usePassword'))
        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'new@example.com' },
        })
        fireEvent.change(screen.getByPlaceholderText('login.passwordPlaceholder'), {
            target: { value: 'new-pass' },
        })

        fireEvent.click(screen.getByRole('button', { name: 'login.createAccount' }))

        await waitFor(() => {
            expect(supabase.auth.signUp).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'new-pass',
            })
        })
    })

    it('shows error when password is missing', async () => {
        render(<Login />)

        fireEvent.click(screen.getByLabelText('login.usePassword'))
        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'test@example.com' },
        })

        const form = screen.getByRole('button', { name: 'login.submitLogin' }).closest('form')
        fireEvent.submit(form!)

        await waitFor(() => {
            expect(screen.getByText('login.errorMissingPassword')).toBeInTheDocument()
        })
    })

    it('shows error when password login fails', async () => {
        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
            error: new Error('bad credentials'),
        } as any)

        render(<Login />)

        fireEvent.click(screen.getByLabelText('login.usePassword'))
        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'test@example.com' },
        })
        fireEvent.change(screen.getByPlaceholderText('login.passwordPlaceholder'), {
            target: { value: 'secret' },
        })

        fireEvent.click(screen.getByRole('button', { name: 'login.submitLogin' }))

        await waitFor(() => {
            expect(screen.getByText(/bad credentials/i)).toBeInTheDocument()
        })
    })

    it('shows error when signup fails', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue({
            error: new Error('signup failed'),
        } as any)

        render(<Login />)

        fireEvent.click(screen.getByLabelText('login.usePassword'))
        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'new@example.com' },
        })
        fireEvent.change(screen.getByPlaceholderText('login.passwordPlaceholder'), {
            target: { value: 'new-pass' },
        })

        fireEvent.click(screen.getByRole('button', { name: 'login.createAccount' }))

        await waitFor(() => {
            expect(screen.getByText(/signup failed/i)).toBeInTheDocument()
        })
    })

    it('redirects when user already logged in', () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' },
        } as any)

        render(<Login />)

        expect(mockedNavigate).toHaveBeenCalledWith('/')
    })

    it('shows passkey login button when supported', () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            passkeySupported: true,
        } as any)

        render(<Login />)
        expect(screen.getByText('login.loginPasskey')).toBeInTheDocument()
    })

    it('hides passkey login button when not supported', () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            passkeySupported: false,
        } as any)

        render(<Login />)
        expect(screen.queryByText('login.loginPasskey')).not.toBeInTheDocument()
    })

    it('handles passkey login success', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            passkeySupported: true,
        } as any)
        vi.mocked(passkeyService.login).mockResolvedValue({ user: {} } as any)

        render(<Login />)
        fireEvent.click(screen.getByText('login.loginPasskey'))

        await waitFor(() => {
            expect(passkeyService.login).toHaveBeenCalled()
            expect(mockedNavigate).toHaveBeenCalledWith('/')
        })
    })

    it('handles passkey login failure', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            passkeySupported: true,
        } as any)
        vi.mocked(passkeyService.login).mockRejectedValue(new Error('Passkey failed'))

        render(<Login />)
        fireEvent.click(screen.getByText('login.loginPasskey'))

        await waitFor(() => {
            expect(screen.getByText(/Passkey failed/i)).toBeInTheDocument()
        })
    })

    it('handles google login success', async () => {
        vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({ error: null } as any)

        render(<Login />)
        fireEvent.click(screen.getByText(/login.loginGoogle/i))

        await waitFor(() => {
            expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'google'
            }))
        })
    })

    it('handles google login failure', async () => {
        vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({ error: new Error('Google failed') } as any)

        render(<Login />)
        fireEvent.click(screen.getByText(/login.loginGoogle/i))

        await waitFor(() => {
            expect(screen.getByText(/Google failed/i)).toBeInTheDocument()
        })
    })

    it('shows error when signup password is missing', async () => {
        render(<Login />)

        fireEvent.click(screen.getByLabelText('login.usePassword'))
        fireEvent.change(screen.getByLabelText('login.emailLabel'), {
            target: { value: 'new@example.com' },
        })
        // Leave password empty

        fireEvent.click(screen.getByRole('button', { name: 'login.createAccount' }))

        await waitFor(() => {
            expect(screen.getByText('login.errorMissingPassword')).toBeInTheDocument()
        })
    })
})
