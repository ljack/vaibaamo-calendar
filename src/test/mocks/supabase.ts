import { vi } from 'vitest'

export const supabase = {
    auth: {
        getSession: vi.fn(),
        getUser: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithOtp: vi.fn(),
        signOut: vi.fn(),
    },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(),
            })),
            order: vi.fn(),
        })),
        insert: vi.fn(),
        delete: vi.fn(),
    })),
}

export const getSupabase = () => supabase
