import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextType = {
    session: Session | null
    user: User | null
    isAdmin: boolean
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAdmin: false,
    loading: true,
    signOut: async () => { },
})

export const useAuth = () => {
    return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initializeAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                await checkAdminStatus(session.user.id)
            } else {
                setIsAdmin(false)
            }
            setLoading(false)
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

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    const value = {
        session,
        user,
        isAdmin,
        loading,
        signOut,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
