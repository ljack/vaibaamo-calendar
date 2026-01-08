import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EditEvent from './EditEvent'
import { supabase } from '../lib/supabase'
import * as AuthContext from '../contexts/AuthContext'

// Mocks
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
        storage: {
            from: vi.fn(),
        },
        functions: {
            invoke: vi.fn(),
        }
    },
}))

vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
        useParams: () => ({ id: 'event-123' }),
    }
})

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'fi',
            changeLanguage: vi.fn(),
        },
    }),
}))

describe('EditEvent Vote Preservation', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock Auth
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn(),
        } as any)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('preserves existing options when they are unchanged', async () => {
        // Use a fixed UTC time to avoid local timezone issues in tests
        const startTime = '2025-10-10T10:00:00.000Z'
        const endTime = '2025-10-10T12:00:00.000Z'
        
        const event = {
            id: 'event-123',
            title: 'Test Event',
            start_time: startTime,
            end_time: endTime,
            scheduling_status: 'voting',
            time_type: 'timestamp'
        }

        const existingOption = {
            id: 'opt-1',
            event_id: 'event-123',
            start_time: startTime,
            end_time: endTime,
            time_type: 'timestamp'
        }

        // Mock different table queries
        const fromMock = vi.mocked(supabase.from)
        
        const eventsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: event, error: null }),
            update: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve: (val: unknown) => void) => resolve({ data: event, error: null }))
        }

        const optionsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve: (val: unknown) => void) => resolve({ data: [existingOption], error: null }))
        }

        const ownersBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve: (val: unknown) => void) => resolve({ data: [], error: null }))
        }

        fromMock.mockImplementation((table: string) => {
            if (table === 'events') return eventsBuilder as any
            if (table === 'event_options') return optionsBuilder as any
            if (table === 'event_owners') return ownersBuilder as any
            return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: vi.fn() } as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-123/edit']}>
                <Routes>
                    <Route path="/events/:id/edit" element={<EditEvent />} />
                </Routes>
            </MemoryRouter>
        )

        // Wait for load
        await waitFor(() => expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument())

        // Click Save
        const submitBtn = screen.getByText('events.edit.save')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            // Verify event update was called
            expect(eventsBuilder.update).toHaveBeenCalled()
            
            // Verify options were fetched twice: once on load, once on submit
            expect(optionsBuilder.select).toHaveBeenCalled()
            
            // Verify that delete was NOT called for unchanged existing option
            expect(optionsBuilder.delete).not.toHaveBeenCalled()
            
            // Verify that insert was NOT called for unchanged existing option
            expect(optionsBuilder.insert).not.toHaveBeenCalled()
            
            expect(mockedNavigate).toHaveBeenCalledWith('/events/event-123')
        })
    })

    it('deletes old options and inserts new ones when they change', async () => {
        const startTimeOld = '2025-10-10T10:00:00.000Z'
        
        const event = {
            id: 'event-123',
            title: 'Test Event',
            start_time: startTimeOld,
            end_time: startTimeOld,
            scheduling_status: 'voting',
            time_type: 'timestamp'
        }

        const existingOption = {
            id: 'opt-old',
            event_id: 'event-123',
            start_time: '2025-10-10T10:00',
            end_time: '2025-10-10T10:00',
            time_type: 'timestamp'
        }

        const fromMock = vi.mocked(supabase.from)
        
        const eventsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: event, error: null }),
            update: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve: (val: unknown) => void) => resolve({ data: event, error: null }))
        }

        const optionsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            then: (resolve: (val: unknown) => void) => resolve({ data: [existingOption], error: null })
        }

        fromMock.mockImplementation((table: string) => {
            if (table === 'events') return eventsBuilder as any
            if (table === 'event_options') return optionsBuilder as any
            return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (r: any) => r({ data: [] }) } as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-123/edit']}>
                <Routes>
                    <Route path="/events/:id/edit" element={<EditEvent />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument())

        // Change all inputs with the initial date value to the new date
        const dateInputs = screen.getAllByDisplayValue('2025-10-10T10:00')
        dateInputs.forEach(input => {
            fireEvent.change(input, { target: { value: '2025-10-11T10:00' } })
        })
        
        // Sanity check that at least one changed
        expect(screen.queryByDisplayValue('2025-10-10T10:00')).not.toBeInTheDocument()

        const submitBtn = screen.getByText('events.edit.save')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            // Verify event update was called first
            expect(eventsBuilder.update).toHaveBeenCalled()
            
            // Verify that delete WAS called for old option
            expect(optionsBuilder.delete).toHaveBeenCalled()
            expect(optionsBuilder.in).toHaveBeenCalledWith('id', ['opt-old'])
            
            // Verify that insert WAS called for new option
            // We use .toISOString() to match the production logic which converts to ISO
            const expectedStartTime = new Date('2025-10-11T10:00').toISOString()
            expect(optionsBuilder.insert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    start_time: expectedStartTime
                })
            ]))
        })
    })

    it('preserves existing options when string formats differ (e.g. +00:00 vs Z)', async () => {
        // Supabase format
        const supabaseStart = '2025-10-10T10:00:00+00:00'
        const supabaseEnd = '2025-10-10T12:00:00+00:00'
        
        const event = {
            id: 'event-123',
            title: 'Format Test',
            start_time: supabaseStart,
            end_time: supabaseEnd,
            scheduling_status: 'voting',
            time_type: 'timestamp'
        }

        const existingOption = {
            id: 'opt-1',
            event_id: 'event-123',
            start_time: supabaseStart, // Different format than JS .toISOString()
            end_time: supabaseEnd,
            time_type: 'timestamp'
        }

        const fromMock = vi.mocked(supabase.from)
        
        const eventsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: event, error: null }),
            update: vi.fn().mockReturnThis(),
            then: (resolve: (val: unknown) => void) => resolve({ data: event, error: null })
        }

        const optionsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            then: (resolve: (val: unknown) => void) => resolve({ data: [existingOption], error: null })
        }

        fromMock.mockImplementation((table: string) => {
            if (table === 'events') return eventsBuilder as any
            if (table === 'event_options') return optionsBuilder as any
            return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (r: any) => r({ data: [] }) } as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-123/edit']}>
                <Routes>
                    <Route path="/events/:id/edit" element={<EditEvent />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByDisplayValue('Format Test')).toBeInTheDocument())

        const submitBtn = screen.getByText('events.edit.save')
        fireEvent.click(submitBtn)

        await waitFor(() => {
            // If it fails, delete will have been called because
            // '2025-10-10T10:00:00+00:00' !== '2025-10-10T10:00:00.000Z'
            expect(optionsBuilder.delete).not.toHaveBeenCalled()
            expect(optionsBuilder.insert).not.toHaveBeenCalled()
            expect(mockedNavigate).toHaveBeenCalledWith('/events/event-123')
        })
    })

    it('preserves and normalizes dates when switching time types', async () => {
        const event = {
            id: 'event-123',
            title: 'Time Type Switch Test',
            start_time: '2025-10-10T10:00:00.000Z',
            end_time: '2025-10-10T12:00:00.000Z',
            scheduling_status: 'voting',
            time_type: 'timestamp'
        }

        const fromMock = vi.mocked(supabase.from)
        
        const eventsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: event, error: null }),
        }

        const optionsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (resolve: (val: unknown) => void) => resolve({ 
                data: [{
                    id: 'opt-1',
                    start_time: '2025-10-10T10:00:00+00:00',
                    end_time: '2025-10-10T12:00:00+00:00',
                    time_type: 'timestamp'
                }], 
                error: null 
            })
        }

        fromMock.mockImplementation((table: string) => {
            if (table === 'events') return eventsBuilder as any
            if (table === 'event_options') return optionsBuilder as any
            return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (r: any) => r({ data: [] }) } as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-123/edit']}>
                <Routes>
                    <Route path="/events/:id/edit" element={<EditEvent />} />
                </Routes>
            </MemoryRouter>
        )

        await waitFor(() => expect(screen.getByDisplayValue('Time Type Switch Test')).toBeInTheDocument())

        // Initial state should start with '2025-10-10T' (timestamp: start and end)
        expect(screen.getAllByDisplayValue(/^2025-10-10T/).length).toBe(2)

        // Switch to 'all_day'
        const timeTypeSelect = screen.getByDisplayValue('events.edit.timeTimestamp')
        fireEvent.change(timeTypeSelect, { target: { value: 'all_day' } })

        // Value should be normalized to '2025-10-10' (all_day: only start)
        await waitFor(() => {
            expect(screen.getAllByDisplayValue('2025-10-10').length).toBe(1)
            expect(screen.queryByDisplayValue(/^2025-10-10T/)).not.toBeInTheDocument()
        })

        // Switch back to 'timestamp'
        fireEvent.change(timeTypeSelect, { target: { value: 'timestamp' } })

        // Value should be normalized back to '2025-10-10T12:00' (timestamp: start and end set to noon)
        await waitFor(() => {
            expect(screen.getAllByDisplayValue('2025-10-10T12:00').length).toBe(2)
            expect(screen.queryByDisplayValue('2025-10-10')).not.toBeInTheDocument()
        })
    })

    it('correctly formats and displays all_day event dates on initial load', async () => {
        const event = {
            id: 'event-all-day',
            title: 'All Day Load Test',
            start_time: '2025-10-10T00:00:00.000Z',
            end_time: '2025-10-10T23:59:59.000Z',
            scheduling_status: null,
            time_type: 'all_day'
        }

        const fromMock = vi.mocked(supabase.from)
        
        const eventsBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: event, error: null }),
        }

        fromMock.mockImplementation((table: string) => {
            if (table === 'events') return eventsBuilder as any
            return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), then: (r: any) => r({ data: [] }) } as any
        })

        render(
            <MemoryRouter initialEntries={['/events/event-all-day/edit']}>
                <Routes>
                    <Route path="/events/:id/edit" element={<EditEvent />} />
                </Routes>
            </MemoryRouter>
        )

        // Wait for load and verify date specifically formatted as YYYY-MM-DD
        await waitFor(() => {
            expect(screen.getByDisplayValue('All Day Load Test')).toBeInTheDocument()
            // Should find the date part only
            expect(screen.getByDisplayValue('2025-10-10')).toBeInTheDocument()
            // Should NOT find the timestamp format which breaks <input type="date">
            expect(screen.queryByDisplayValue('2025-10-10T00:00')).not.toBeInTheDocument()
        })
    })
})
