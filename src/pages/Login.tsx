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

    const handleGoogleLogin = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            })
            if (error) throw error
        } catch (error: any) {
            console.error('Google login error:', error)
            setMessage({
                type: 'error',
                text: error.message || 'Virhe Google-kirjautumisessa.',
            })
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

                    <div className="pt-2">
                        {!passkeySupported && (
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-2 text-gray-500">Tai käytä</span>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="mt-4 group relative flex w-full justify-center rounded-md border border-gray-300 py-2.5 px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 gap-2 items-center"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Kirjaudu Googlella
                        </button>
                    </div>

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
