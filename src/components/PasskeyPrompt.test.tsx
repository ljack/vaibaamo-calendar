import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasskeyPrompt } from './PasskeyPrompt'
import * as AuthContext from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}))

// Mock the passkeyService
vi.mock('../lib/passkeyService', () => ({
    passkeyService: {
        register: vi.fn(),
    },
}))

describe('PasskeyPrompt', () => {
    const mockRefreshPasskeyStatus = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('should not render when user is not logged in', () => {
        // Setup
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Test
        const { container } = render(<PasskeyPrompt />)

        // Assert
        expect(container).toBeEmptyDOMElement()
    })

    it('should not render when passkey is not supported', () => {
        // Setup
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: false,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Test
        const { container } = render(<PasskeyPrompt />)

        // Assert
        expect(container).toBeEmptyDOMElement()
    })

    it('should not render when user already has a passkey', () => {
        // Setup
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: true,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Test
        const { container } = render(<PasskeyPrompt />)

        // Assert
        expect(container).toBeEmptyDOMElement()
    })

    it('should not render when prompt has been dismissed', () => {
        // Setup
        localStorage.setItem('passkey_prompt_dismissed', 'true')
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Test
        const { container } = render(<PasskeyPrompt />)

        // Assert
        expect(container).toBeEmptyDOMElement()
    })

    it('should render when user is logged in, passkey is supported, and user has no passkey', () => {
        // Setup
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Test
        render(<PasskeyPrompt />)

        // Assert
        expect(screen.getByText(/Kirjaudu nopeammin avainkoodilla/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Ota käyttöön/i })).toBeInTheDocument()
    })

    it('should dismiss the prompt when close button is clicked', async () => {
        // Setup
        const user = userEvent.setup()
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Test
        const { container } = render(<PasskeyPrompt />)
        const closeButton = screen.getByRole('button', { name: /Sulje/i })
        await user.click(closeButton)

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement()
        })
        expect(localStorage.getItem('passkey_prompt_dismissed')).toBe('true')
    })

    it('should successfully register a passkey', async () => {
        // Setup
        const user = userEvent.setup()
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)
        vi.mocked(passkeyService.register).mockResolvedValue({ verified: true })

        // Test
        render(<PasskeyPrompt />)
        const registerButton = screen.getByRole('button', { name: /Ota käyttöön/i })
        await user.click(registerButton)

        // Assert
        await waitFor(() => {
            expect(passkeyService.register).toHaveBeenCalled()
            expect(mockRefreshPasskeyStatus).toHaveBeenCalled()
        })
        expect(screen.getByText(/Avainkoodi rekisteröity onnistuneesti/i)).toBeInTheDocument()
    })

    it('should show error message when registration fails', async () => {
        // Setup
        const user = userEvent.setup()
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)
        vi.mocked(passkeyService.register).mockRejectedValue(new Error('Test error message'))

        // Test
        render(<PasskeyPrompt />)
        const registerButton = screen.getByRole('button', { name: /Ota käyttöön/i })
        await user.click(registerButton)

        // Assert
        await waitFor(() => {
            expect(screen.getByText(/Test error message/i)).toBeInTheDocument()
        })
        expect(mockRefreshPasskeyStatus).not.toHaveBeenCalled()
    })

    it('should show loading state during registration', async () => {
        // Setup
        const user = userEvent.setup()
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-123' },
            passkeySupported: true,
            hasPasskey: false,
            refreshPasskeyStatus: mockRefreshPasskeyStatus,
        } as any)

        // Create a promise that we can control
        let resolveRegister: (value: any) => void
        const registerPromise = new Promise((resolve) => {
            resolveRegister = resolve
        })
        vi.mocked(passkeyService.register).mockReturnValue(registerPromise)

        // Test
        render(<PasskeyPrompt />)
        const registerButton = screen.getByRole('button', { name: /Ota käyttöön/i })
        await user.click(registerButton)

        // Assert - button should show loading state
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Rekisteröidään/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Rekisteröidään/i })).toBeDisabled()
        })

        // Clean up - resolve the promise
        resolveRegister!({ verified: true })
    })
})
