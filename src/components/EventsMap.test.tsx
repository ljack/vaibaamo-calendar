import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Event } from '../types'
import { geocodeLocation } from '../lib/geocode'

vi.mock('../lib/geocode', () => ({
    geocodeLocation: vi.fn(async () => ({ lat: 60.17, lon: 24.94 })),
    createMapLink: (location: string) => `map://${location}`,
}))

const leafletMock = vi.hoisted(() => {
    const markerInstance = {
        bindPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
    }
    const layerGroupInstance = {
        addTo: vi.fn().mockReturnThis(),
        clearLayers: vi.fn(),
    }
    const mapInstance = {
        setView: vi.fn(),
        fitBounds: vi.fn(),
        remove: vi.fn(),
    }
    const extend = vi.fn()
    return {
        markerInstance,
        layerGroupInstance,
        mapInstance,
        extend,
        map: vi.fn(() => mapInstance),
        tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
        layerGroup: vi.fn(() => layerGroupInstance),
        marker: vi.fn(() => markerInstance),
        latLngBounds: vi.fn(() => ({ extend })),
        Icon: {
            Default: Object.assign(function Default() { }, {
                prototype: {},
                mergeOptions: vi.fn(),
            }),
        },
    }
})

vi.mock('../lib/leafletLoader', () => ({
    loadLeaflet: vi.fn(async () => ({
        map: leafletMock.map,
        tileLayer: leafletMock.tileLayer,
        layerGroup: leafletMock.layerGroup,
        marker: leafletMock.marker,
        latLngBounds: leafletMock.latLngBounds,
        Icon: leafletMock.Icon,
    })),
}))

describe('EventsMap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders list and map container for events', async () => {
        const EventsMap = (await import('./EventsMap')).default
        const events: Event[] = [
            {
                id: '1',
                title: 'Event One',
                description: 'Desc',
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                location: 'Helsinki',
                max_participants: null,
                created_at: new Date().toISOString(),
            },
        ]

        render(<EventsMap events={events} />)

        expect(screen.getByText('Tapahtumien kartta')).toBeInTheDocument()
        expect(screen.getByText('Event One')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('Avaa kartassa')).toBeInTheDocument()
        })
    })

    it('shows no-location message when locations are missing', async () => {
        const EventsMap = (await import('./EventsMap')).default
        const events: Event[] = [
            {
                id: '2',
                title: 'No Location',
                description: 'Desc',
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                location: null,
                max_participants: null,
                created_at: new Date().toISOString(),
            },
        ]

        render(<EventsMap events={events} />)

        expect(screen.getByText(/Tapahtumille ei ole lisätty sijaintia/i)).toBeInTheDocument()
        expect(screen.getByText(/Ei sijaintia/i)).toBeInTheDocument()
    })

    it('renders nothing when no events are provided', async () => {
        const EventsMap = (await import('./EventsMap')).default
        const { container } = render(<EventsMap events={[]} />)
        expect(container.firstChild).toBeNull()
    })

    it('fits bounds when geocoded events exist', async () => {
        const EventsMap = (await import('./EventsMap')).default
        vi.mocked(geocodeLocation).mockResolvedValue({ lat: 60.17, lon: 24.94 })
        const events: Event[] = [
            {
                id: '3',
                title: 'Bounded Event',
                description: 'Desc',
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                location: 'Tampere',
                max_participants: null,
                created_at: new Date().toISOString(),
            },
        ]

        render(<EventsMap events={events} />)

        await waitFor(() => {
            expect(leafletMock.marker).toHaveBeenCalled()
            expect(leafletMock.latLngBounds).toHaveBeenCalled()
            expect(leafletMock.mapInstance.fitBounds).toHaveBeenCalled()
        })
    })

    it('falls back to default view when geocode yields no results', async () => {
        const EventsMap = (await import('./EventsMap')).default
        vi.mocked(geocodeLocation).mockResolvedValueOnce(null)

        const events: Event[] = [
            {
                id: '4',
                title: 'No Coords',
                description: 'Desc',
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                location: 'Unknown',
                max_participants: null,
                created_at: new Date().toISOString(),
            },
        ]

        render(<EventsMap events={events} />)

        await waitFor(() => {
            expect(leafletMock.mapInstance.setView).toHaveBeenCalled()
        })
    })

    it('removes map instance on unmount', async () => {
        const EventsMap = (await import('./EventsMap')).default
        const events: Event[] = [
            {
                id: '5',
                title: 'Unmount Event',
                description: 'Desc',
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                location: 'Helsinki',
                max_participants: null,
                created_at: new Date().toISOString(),
            },
        ]

        const { unmount } = render(<EventsMap events={events} />)

        await waitFor(() => {
            expect(leafletMock.map).toHaveBeenCalled()
        })

        unmount()
        expect(leafletMock.mapInstance.remove).toHaveBeenCalled()
    })
})
