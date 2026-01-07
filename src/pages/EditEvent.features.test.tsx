
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
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}))

describe('EditEvent Features', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock Auth
        vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
            user: { id: 'user-1' } as any,
            isAdmin: true,
            loading: false,
            signOut: vi.fn(),
        } as any)

        // Mock window.confirm
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('allows deleting a media asset', async () => {
        // Mock Event Data
        const event = {
            id: 'event-123',
            title: 'Test Event',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            media_assets: [
                { url: 'https://example.com/storage/v1/object/public/event-media/events/event-123/image.png', section: 'plan', caption: 'Delete Me' }
            ]
        }

        // Mock Fetch Event
        const selectBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: event, error: null }),
            then: vi.fn().mockImplementation((resolve: any) => resolve({ data: event, error: null }))
        }
        vi.mocked(supabase.from).mockReturnValue(selectBuilder as any)

        // Mock Storage Remove
        const storageRemoveMock = vi.fn().mockResolvedValue({ error: null })
        vi.mocked(supabase.storage.from).mockReturnValue({
            remove: storageRemoveMock,
        } as any)

        render(
            <MemoryRouter initialEntries={['/events/event-123/edit']}>
                <Routes>
                    <Route path="/events/:id/edit" element={<EditEvent />} />
                </Routes>
            </MemoryRouter>
        )

        // Wait for load
        await waitFor(() => expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument())

        // Switch to Plan tab
        fireEvent.click(screen.getByText('events.edit.tabPlan'))

        // Find delete button
        const deleteBtn = screen.getByTitle('events.edit.deleteAsset')
        expect(deleteBtn).toBeInTheDocument()

        // Click delete
        fireEvent.click(deleteBtn)

        // Verify confirm was called
        expect(window.confirm).toHaveBeenCalledWith('events.edit.confirmDeleteAsset')

        // Verify storage delete call
        await waitFor(() => {
            expect(storageRemoveMock).toHaveBeenCalledWith(['events/event-123/image.png'])
        })

        // Verify asset removed from UI
        await waitFor(() => {
            expect(screen.queryByAltText('Delete Me')).not.toBeInTheDocument()
        })
    })
})
