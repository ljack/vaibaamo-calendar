/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import { initAuthOnce } from '../lib/authBootstrap'
import { listenToAuthEvents } from '../lib/authEvents'

type AuthContextType = {
    session: Session | null
    user: User | null
    isAdmin: boolean
    loading: boolean
    passkeySupported: boolean
    hasPasskey: boolean
    signOut: () => Promise<void>
    checkSession: () => Promise<boolean>
    refreshPasskeyStatus: (userId?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAdmin: false,
    loading: true,
    passkeySupported: false,
    hasPasskey: false,
    signOut: async () => { },
    checkSession: async () => false,
    refreshPasskeyStatus: async (_userId?: string) => { },
})

export const useAuth = () => {
    return useContext(AuthContext)
}

const DEBUG_AUTH = import.meta.env.VITE_SUPABASE_DEBUG_AUTH === 'true'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [passkeySupported, setPasskeySupported] = useState(false)
    const [hasPasskey, setHasPasskey] = useState(false)

    const refreshPasskeyStatus = async (userIdOverride?: string) => {
        const effectiveUserId = userIdOverride || user?.id
        if (!effectiveUserId) return

        try {
            const supabase = getSupabase()
            const hostname = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
            const { count, error } = await supabase
                .from('passkeys')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', effectiveUserId)
                .eq('rp_id', hostname)

            if (!error) {
                setHasPasskey((count ?? 0) > 0)
            } else {
                console.error('[AuthContext] Error fetching passkey count:', error)
                setHasPasskey(false)
            }
        } catch (err) {
            console.error('[AuthContext] Error refreshing passkey status:', err)
            setHasPasskey(false)
        }
    }

    const checkAdminStatus = async (userId: string) => {
        try {
            const supabase = getSupabase()
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single()

            setIsAdmin(data?.role === 'admin')
        } catch (error) {
            console.error('Error checking admin status', error)
            setIsAdmin(false)
        }
    }

    useEffect(() => {
        let mounted = true
        let retryTimer: number | null = null

        const scheduleRetry = (reason: string) => {
            if (retryTimer) window.clearTimeout(retryTimer)
            if (DEBUG_AUTH) console.log('[AuthContext] Scheduling auth retry', reason)
            const supabase = getSupabase()
            retryTimer = window.setTimeout(async () => {
                if (!mounted) return
                try {
                    const { data, error } = await supabase.auth.getSession()
                    if (DEBUG_AUTH && error) {
                        console.error('[AuthContext] getSession error after retry', error)
                    }
                    const retrySession = data.session
                    if (!retrySession?.user) return
                    setSession(retrySession)
                    setUser(retrySession.user)
                    await checkAdminStatus(retrySession.user.id)
                } catch (retryError) {
                    if (DEBUG_AUTH) console.error('[AuthContext] Retry failed', retryError)
                }
            }, 2000)
        }

        const bootstrap = async () => {
            if (DEBUG_AUTH) console.log('[AuthContext] initAuthOnce started')

            try {
                const { session, user, error, timedOut } = await initAuthOnce()

                if (!mounted) return

                if (DEBUG_AUTH) console.log('[AuthContext] initAuthOnce completed', { hasSession: !!session, error })

                if (session && user) {
                    setSession(session)
                    setUser(user)
                    await checkAdminStatus(user.id)
                    await refreshPasskeyStatus(user.id)
                } else {
                    if (DEBUG_AUTH) console.log('[AuthContext] No valid session from bootstrap')
                    setSession(null)
                    setUser(null)
                    setIsAdmin(false)
                }

                if (timedOut) {
                    scheduleRetry('init_timed_out')
                }
            } catch (err: any) {
                console.error('[AuthContext] Bootstrap error:', err)
                if (DEBUG_AUTH) {
                    console.error('[AuthContext] Bootstrap error details', {
                        message: err?.message,
                        name: err?.name,
                        stack: err?.stack,
                    })
                }
                setSession(null)
                setUser(null)
            } finally {
                if (mounted) {
                    if (DEBUG_AUTH) console.log('[AuthContext] Bootstrap finally, loading set to false');
                    setLoading(false);
                }
            }
        }

        // Start initialization
        bootstrap()

        // Set up listener
        const unsubscribe = listenToAuthEvents(async (event, nextSession) => {
            if (!mounted) return
            if (DEBUG_AUTH) console.log('[AuthContext] Auth event:', event)

            setSession(nextSession)
            setUser(nextSession?.user ?? null)

            if (nextSession?.user) {
                await checkAdminStatus(nextSession.user.id)
                await refreshPasskeyStatus(nextSession.user.id)
            } else {
                setIsAdmin(false)
                setHasPasskey(false)
            }

            // Should be loaded by now if an event fires
            setLoading(false)
        })

        const refreshOnFocus = async (reason: string) => {
            if (!mounted) return
            try {
                const supabase = getSupabase()
                const { data: { session }, error } = await supabase.auth.getSession()
                if (DEBUG_AUTH && error) {
                    console.error(`[AuthContext] getSession error on ${reason}`, error)
                }
                setSession(session)
                setUser(session?.user ?? null)
                if (session?.user) {
                    await checkAdminStatus(session.user.id)
                    await refreshPasskeyStatus(session.user.id)
                } else {
                    setIsAdmin(false)
                    setHasPasskey(false)
                }
            } catch (err) {
                if (DEBUG_AUTH) console.error(`[AuthContext] getSession threw on ${reason}`, err)
            }
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                refreshOnFocus('visibilitychange')
            }
        }

        const handleFocus = () => {
            refreshOnFocus('focus')
        }

        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibility)

        // Check for WebAuthn support
        if (window.PublicKeyCredential) {
            // Check if platform authenticator is available (biometrics etc)
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(supported => {
                setPasskeySupported(supported)
            })
        }

        return () => {
            mounted = false
            if (retryTimer) window.clearTimeout(retryTimer)
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibility)
            unsubscribe()
        }
    }, [])

    const signOut = async () => {
        // Optimistic clear
        setSession(null)
        setUser(null)
        setIsAdmin(false)

        try {
            const supabase = getSupabase()
            await supabase.auth.signOut()
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }

    const checkSession = async () => {
        try {
            const supabase = getSupabase()
            const { data: { session }, error } = await supabase.auth.getSession()
            if (error || !session) {
                await signOut()
                return false
            }
            return true
        } catch (e) {
            await signOut()
            return false
        }
    }

    const value = {
        session,
        user,
        isAdmin,
        loading,
        passkeySupported,
        hasPasskey,
        signOut,
        checkSession,
        refreshPasskeyStatus
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
