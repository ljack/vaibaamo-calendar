import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { passkeyService } from '../lib/passkeyService'

export default function Login() {
    const navigate = useNavigate()
    const { user, passkeySupported } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [usePassword, setUsePassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    useEffect(() => {
        if (user) {
            navigate('/')
        }
    }, [navigate, user])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (usePassword) {
                if (!password) {
                    throw new Error('Salasana puuttuu.')
                }
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                navigate('/')
            } else {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: true,
                        emailRedirectTo: window.location.origin
                    },
                })
                if (error) throw error
            }

            setMessage({
                type: 'success',
                text: usePassword
                    ? 'Kirjautuminen onnistui!'
                    : 'Kirjautumislinkki lähetetty sähköpostiisi!',
            })
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.message || 'Virhe kirjautumisessa.',
            })
        } finally {
            setLoading(false)
        }
    }

    const handlePasskeyLogin = async () => {
        setLoading(true)
        setMessage(null)
        try {
            await passkeyService.login()
            navigate('/')
        } catch (error: any) {
            console.error('Passkey login error:', error)
            setMessage({
                type: 'error',
                text: error.message || 'Virhe avainkoodilla kirjautumisessa.',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSignup = async () => {
        setLoading(true)
        setMessage(null)

        try {
            if (!password) {
                throw new Error('Salasana puuttuu.')
            }
            const { error } = await supabase.auth.signUp({
                email,
                password,
            })
            if (error) throw error

            setMessage({
                type: 'success',
                text: 'Tili luotu! Vahvista sähköpostisi ja kirjaudu sisään.',
            })
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.message || 'Virhe rekisteröitymisessä.',
            })
        } finally {
            setLoading(false)
        }
    }

    // TODO: Add implementation for native Passkey enrollment/signin if Supabase updated their JS SDK tailored specifically for it,
    // currently standard Magic Link is the most reliable "passwordless" start which can then upgrade to passkey.
    // For strict passkey support, we'd use signInWithWebAuthn() available in newer clients.

    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Kirjaudu Vaibaamoon
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Käytämme salasanatonta kirjautumista.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="-space-y-px rounded-md shadow-sm">
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Sähköpostiosoite
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="Sähköpostiosoite"
                            />
                        </div>
                        {usePassword && (
                            <div className="mt-3">
                                <label htmlFor="password" className="sr-only">
                                    Salasana
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    placeholder="Salasana"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={usePassword}
                                onChange={(e) => setUsePassword(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            />
                            Käytä salasanaa
                        </label>
                    </div>

                    {message && (
                        <div
                            className={`p-4 rounded-md text-sm ${message.type === 'success'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-md bg-indigo-600 py-2.5 px-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70"
                        >
                            {loading
                                ? 'Lähetetään...'
                                : usePassword
                                    ? 'Kirjaudu sisään'
                                    : 'Lähetä kirjautumislinkki'}
                        </button>
                    </div>

                    {passkeySupported && (
                        <div className="pt-2">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-2 text-gray-500">Tai käytä</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handlePasskeyLogin}
                                disabled={loading}
                                className="mt-4 group relative flex w-full justify-center rounded-md border border-gray-300 py-2.5 px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 gap-2 items-center"
                            >
                                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zM7 7a3 3 0 116 0v2H7V7zm3 11a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                Kirjaudu avainkoodilla
                            </button>
                        </div>
                    )}

                    {usePassword && (
                        <div>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleSignup}
                                className="group relative flex w-full justify-center rounded-md border border-indigo-600 py-2.5 px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-70"
                            >
                                Luo tili salasanalla
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}
