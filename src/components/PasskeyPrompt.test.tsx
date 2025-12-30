
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
        expect(screen.getByText('passkey.promoDesktop')).toBeInTheDocument()
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
            expect(screen.getByText('passkey.errorRegister')).toBeInTheDocument()
        })
    })
})
