
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PasskeyPrompt } from './PasskeyPrompt'
import { useAuth } from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}))

vi.mock('../lib/passkeyService', () => ({
    passkeyService: {
        register: vi.fn(),
    },
}))

// More robust localStorage mock
const store: Record<string, string> = {}
const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString()
    }),
    clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key])
    }),
    removeItem: vi.fn((key: string) => {
        delete store[key]
    }),
}

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
})

describe('PasskeyPrompt', () => {
    const mockRefreshPasskeyStatus = vi.fn()
    const defaultAuthContext = {
        user: { id: 'u1' },
        loading: false,
        passkeySupported: true,
        hasPasskey: false,
        refreshPasskeyStatus: mockRefreshPasskeyStatus,
    }

    beforeEach(() => {
        vi.resetAllMocks()
        localStorage.clear()
        vi.mocked(useAuth).mockReturnValue(defaultAuthContext as any)

        // Ensure getItem returns null after clear
        vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] || null)
    })

    it('renders when supported and not registered or dismissed', () => {
        render(<PasskeyPrompt />)
        expect(screen.getByText('passkey.promoMobile')).toBeInTheDocument()
    })

    it('does not render when auth is loading', () => {
        vi.mocked(useAuth).mockReturnValue({ ...defaultAuthContext, loading: true } as any)
        render(<PasskeyPrompt />)
        expect(screen.queryByText('passkey.promoMobile')).not.toBeInTheDocument()
    })

    it('does not render when user has passkey', () => {
        vi.mocked(useAuth).mockReturnValue({ ...defaultAuthContext, hasPasskey: true } as any)
        render(<PasskeyPrompt />)
        expect(screen.queryByText('passkey.promoMobile')).not.toBeInTheDocument()
    })

    it('does not render when passkey not supported', () => {
        vi.mocked(useAuth).mockReturnValue({ ...defaultAuthContext, passkeySupported: false } as any)
        render(<PasskeyPrompt />)
        expect(screen.queryByText('passkey.promoMobile')).not.toBeInTheDocument()
    })

    it('does not render when dismissed in localStorage', () => {
        store['passkey_prompt_dismissed'] = 'true'
        render(<PasskeyPrompt />)
        expect(screen.queryByText('passkey.promoMobile')).not.toBeInTheDocument()
    })

    it('dismisses when close button is clicked', () => {
        render(<PasskeyPrompt />)
        const closeBtn = screen.getByText('passkey.dismiss')
        fireEvent.click(closeBtn)
        expect(localStorage.setItem).toHaveBeenCalledWith('passkey_prompt_dismissed', 'true')
        expect(screen.queryByText('passkey.promoMobile')).not.toBeInTheDocument()
    })

    it('registers passkey successfully', async () => {
        vi.mocked(passkeyService.register).mockResolvedValue({ verified: true } as any)

        render(<PasskeyPrompt />)
        const registerBtn = screen.getByText('passkey.registerButton')

        fireEvent.click(registerBtn)

        expect(screen.getByText('passkey.registerButtonLoading')).toBeInTheDocument()

        await waitFor(() => {
            expect(passkeyService.register).toHaveBeenCalled()
            expect(mockRefreshPasskeyStatus).toHaveBeenCalled()
            expect(screen.getByText('passkey.successRegister')).toBeInTheDocument()
        })
    })

    it('shows error message when registration fails', async () => {
        vi.mocked(passkeyService.register).mockRejectedValue(new Error('fail'))

        render(<PasskeyPrompt />)
        const registerBtn = screen.getByText('passkey.registerButton')

        fireEvent.click(registerBtn)

        await waitFor(() => {
            expect(screen.getByText('fail')).toBeInTheDocument()
        })
    })

    it('hides success message after timeout', async () => {
        vi.useFakeTimers()
        vi.mocked(passkeyService.register).mockResolvedValue({ verified: true } as any)

        render(<PasskeyPrompt />)

        // The register button should be visible now
        const registerBtn = screen.getByText('passkey.registerButton')
        fireEvent.click(registerBtn)

        // We need to advance timers or flush promises for the register call to complete
        // In Vitest, advancing timers helps with promises if they are connected to timers, 
        // but here we just need to wait for the async handleRegister to continue after the await.
        await act(async () => {
            await vi.runAllTicks()
        })

        expect(screen.getByText('passkey.successRegister')).toBeInTheDocument()

        // Now advance 3000ms for the auto-hide
        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(screen.queryByText('passkey.promoMobile')).not.toBeInTheDocument()

        vi.useRealTimers()
    })
})
