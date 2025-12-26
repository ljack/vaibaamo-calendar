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
    signOut: () => Promise<void>
    checkSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAdmin: false,
    loading: true,
    signOut: async () => { },
    checkSession: async () => false,
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
                if (mounted) setLoading(false)
            }
        }

        // Start initialization
        bootstrap()

        // Set up listener
        const unsubscribe = listenToAuthEvents(async (event) => {
            if (!mounted) return
            if (DEBUG_AUTH) console.log('[AuthContext] Auth event:', event)

            const supabase = getSupabase()
            // We re-fetch session to be safe and consistent
            const { data: { session }, error } = await supabase.auth.getSession()
            if (DEBUG_AUTH && error) {
                console.error('[AuthContext] getSession error after auth event', error)
            }

            setSession(session)
            setUser(session?.user ?? null)

            if (session?.user) {
                await checkAdminStatus(session.user.id)
            } else {
                setIsAdmin(false)
            }

            // Should be loaded by now if an event fires
            setLoading(false)
        })

        return () => {
            mounted = false
            if (retryTimer) window.clearTimeout(retryTimer)
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
        signOut,
        checkSession,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
