import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Profile from './Profile'
import { supabase } from '../lib/supabase'
import * as AuthContext from '../contexts/AuthContext'

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
        })),
    },
}))

describe('Profile', () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: mockUser,
        } as any)
    })

    const setupMocks = (profileData: any = null) => {
        const queryBuilder: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(() => Promise.resolve({ data: profileData, error: null })),
            maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
            update: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((onFulfilled) => {
                return Promise.resolve({ data: null, error: null }).then(onFulfilled)
            }),
        }
        vi.mocked(supabase.from).mockReturnValue(queryBuilder as any)
        return queryBuilder
    }

    it('loads and displays user profile', async () => {
        setupMocks({
            id: 'user-1',
            display_name: 'johndoe',
            first_name: 'John',
            last_name: 'Doe'
        })

        render(<Profile />)

        await waitFor(() => expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument())
        expect(screen.getByDisplayValue('John')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    })

    it('updates profile successfully', async () => {
        const queryBuilder = setupMocks({
            id: 'user-1',
            display_name: 'johndoe',
            first_name: 'John',
            last_name: 'Doe'
        })

        render(<Profile />)

        await waitFor(() => expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument())

        fireEvent.change(screen.getByDisplayValue('johndoe'), { target: { value: 'newhandle' } })
        fireEvent.click(screen.getByText('profile.save'))

        await waitFor(() => {
            expect(queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
                display_name: 'newhandle',
            }))
            expect(screen.getByText('profile.success')).toBeInTheDocument()
        })
    })

    it('shows error if display name is already taken', async () => {
        const queryBuilder = setupMocks({
            id: 'user-1',
            display_name: 'oldhandle',
        })

        // Mock conflicting handle check
        queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: 'other-user' }, error: null })

        render(<Profile />)

        await waitFor(() => expect(screen.getByDisplayValue('oldhandle')).toBeInTheDocument())

        fireEvent.change(screen.getByDisplayValue('oldhandle'), { target: { value: 'takenhandle' } })
        fireEvent.click(screen.getByText('profile.save'))

        await waitFor(() => {
            expect(screen.getByText('profile.handleReserved')).toBeInTheDocument()
            expect(queryBuilder.update).not.toHaveBeenCalled()
        })
    })
})
