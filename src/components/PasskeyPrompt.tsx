import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'

export function PasskeyPrompt() {
    const { user, passkeySupported, hasPasskey, refreshPasskeyStatus } = useAuth()
    const [isVisible, setIsVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        const isDismissed = localStorage.getItem('passkey_prompt_dismissed') === 'true'
        if (user && passkeySupported && !hasPasskey && !isDismissed) {
            setIsVisible(true)
        } else {
            setIsVisible(false)
        }
    }, [user, passkeySupported, hasPasskey])

    const handleDismiss = () => {
        localStorage.setItem('passkey_prompt_dismissed', 'true')
        setIsVisible(false)
    }

    const handleRegister = async () => {
        setLoading(true)
        setMessage(null)
        try {
            await passkeyService.register()
            await refreshPasskeyStatus()
            setMessage({ type: 'success', text: 'Avainkoodi rekisteröity onnistuneesti!' })
            // Auto-hide after success
            setTimeout(() => setIsVisible(false), 3000)
        } catch (error) {
            console.error('Passkey registration error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Virhe rekisteröinnissä.'
            setMessage({ type: 'error', text: errorMessage })
        } finally {
            setLoading(false)
        }
    }

    if (!isVisible) return null

    return (
        <div className="bg-indigo-600 shadow-lg">
            <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between flex-wrap">
                    <div className="w-0 flex-1 flex items-center">
                        <span className="flex p-2 rounded-lg bg-indigo-800">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </span>
                        <p className="ml-3 font-medium text-white truncate">
                            <span className="md:hidden">Kirjaudu nopeammin avainkoodilla!</span>
                            <span className="hidden md:inline">Ota käyttöön avainkoodi (Passkey) nopeampaa kirjautumista varten.</span>
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
                                    disabled={loading}
                                    className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50"
                                >
                                    {loading ? 'Rekisteröidään...' : 'Ota käyttöön'}
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="-mr-1 flex p-2 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
                                >
                                    <span className="sr-only">Sulje</span>
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
