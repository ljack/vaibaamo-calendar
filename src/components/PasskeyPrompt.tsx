import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'
import { getPasskeys } from '../lib/supakeys'
import { useTranslation } from 'react-i18next'
import { PasskeyManager } from './PasskeyManager';

export function PasskeyPrompt() {
    const { t } = useTranslation()
    const { user, hasPasskey, refreshPasskeyStatus } = useAuth()
    const [loadingAction, setLoadingAction] = useState<'legacy' | 'supakeys' | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [hasSupakey, setHasSupakey] = useState(false)
    const [showManager, setShowManager] = useState(false)

    useEffect(() => {
        const checkSupakeys = async () => {
            if (!user) return
            try {
                const passkeys = getPasskeys()
                const { passkeys: list } = await passkeys.listPasskeys()
                if (list && list.length > 0) {
                    setHasSupakey(true)
                }
            } catch (e) {
                console.error("Error checking supakeys:", e)
            }
        }
        checkSupakeys()
    }, [user, loadingAction])

    const handleRegister = async () => {
        if (!user) return
        setLoadingAction('legacy')
        setMessage(null)
        try {
            await passkeyService.register(`${user?.email} (Standard)`)

            await refreshPasskeyStatus()
            setMessage({ type: 'success', text: t('passkey.successRegister') })
        } catch (error: any) {
            console.error('Passkey registration error:', error)
            setMessage({ type: 'error', text: t('passkey.errorRegister') })
        } finally {
            setLoadingAction(null)
        }
    }

    const handleSupakeysRegister = async () => {
        if (!user) return
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
            }
        } catch (error: any) {
            console.error('Supakeys registration error:', error)
            setMessage({ type: 'error', text: error.message || t('passkey.errorSupakeysRegister') })
        } finally {
            setLoadingAction(null)
        }
    }

    if (!user) return null

    return (
        <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

                {/* Header Section */}
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                        {t('passkey.promoDesktop')}
                    </h2>
                    <p className="mt-2 text-gray-500 max-w-2xl mx-auto">
                        {t('passkey.promoSubtitle')}
                    </p>
                </div>

                {/* Status & Manager Banner */}
                {(hasPasskey || hasSupakey) && (
                    <div className="mb-8 p-4 bg-green-50 rounded-xl border border-green-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-xl">🛡️</span>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-green-900">
                                    {window.innerWidth < 768 ? t('passkey.congratsMobile') : t('passkey.congratsDesktop')}
                                </h3>
                                <p className="text-sm text-green-700">
                                    {hasSupakey && hasPasskey
                                        ? t('passkey.statusBoth')
                                        : hasSupakey
                                            ? t('passkey.statusSupakeys')
                                            : t('passkey.statusStandard')
                                    }
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowManager(true)}
                            className="bg-white text-green-700 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                        >
                            {t('passkey.manageButton')}
                        </button>
                    </div>
                )}

                {/* Registration Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Legacy / Standard Card */}
                    <div className={`relative p-6 rounded-2xl border transition-all ${hasPasskey ? 'bg-gray-50 border-gray-100 opacity-80' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                                🔑
                            </div>
                            {hasPasskey && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">{t('passkey.activeLabel')}</span>}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('passkey.standardTitle')}</h3>
                        <p className="text-gray-500 text-sm mb-4 min-h-[40px]">
                            {t('passkey.standardDesc')}
                        </p>
                        <button
                            onClick={handleRegister}
                            disabled={loadingAction !== null || hasPasskey}
                            data-testid="legacy-register-button"
                            className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${hasPasskey
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                }`}
                        >
                            {loadingAction === 'legacy' ? t('passkey.registerButtonLoading') : hasPasskey ? t('passkey.passkeyInUse') : t('passkey.registerButton')}
                        </button>
                    </div>

                    {/* Supakeys Card */}
                    <div className={`relative p-6 rounded-2xl border transition-all ${hasSupakey ? 'bg-gray-50 border-gray-100 opacity-80' : 'bg-white border-purple-100 hover:border-purple-300 hover:shadow-md'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">
                                ✨
                            </div>
                            {hasSupakey && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">{t('passkey.activeLabel')}</span>}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('passkey.supakeysTitle')}</h3>
                        <p className="text-gray-500 text-sm mb-4 min-h-[40px]">
                            {t('passkey.supakeysDesc')}
                        </p>
                        <button
                            onClick={handleSupakeysRegister}
                            disabled={loadingAction !== null || hasSupakey}
                            data-testid="supakeys-register-button"
                            className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${hasSupakey
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                                }`}
                        >
                            {loadingAction === 'supakeys' ? t('passkey.registerButtonLoading') : hasSupakey ? t('passkey.supakeysInUse') : t('passkey.supakeysButton')}
                        </button>
                    </div>
                </div>

                {/* Message Toast/Alert */}
                {message && (
                    <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
                        }`}>
                        <span>{message.type === 'success' ? '✅' : '⚠️'}</span>
                        <span className="font-medium text-sm">{message.text}</span>
                    </div>
                )}
            </div>

            {/* Passkey Manager Modal */}
            {showManager && <PasskeyManager onClose={() => setShowManager(false)} />}
        </div>
    )
}
