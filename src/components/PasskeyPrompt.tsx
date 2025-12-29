import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'
import { getPasskeys } from '../lib/supakeys'
import { useTranslation } from 'react-i18next'

export function PasskeyPrompt() {
    const { t } = useTranslation()
    const { user, loading: authLoading, passkeySupported, hasPasskey, refreshPasskeyStatus } = useAuth()
    const [isVisible, setIsVisible] = useState(false)
    const [loadingAction, setLoadingAction] = useState<'legacy' | 'supakeys' | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [hasSupakey, setHasSupakey] = useState(false)

    useEffect(() => {
        const checkSupakeys = async () => {
            if (user) {
                const passkeysClient = getPasskeys()
                const { passkeys, error } = await passkeysClient.listPasskeys()
                if (passkeys && passkeys.length > 0) {
                    setHasSupakey(true)
                }
                if (error) {
                    console.error('Error listing supakeys:', error)
                }
            }
        }
        checkSupakeys()
    }, [user])

    useEffect(() => {
        const isDismissed = localStorage.getItem('passkey_prompt_dismissed') === 'true'
        // If user has passkey, show the banner regardless of dismissal (or use a different state for "congrats" banner)
        // Check logic: 
        // 1. Not loading
        // 2. User logged in
        // 3. Passkey supported
        // 4. (No passkey AND not dismissed) OR (Has passkey = show secure banner)

        if (!authLoading && user && passkeySupported) {
            if (hasPasskey || hasSupakey) {
                setIsVisible(true) // Show "Secure" banner
            } else if (!isDismissed) {
                setIsVisible(true) // Show "Setup" banner
            } else {
                setIsVisible(false)
            }
        } else {
            setIsVisible(false)
        }
    }, [user, authLoading, passkeySupported, hasPasskey, hasSupakey])

    const handleDismiss = () => {
        localStorage.setItem('passkey_prompt_dismissed', 'true')
        setIsVisible(false)
    }

    const handleRegister = async () => {
        setLoadingAction('legacy')
        setMessage(null)
        try {
            await passkeyService.register(`${user?.email} (Standard)`)

            await refreshPasskeyStatus()
            setMessage({ type: 'success', text: t('passkey.successRegister') })
            // Auto-hide after success
            setTimeout(() => setIsVisible(false), 3000)
        } catch (error: any) {
            console.error('Passkey registration error:', error)
            setMessage({ type: 'error', text: error.message || t('passkey.errorRegister') })
        } finally {
            setLoadingAction(null)
        }
    }

    const handleSupakeysRegister = async () => {
        setLoadingAction('supakeys')
        setMessage(null)
        try {
            if (!user?.email) throw new Error("Ei sähköpostia saatavilla user-objektista")

            const passkeys = getPasskeys()
            const { success, error } = await passkeys.register({
                email: user.email,
                displayName: `${user.email} (Supakeys)`
            })

            if (error) throw new Error(error.message)

            if (success) {
                setHasSupakey(true)
                setMessage({ type: 'success', text: t('passkey.successSupakeysRegister') })
                setTimeout(() => setIsVisible(false), 3000)
            }
        } catch (error: any) {
            console.error('Supakeys registration error:', error)
            setMessage({ type: 'error', text: error.message || t('passkey.errorSupakeysRegister') })
        } finally {
            setLoadingAction(null)
        }
    }

    if (!isVisible) return null

    return (
        <div className="bg-indigo-600 shadow-lg">
            <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between flex-wrap">
                    <div className="w-0 flex-1 flex items-center">
                        <span className={`flex p-2 rounded-lg ${hasPasskey || hasSupakey ? 'bg-green-800' : 'bg-indigo-800'}`}>
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {hasPasskey || hasSupakey ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                )}
                            </svg>
                        </span>
                        <p className="ml-3 font-medium text-white truncate">
                            {hasPasskey || hasSupakey ? (
                                <>
                                    <span className="md:hidden">{t('passkey.congratsMobile')}</span>
                                    <span className="hidden md:inline">{t('passkey.congratsDesktop')}</span>
                                </>
                            ) : (
                                <>
                                    <span className="md:hidden">{t('passkey.promoMobile')}</span>
                                    <span className="hidden md:inline">{t('passkey.promoDesktop')}</span>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto flex items-center gap-3">
                        {message ? (
                            <span className={`text-sm font-bold ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                                {message.text}
                            </span>
                        ) : (
                            <>
                                <button
                                    onClick={handleRegister}
                                    disabled={!!loadingAction || hasPasskey}
                                    className={`flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 
                                    ${hasPasskey || (loadingAction && loadingAction !== 'legacy') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    data-testid="passkey-register-button"
                                >
                                    {loadingAction === 'legacy'
                                        ? t('passkey.registerButtonLoading')
                                        : hasPasskey
                                            ? t('passkey.passkeyInUse')
                                            : t('passkey.registerButton')}
                                </button>
                                <button
                                    onClick={handleSupakeysRegister}
                                    disabled={!!loadingAction || hasSupakey}
                                    className={`flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                    ${hasSupakey || (loadingAction && loadingAction !== 'supakeys') ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-400'}`}
                                    data-testid="supakeys-register-button"
                                >
                                    {loadingAction === 'supakeys'
                                        ? t('passkey.registerButtonLoading')
                                        : hasSupakey
                                            ? t('passkey.supakeysInUse')
                                            : 'Supakeys'}
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="-mr-1 flex p-2 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
                                >
                                    <span className="sr-only">{t('passkey.dismiss')}</span>
                                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
