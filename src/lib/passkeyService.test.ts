
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { passkeyService } from './passkeyService'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

const { mockSupabase } = vi.hoisted(() => {
    return {
        mockSupabase: {
            functions: {
                invoke: vi.fn(),
            },
            auth: {
                verifyOtp: vi.fn(),
            },
        }
    }
})

vi.mock('@simplewebauthn/browser', () => ({
    startRegistration: vi.fn(),
    startAuthentication: vi.fn(),
}))

vi.mock('./supabase', () => ({
    getSupabase: vi.fn(() => mockSupabase),
    supabase: mockSupabase,
}))

describe('passkeyService', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock global window objects
        Object.defineProperty(window, 'PublicKeyCredential', {
            value: {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
                isConditionalMediationAvailable: vi.fn().mockResolvedValue(true),
            },
            configurable: true,
            writable: true
        })
    })

    describe('isSupported', () => {
        it('returns true if all required APIs are present', () => {
            expect(passkeyService.isSupported()).toBe(true)
        })

        it('returns false if PublicKeyCredential is missing', () => {
            const original = (window as any).PublicKeyCredential
            // Use defineProperty to set it to undefined since it's hard to delete from window in jsdom sometimes
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: undefined,
                configurable: true
            })
            expect(passkeyService.isSupported()).toBe(false)
            // Restore
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: original,
                configurable: true
            })
        })

        it('returns false if sub-APIs are missing', () => {
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: {
                    isUserVerifyingPlatformAuthenticatorAvailable: undefined
                },
                configurable: true
            })
            expect(passkeyService.isSupported()).toBe(false)
        })
    })

    describe('register', () => {
        it('calls registration flow successfully', async () => {
            const mockOptions = { challenge: 'abc' }
            const mockAttResp = { id: 'cre-123' }
            const mockVerification = { verified: true }

            vi.mocked(mockSupabase.functions.invoke)
                .mockResolvedValueOnce({ data: mockOptions, error: null }) // options
                .mockResolvedValueOnce({ data: mockVerification, error: null }) // verify

            vi.mocked(startRegistration).mockResolvedValue(mockAttResp as any)

            const result = await passkeyService.register()

            expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('auth-webauthn/register-options')
            expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: mockOptions })
            expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('auth-webauthn/register-verify', {
                body: mockAttResp
            })
            expect(result).toEqual(mockVerification)
        })

        it('throws error if options fetch fails', async () => {
            vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
                data: null,
                error: new Error('options fail')
            })

            await expect(passkeyService.register()).rejects.toThrow('options fail')
        })

        it('throws error if verification fails', async () => {
            vi.mocked(mockSupabase.functions.invoke)
                .mockResolvedValueOnce({ data: {}, error: null })
                .mockResolvedValueOnce({ data: null, error: new Error('verify fail') })

            vi.mocked(startRegistration).mockResolvedValue({} as any)

            await expect(passkeyService.register()).rejects.toThrow('verify fail')
        })
    })

    describe('login', () => {
        it('calls login flow and verifies OTP successfully', async () => {
            const mockOptions = { challenge: 'abc' }
            const mockAsseResp = { id: 'cre-123' }
            const mockVerification = {
                verified: true,
                hashed_token: 'token-123',
                email: 'test@example.com'
            }
            const mockAuthData = { user: { id: 'u1' } }

            vi.mocked(mockSupabase.functions.invoke)
                .mockResolvedValueOnce({ data: mockOptions, error: null }) // options
                .mockResolvedValueOnce({ data: mockVerification, error: null }) // verify

            vi.mocked(startAuthentication).mockResolvedValue(mockAsseResp as any)
            vi.mocked(mockSupabase.auth.verifyOtp).mockResolvedValue({ data: mockAuthData, error: null } as any)

            const result = await passkeyService.login()

            expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('auth-webauthn/login-options')
            expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: mockOptions })
            expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
                email: 'test@example.com',
                token: 'token-123',
                type: 'magiclink'
            })
            expect(result).toEqual(mockAuthData)
        })

        it('uses email_otp if present', async () => {
            const mockVerification = {
                verified: true,
                email_otp: '123456',
                email: 'test@example.com'
            }

            vi.mocked(mockSupabase.functions.invoke)
                .mockResolvedValueOnce({ data: {}, error: null })
                .mockResolvedValueOnce({ data: mockVerification, error: null })

            vi.mocked(startAuthentication).mockResolvedValue({} as any)
            vi.mocked(mockSupabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null } as any)

            await passkeyService.login()

            expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({
                token: '123456',
                type: 'email'
            }))
        })

        it('throws error if verification succeeds but no tokens returned', async () => {
            vi.mocked(mockSupabase.functions.invoke)
                .mockResolvedValueOnce({ data: {}, error: null })
                .mockResolvedValueOnce({ data: { verified: true }, error: null })

            vi.mocked(startAuthentication).mockResolvedValue({} as any)

            await expect(passkeyService.login()).rejects.toThrow('Login failed: Verification succeeded but no login link returned')
        })

        it('throws error if auth.verifyOtp fails', async () => {
            vi.mocked(mockSupabase.functions.invoke)
                .mockResolvedValueOnce({ data: {}, error: null })
                .mockResolvedValueOnce({ data: { verified: true, hashed_token: 't', email: 'e' }, error: null })

            vi.mocked(startAuthentication).mockResolvedValue({} as any)
            vi.mocked(mockSupabase.auth.verifyOtp).mockResolvedValue({
                data: { user: null, session: null },
                error: new Error('auth fail')
            } as any)

            await expect(passkeyService.login()).rejects.toThrow('auth fail')
        })
    })

    it('throws error if login options fetch fails', async () => {
        vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
            data: null,
            error: new Error('login options fail')
        })

        await expect(passkeyService.login()).rejects.toThrow('login options fail')
    })

    it('throws error if login verification fails', async () => {
        vi.mocked(mockSupabase.functions.invoke)
            .mockResolvedValueOnce({ data: { challenge: 'abc' }, error: null })
            .mockResolvedValueOnce({ data: null, error: new Error('login verify fail') })

        vi.mocked(startAuthentication).mockResolvedValue({} as any)

        await expect(passkeyService.login()).rejects.toThrow('login verify fail')
    })
})
