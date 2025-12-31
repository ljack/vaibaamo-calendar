
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import EditEvent from './EditEvent'
import { AuthProvider } from '../contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { initReactI18next } from 'react-i18next'
import i18n from 'i18next'

// Mock i18n
i18n
    .use(initReactI18next)
    .init({
        lng: 'fi',
        fallbackLng: 'fi',
        ns: ['translation'],
        defaultNS: 'translation',
        resources: {
            fi: {
                translation: {
                    events: {
                        edit: {
                            uploadError: 'Lataus epäonnistui! Varmista että "event-media" bucket on olemassa.',
                            fetchError: 'Virhe tapahtuman haussa',
                            errorSave: 'Virhe tallennuksessa',
                            save: 'Tallenna muutokset'
                        }
                    },
                    common: {
                        error: 'Virhe',
                        save: 'Tallenna'
                    }
                }
            }
        }
    })

const { mockSupabase } = vi.hoisted(() => {
    const mock = {
        auth: {
            getSession: vi.fn(),
            getUser: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        from: vi.fn(),
    }
    return { mockSupabase: mock }
})

vi.mock('../lib/supabase', () => ({
    supabase: mockSupabase,
    getSupabase: () => mockSupabase,
}))

import { supabase } from '../lib/supabase'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: '123' }),
    }
})

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
}

const createBaseQueryBuilder = () => {
    const builder: any = {
        _data: null,
        _error: null,
        _count: 0,
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        abortSignal: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: any) =>
            resolve({ data: builder._data, error: builder._error, count: builder._count })
        ),
    }
    return builder
}

describe('EditEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default Auth Mocks
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: mockUser } as any },
            error: null,
        })
        vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        } as any)
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: mockUser } as any,
            error: null
        })

        // Default DB Mocks
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder._data = {
                    id: '123',
                    title: 'Old Title',
                    description: 'Old Desc',
                    start_time: '2025-12-01T12:00:00Z',
                    end_time: '2025-12-01T14:00:00Z',
                    location: 'Oulu',
                    max_participants: 10,
                    creator_id: 'user-123'
                }
            } else if (table === 'profiles') {
                queryBuilder._data = { role: 'user' }
            }
            return queryBuilder as any
        })
    })

    it('renders edit form with fetched data', async () => {
        render(
            <AuthProvider>
                <BrowserRouter>
                    <EditEvent />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument()
            expect(screen.getByDisplayValue('Old Desc')).toBeInTheDocument()
        })
    })

    it('updates event on submit', async () => {
        let capturedUpdateBuilder: any = null
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                capturedUpdateBuilder = queryBuilder
                queryBuilder._data = {
                    id: '123',
                    title: 'Old Title',
                    description: 'Old Desc',
                    start_time: '2025-12-01T12:00:00Z',
                    end_time: '2025-12-01T14:00:00Z',
                    creator_id: 'user-123'
                }
            } else if (table === 'profiles') {
                queryBuilder._data = { role: 'user' }
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EditEvent />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument())

        const titleInput = screen.getByDisplayValue('Old Title')
        fireEvent.change(titleInput, { target: { value: 'New Title' } })

        const submitBtn = screen.getByText('Tallenna muutokset')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(capturedUpdateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
                title: 'New Title'
            }))
            expect(mockNavigate).toHaveBeenCalledWith('/events/123')
        })
    })

    it('shows alert and redirects when fetch fails', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

        vi.mocked(supabase.from).mockImplementation((table) => {
            const queryBuilder = createBaseQueryBuilder()

            if (table === 'events') {
                queryBuilder._error = { message: 'nope' }
            } else if (table === 'profiles') {
                queryBuilder._data = { role: 'user' }
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EditEvent />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Virhe tapahtuman haussa')
            expect(mockNavigate).toHaveBeenCalledWith('/')
        })

        alertSpy.mockRestore()
    })

    it('shows alert when update fails', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            const queryBuilder = createBaseQueryBuilder()
            if (table === 'events') {
                queryBuilder._data = {
                    id: '123',
                    title: 'Old Title',
                    description: 'Old Desc',
                    start_time: '2025-12-01T12:00:00Z',
                    end_time: '2025-12-01T14:00:00Z',
                    creator_id: 'user-123'
                }

                queryBuilder.update.mockImplementation(() => {
                    queryBuilder._error = { message: 'fail' }
                    queryBuilder._data = null
                    return queryBuilder
                })
            } else if (table === 'profiles') {
                queryBuilder._data = { role: 'user' }
            }
            return queryBuilder as any
        })

        render(
            <AuthProvider>
                <BrowserRouter>
                    <EditEvent />
                </BrowserRouter>
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument())

        const submitBtn = screen.getByText('Tallenna muutokset')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('fail'))
        })

        alertSpy.mockRestore()
    })
})
