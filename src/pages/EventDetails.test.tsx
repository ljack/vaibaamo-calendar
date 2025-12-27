import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EventDetails from './EventDetails'
import { supabase } from '../lib/supabase'
import * as AuthContext from '../contexts/AuthContext'

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
}))

vi.mock('../components/EventsMap', () => ({
    default: () => <div data-testid="event-map" />,
}))

const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    }
})

describe('EventDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('allows admin to delete an event', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-1',
            title: 'Test Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: 'Helsinki',
            max_participants: null,
            created_at: new Date().toISOString(),
        }

        const deleteEqMock = vi.fn().mockResolvedValue({ error: null })
        const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))
        const eventsSelectMock = vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: event, error: null }),
            })),
        }))

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') {
                return {
                    select: eventsSelectMock,
                    delete: deleteMock,
                } as any
            }
            if (table === 'participants') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({ data: null, error: null }),
                            }),
                        }),
                    }),
                } as any
            }
            return {} as any
        })

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(
            <MemoryRouter initialEntries={['/events/event-1']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Test Event')).toBeInTheDocument())

        const deleteButton = screen.getByRole('button', { name: /Poista/i })
        fireEvent.click(deleteButton)

        await waitFor(() => {
            expect(confirmSpy).toHaveBeenCalled()
            expect(deleteMock).toHaveBeenCalled()
            expect(deleteEqMock).toHaveBeenCalledWith('id', 'event-1')
            expect(mockedNavigate).toHaveBeenCalledWith('/')
        })
    })

    it('shows not found when event fetch fails', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: null,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: null, error: new Error('not found') }),
                        }),
                    }),
                } as any
            }
            return {} as any
        })

        render(
            <MemoryRouter initialEntries={['/events/missing']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText(/Tapahtumaa ei löytynyt/i)).toBeInTheDocument())
    })

    it('allows user to register and cancel participation', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' } as any,
            isAdmin: false,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-2',
            title: 'Join Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: null,
            max_participants: null,
            created_at: new Date().toISOString(),
        }

        const insertMock = vi.fn().mockResolvedValue({ error: null })
        const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
        const participantSelect = vi
            .fn()
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: { id: 'p1' }, error: null })

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: event, error: null }),
                        }),
                    }),
                } as any
            }
            if (table === 'participants') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                single: participantSelect,
                            }),
                        }),
                    }),
                    insert: insertMock,
                    delete: deleteMock,
                } as any
            }
            return {} as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-2']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Join Event')).toBeInTheDocument())

        fireEvent.click(screen.getByText(/Ilmoittaudu mukaan/i))
        await waitFor(() => expect(insertMock).toHaveBeenCalled())

        await waitFor(() => expect(screen.getByText(/Peru ilmoittautuminen/i)).toBeInTheDocument())
        fireEvent.click(screen.getByText(/Peru ilmoittautuminen/i))
        await waitFor(() => expect(deleteMock).toHaveBeenCalled())
    })

    it('surfaces delete errors', async () => {
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'admin' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn(),
        } as any)

        const event = {
            id: 'event-3',
            title: 'Delete Error Event',
            description: 'Desc',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            location: null,
            max_participants: null,
            created_at: new Date().toISOString(),
        }

        const deleteEqMock = vi.fn().mockResolvedValue({ error: new Error('fail') })
        const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'events') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: event, error: null }),
                        }),
                    }),
                    delete: deleteMock,
                } as any
            }
            if (table === 'participants') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({ data: null, error: null }),
                            }),
                        }),
                    }),
                } as any
            }
            return {} as any
        })

        vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(
            <MemoryRouter initialEntries={['/events/event-3']}>
                <Routes>
                    <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByText('Delete Error Event')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Poista'))

        await waitFor(() => expect(screen.getByText('fail')).toBeInTheDocument())
    })
})
