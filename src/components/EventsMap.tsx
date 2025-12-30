import { useEffect, useMemo, useRef, useState } from 'react'
import type { Event } from '../types'
import { geocodeLocation, createMapLink } from '../lib/geocode'
import { loadLeaflet } from '../lib/leafletLoader'
import type { Map, LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type GeocodedEvent = {
    event: Event
    lat: number
    lon: number
}

type EventsMapProps = {
    events: Event[]
    title?: string
    showList?: boolean
    className?: string
}

export default function EventsMap({
    events,
    title = 'Tapahtumien kartta',
    showList = true,
    className = '',
}: EventsMapProps) {
    const mapRef = useRef<HTMLDivElement | null>(null)
    const mapInstanceRef = useRef<Map | null>(null)
    const markersRef = useRef<LayerGroup | null>(null)
    const [geocodedEvents, setGeocodedEvents] = useState<GeocodedEvent[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const eventsWithLocation = useMemo(
        () => events.filter((event) => event.location?.trim()),
        [events]
    )

    useEffect(() => {
        const controller = new AbortController()
        let active = true

        const geocodeEvents = async () => {
            if (!eventsWithLocation.length) {
                setGeocodedEvents([])
                return
            }

            setIsLoading(true)
            const results: GeocodedEvent[] = []
            for (const event of eventsWithLocation) {
                if (!active) break
                const location = event.location?.trim()
                if (!location) continue
                const coords = await geocodeLocation(location, controller.signal)
                if (coords) {
                    results.push({ event, lat: coords.lat, lon: coords.lon })
                }
            }

            if (!active) return
            setGeocodedEvents(results)
            setIsLoading(false)
        }

        geocodeEvents()

        return () => {
            active = false
            controller.abort()
        }
    }, [eventsWithLocation])

    useEffect(() => {
        let canceled = false

        const setupMap = async () => {
            if (!mapRef.current) return
            const L = await loadLeaflet()
            if (canceled || !mapRef.current) return

            const map = mapInstanceRef.current || L.map(mapRef.current, {
                zoomControl: true,
                attributionControl: false,
            })
            if (!mapInstanceRef.current) {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                }).addTo(map)
                mapInstanceRef.current = map
                markersRef.current = L.layerGroup().addTo(map)
            }

            if (markersRef.current) {
                markersRef.current.clearLayers()
            }

            if (!geocodedEvents.length) {
                map.setView([60.1699, 24.9384], 5)
                return
            }

            const bounds = L.latLngBounds([])
            geocodedEvents.forEach(({ event, lat, lon }) => {
                const marker = L.marker([lat, lon])
                const popup = `<a href="/events/${event.id}" class="text-indigo-600 hover:underline">${event.title}</a>`
                marker.bindPopup(popup)
                if (markersRef.current) {
                    marker.addTo(markersRef.current)
                }
                bounds.extend([lat, lon])
            })
            map.fitBounds(bounds, { padding: [40, 40] })
        }

        setupMap()

        return () => {
            canceled = true
        }
    }, [geocodedEvents])

    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
        }
    }, [])

    if (!events.length) return null

    return (
        <section className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {isLoading && (
                    <span className="text-sm text-gray-500">Haetaan sijainteja...</span>
                )}
            </div>
            <div className="w-full h-64 rounded-md overflow-hidden border border-gray-200" ref={mapRef} />
            {!eventsWithLocation.length && (
                <p className="mt-3 text-sm text-gray-500">
                    Tapahtumille ei ole lisätty sijaintia.
                </p>
            )}
            {showList && (
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                    {events.map((event) => (
                        <div key={event.id} className="flex flex-wrap items-center gap-2">
                            <a
                                href={`/events/${event.id}`}
                                className="text-indigo-600 hover:underline font-medium"
                            >
                                {event.title}
                            </a>
                            {event.location ? (
                                <a
                                    href={createMapLink(event.location)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    Avaa kartassa
                                </a>
                            ) : (
                                <span className="text-gray-400">Ei sijaintia</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
