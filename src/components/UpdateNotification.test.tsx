import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UpdateNotification } from '../components/UpdateNotification'

describe('UpdateNotification', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })

        // Setup global fetch mock
        const fetchMock = vi.fn().mockReturnValue(Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ version: '1000' }),
        } as Response))

        global.fetch = fetchMock
        vi.stubGlobal('fetch', fetchMock) // Ensure global is stubbed too
        Object.defineProperty(window, 'fetch', {
            writable: true,
            value: fetchMock,
        })
        // Setup window.location mock
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                reload: vi.fn(),
                reloadSource: 'test',
                origin: 'http://localhost' // Keep simple
            },
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    class ErrorBoundary extends React.Component<any, any> {
        constructor(props: any) {
            super(props)
            this.state = { hasError: false }
        }
        static getDerivedStateFromError(error: any) {
            return { hasError: true }
        }
        componentDidCatch(error: any, errorInfo: any) {
            console.error('CAUGHT ERROR IN TEST:', error)
        }
        render() {
            if (this.state.hasError) return <h1>Something went wrong.</h1>
            return this.props.children
        }
    }

    it('should not render anything initially', async () => {
        vi.mocked(global.fetch).mockImplementation((url) => {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ version: '1000' })
            } as Response)
        })

        render(<UpdateNotification />)

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        expect(screen.queryByText('Uusi versio saatavilla!')).not.toBeInTheDocument()
    })

    it('should show notification when version changes', async () => {
        const fetchMock = vi.mocked(global.fetch)
        fetchMock.mockReturnValue(Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ version: '1000' }),
        } as Response))

        render(
            <ErrorBoundary>
                <UpdateNotification />
            </ErrorBoundary>
        )
        // Wait for at least one call
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())

        await act(async () => {
            // Advance time for check
            await vi.runOnlyPendingTimersAsync()
        })

        // Mock next response for poll
        fetchMock.mockReturnValue(Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ version: '2000' }),
        } as Response))

        await act(async () => {
            await vi.runOnlyPendingTimersAsync()
        })

        await waitFor(() => expect(screen.getByText('Uusi versio saatavilla!')).toBeInTheDocument())
    })

    it('should reload page when update button is clicked', async () => {
        const fetchMock = vi.mocked(global.fetch)

        // Initial fetch
        fetchMock.mockReturnValue(Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ version: '1000' }),
        } as Response))

        render(
            <ErrorBoundary>
                <UpdateNotification />
            </ErrorBoundary>
        )

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())

        // Prepare update response
        fetchMock.mockReturnValue(Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ version: '2000' }),
        } as Response))

        // Trigger polling
        await act(async () => {
            await vi.runOnlyPendingTimersAsync()
        })

        await waitFor(() => expect(screen.getByText('Uusi versio saatavilla!')).toBeInTheDocument())

        // Mock reload
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { reload: vi.fn() }
        })

        const updateBtn = screen.getByText('Päivitä nyt')
        fireEvent.click(updateBtn)

        expect(window.location.reload).toHaveBeenCalled()
        expect(window.location.reload).toHaveBeenCalled()
    })
})
