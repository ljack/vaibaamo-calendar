import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
        const initializeAuth = async () => {
            if (DEBUG_AUTH) console.log('[AuthContext] initializeAuth started')
            try {
                // Check for initial session with timeout
                // We race against a timeout because if the token refresh logic hangs (network), the app freezes
                const timeoutPromise = new Promise<{ data: { session: Session | null }, error: any }>((_, reject) =>
                    setTimeout(() => reject(new Error('Session check timed out')), 2000)
                )

                // Force return type compatibility for Promise.race
                const { data: { session: initialSession }, error: sessionError } = await Promise.race([
                    supabase.auth.getSession(),
                    timeoutPromise
                ])

                if (sessionError) throw sessionError

                if (initialSession) {
                    if (DEBUG_AUTH) console.log('[AuthContext] Initial session found', initialSession.user.id)
                    // Verify the session is actually valid by fetching user
                    const { data: { user }, error } = await supabase.auth.getUser()

                    if (error || !user) {
                        console.log('[AuthContext] Session found but invalid (likely old project), clearing...', error)
                        await supabase.auth.signOut()
                        localStorage.clear()
                        setSession(null)
                        setUser(null)
                        setIsAdmin(false)
                    } else {
                        if (DEBUG_AUTH) console.log('[AuthContext] Session checked and valid')
                        setSession(initialSession)
                        setUser(user)
                        await checkAdminStatus(user.id)
                    }
                } else {
                    if (DEBUG_AUTH) console.log('[AuthContext] No initial session')
                    setSession(null)
                    setUser(null)
                    setIsAdmin(false)
                }
            } catch (error) {
                console.error('[AuthContext] Auth initialization error:', error)
                // Fallback: clear everything to be safe
                if (DEBUG_AUTH) console.log('[AuthContext] Clearing suspected bad session data from storage')
                localStorage.clear()
                // Attempt to notify supabase client to clear state (fire and forget, don't await/hang)
                supabase.auth.signOut().catch(e => console.error('[AuthContext] Force signout error (ignoring):', e))

                setSession(null)
                setUser(null)
                setIsAdmin(false)
            } finally {
                if (DEBUG_AUTH) console.log('[AuthContext] initializeAuth finished, setting loading=false')
                setLoading(false)
            }
        }

        initializeAuth()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                await checkAdminStatus(session.user.id)
            } else {
                setIsAdmin(false)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        // Optimistic clear
        setSession(null)
        setUser(null)
        setIsAdmin(false)
        localStorage.clear()

        try {
            await supabase.auth.signOut()
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }

    const checkSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession()
            if (error || !session) {
                await signOut()
                return false
            }
            // Double check with getUser for security/validity
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
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
