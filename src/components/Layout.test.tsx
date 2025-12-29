import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Layout from './Layout'
import * as AuthContext from '../contexts/AuthContext'

vi.mock('./UpdateNotification', () => ({
    UpdateNotification: () => null,
}))

vi.mock('./PasskeyPrompt', () => ({
    PasskeyPrompt: () => null,
}))

describe('Layout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows login link when logged out', () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            isAdmin: false,
            signOut: vi.fn(),
        } as any)

        render(
            <MemoryRouter>
                <Layout />
            </MemoryRouter>
        )

        expect(screen.getByText('layout.login')).toBeInTheDocument()
    })

    it('shows admin actions when logged in as admin', () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin', email: 'admin@example.com' },
            isAdmin: true,
            signOut: vi.fn(),
        } as any)

        render(
            <MemoryRouter>
                <Layout />
            </MemoryRouter>
        )

        expect(screen.getByText('layout.createEvent')).toBeInTheDocument()
        expect(screen.getByText('layout.logout')).toBeInTheDocument()
    })

    it('calls signOut and redirects on logout', async () => {
        const signOut = vi.fn().mockResolvedValue({})
        const reloadSpy = vi.fn()
        Object.defineProperty(window, 'location', {
            value: { href: '/', reload: reloadSpy },
            writable: true,
        })

        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user', email: 'user@example.com' },
            isAdmin: false,
            signOut,
        } as any)

        render(
            <MemoryRouter>
                <Layout />
            </MemoryRouter>
        )

        screen.getByText('layout.logout').click()

        await Promise.resolve()
        expect(signOut).toHaveBeenCalled()
        expect(window.location.href).toBe('/')
    })

    it('still redirects when signOut throws', async () => {
        const signOut = vi.fn().mockRejectedValue(new Error('fail'))
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        Object.defineProperty(window, 'location', {
            value: { href: '/', reload: vi.fn() },
            writable: true,
        })

        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user', email: 'user@example.com' },
            isAdmin: false,
            signOut,
        } as any)

        render(
            <MemoryRouter>
                <Layout />
            </MemoryRouter>
        )

        fireEvent.click(screen.getByText('layout.logout'))

        await Promise.resolve()
        expect(signOut).toHaveBeenCalled()
        expect(errorSpy).toHaveBeenCalled()
        expect(window.location.href).toBe('/')
        errorSpy.mockRestore()
    })
})
