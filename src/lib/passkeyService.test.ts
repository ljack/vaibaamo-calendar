import { describe, it, expect, vi, beforeEach } from 'vitest'
import { passkeyService } from './passkeyService'

// Mock @simplewebauthn/browser
vi.mock('@simplewebauthn/browser', () => ({
    startRegistration: vi.fn(),
    startAuthentication: vi.fn(),
}))

// Mock supabase
vi.mock('./supabase', () => ({
    getSupabase: vi.fn(),
}))

describe('passkeyService', () => {
    describe('isSupported', () => {
        it('should return true when browser supports WebAuthn', () => {
            // Setup
            window.PublicKeyCredential = {} as typeof PublicKeyCredential
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = vi.fn() as any
            window.PublicKeyCredential.isConditionalMediationAvailable = vi.fn() as any

            // Test
            const result = passkeyService.isSupported()

            // Assert
            expect(result).toBe(true)
        })

        it('should return false when browser does not support WebAuthn', () => {
            // Setup
            // @ts-expect-error - Testing undefined case
            window.PublicKeyCredential = undefined

            // Test
            const result = passkeyService.isSupported()

            // Assert
            expect(result).toBe(false)
        })
    })

    describe('register', () => {
        let mockSupabase: any
        let mockStartRegistration: any
        let getSupabase: any
        let startRegistration: any

        beforeEach(async () => {
            const supabaseModule = await import('./supabase')
            const webAuthnModule = await import('@simplewebauthn/browser')

            getSupabase = supabaseModule.getSupabase
            startRegistration = webAuthnModule.startRegistration
            mockStartRegistration = vi.mocked(startRegistration)

            mockSupabase = {
                functions: {
                    invoke: vi.fn(),
                },
            }
            vi.mocked(getSupabase).mockReturnValue(mockSupabase)
        })

        it('should successfully register a passkey', async () => {
            // Setup
            const mockRegOptions = { challenge: 'test-challenge' }
            const mockAttResp = { id: 'credential-id' }
            const mockVerification = { verified: true }

            mockSupabase.functions.invoke
                .mockResolvedValueOnce({ data: mockRegOptions, error: null })
                .mockResolvedValueOnce({ data: mockVerification, error: null })

            mockStartRegistration.mockResolvedValue(mockAttResp)

            // Test
            const result = await passkeyService.register()

            // Assert
            expect(result).toEqual(mockVerification)
            expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(2)
            expect(mockSupabase.functions.invoke).toHaveBeenNthCalledWith(1, 'auth-webauthn/register-options')
            expect(mockSupabase.functions.invoke).toHaveBeenNthCalledWith(2, 'auth-webauthn/register-verify', {
                body: mockAttResp,
            })
        })

        it('should throw error when registration options fail', async () => {
            // Setup
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: null,
                error: new Error('Failed to get options'),
            })

            // Test & Assert
            await expect(passkeyService.register()).rejects.toThrow()
        })

        it('should throw user-friendly error when user cancels registration', async () => {
            // Setup
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: { challenge: 'test' },
                error: null,
            })

            const notAllowedError = new Error('User cancelled')
            notAllowedError.name = 'NotAllowedError'
            mockStartRegistration.mockRejectedValue(notAllowedError)

            // Test & Assert
            await expect(passkeyService.register()).rejects.toThrow('Passkey-rekisteröinti peruutettiin tai aikakatkaistu')
        })

        it('should throw user-friendly error when passkey already exists', async () => {
            // Setup
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: { challenge: 'test' },
                error: null,
            })

            const invalidStateError = new Error('Already registered')
            invalidStateError.name = 'InvalidStateError'
            mockStartRegistration.mockRejectedValue(invalidStateError)

            // Test & Assert
            await expect(passkeyService.register()).rejects.toThrow('Tämä passkey on jo rekisteröity')
        })
    })

    describe('login', () => {
        let mockSupabase: any
        let mockStartAuthentication: any
        let getSupabase: any
        let startAuthentication: any

        beforeEach(async () => {
            const supabaseModule = await import('./supabase')
            const webAuthnModule = await import('@simplewebauthn/browser')

            getSupabase = supabaseModule.getSupabase
            startAuthentication = webAuthnModule.startAuthentication
            mockStartAuthentication = vi.mocked(startAuthentication)

            mockSupabase = {
                functions: {
                    invoke: vi.fn(),
                },
                auth: {
                    verifyOtp: vi.fn(),
                },
            }
            vi.mocked(getSupabase).mockReturnValue(mockSupabase)
        })

        it('should successfully login with passkey', async () => {
            // Setup
            const mockLoginOptions = {
                challenge: 'test-challenge',
                challengeId: 'challenge-id-123',
            }
            const mockAsseResp = { id: 'credential-id' }
            const mockVerification = {
                verified: true,
                properties: {
                    hashed_token: 'token-hash',
                    email: 'test@example.com',
                    action_link: 'https://example.com/verify',
                },
            }
            const mockAuthData = { user: { id: 'user-123' } }

            mockSupabase.functions.invoke
                .mockResolvedValueOnce({ data: mockLoginOptions, error: null })
                .mockResolvedValueOnce({ data: mockVerification, error: null })

            mockStartAuthentication.mockResolvedValue(mockAsseResp)
            mockSupabase.auth.verifyOtp.mockResolvedValue({ data: mockAuthData, error: null })

            // Test
            const result = await passkeyService.login()

            // Assert
            expect(result).toEqual(mockAuthData)
            expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(2)
            expect(mockSupabase.functions.invoke).toHaveBeenNthCalledWith(1, 'auth-webauthn/login-options')
            expect(mockSupabase.functions.invoke).toHaveBeenNthCalledWith(2, 'auth-webauthn/login-verify', {
                body: { ...mockAsseResp, challengeId: 'challenge-id-123' },
            })
            expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
                email: 'test@example.com',
                token: 'token-hash',
                type: 'magiclink',
            })
        })

        it('should throw error when login options fail', async () => {
            // Setup
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: null,
                error: new Error('Failed to get options'),
            })

            // Test & Assert
            await expect(passkeyService.login()).rejects.toThrow()
        })

        it('should throw error when challengeId is missing', async () => {
            // Setup
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: { challenge: 'test' },
                error: null,
            })

            // Test & Assert
            await expect(passkeyService.login()).rejects.toThrow('Palvelin ei palauttanut haaste-tunnistetta')
        })

        it('should throw user-friendly error when user cancels login', async () => {
            // Setup
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: { challenge: 'test', challengeId: '123' },
                error: null,
            })

            const notAllowedError = new Error('User cancelled')
            notAllowedError.name = 'NotAllowedError'
            mockStartAuthentication.mockRejectedValue(notAllowedError)

            // Test & Assert
            await expect(passkeyService.login()).rejects.toThrow('Kirjautuminen peruutettiin tai aikakatkaistu')
        })

        it('should throw error when verification succeeds but no login data returned', async () => {
            // Setup
            mockSupabase.functions.invoke
                .mockResolvedValueOnce({
                    data: { challenge: 'test', challengeId: '123' },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { verified: true, properties: null },
                    error: null,
                })

            mockStartAuthentication.mockResolvedValue({ id: 'cred' })

            // Test & Assert
            await expect(passkeyService.login()).rejects.toThrow('Kirjautuminen epäonnistui')
        })
    })
})
