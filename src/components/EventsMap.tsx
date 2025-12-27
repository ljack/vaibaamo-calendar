import { useEffect, useMemo, useRef, useState } from 'react'
import type { Event } from '../types'
import { geocodeLocation, createMapLink } from '../lib/geocode'
import { loadLeaflet } from '../lib/leafletLoader'
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

type JourneyStatus = 'idle' | 'traveling' | 'arrived'

type JourneyLayers = {
    route?: any
    car?: any
}

export default function EventsMap({
    events,
    title = 'Tapahtumien kartta',
    showList = true,
    className = '',
}: EventsMapProps) {
    const mapRef = useRef<HTMLDivElement | null>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<any>(null)
    const journeyLayersRef = useRef<JourneyLayers>({})
    const konamiProgressRef = useRef(0)
    const routeAnimationRef = useRef<number | null>(null)
    const legDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [geocodedEvents, setGeocodedEvents] = useState<GeocodedEvent[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [journeyUnlocked, setJourneyUnlocked] = useState(false)
    const [journeyStatus, setJourneyStatus] = useState<JourneyStatus>('idle')
    const [journeyLegIndex, setJourneyLegIndex] = useState(0)
    const [journeyAction, setJourneyAction] = useState<string | null>(null)
    const [journeyVibe, setJourneyVibe] = useState<string | null>(null)
    const [journeyToast, setJourneyToast] = useState<string | null>(null)

    const eventsWithLocation = useMemo(
        () => events.filter((event) => event.location?.trim()),
        [events]
    )

    const journeyStops = useMemo(
        () => geocodedEvents.map(({ event, lat, lon }) => ({ event, lat, lon })),
        [geocodedEvents]
    )

    const travelActions = useMemo(
        () => [
            {
                label: '🚻 Piss break',
                punchline: 'Tauolla bongattiin Suomen siistein huoltsikka – kahvi ja pulla sisältyivät.'
            },
            {
                label: '🔌 Lataa e-auto',
                punchline: 'Laturi hyrisi ja koodi buildasi – sähköä akkuihin ja ihmisiin.'
            },
            {
                label: '⛽ Dieseliä bussille',
                punchline: 'Tankki täyteen ja kuskille munkki – Vaibaamo-bussi jatkaa lauluaan.'
            },
            {
                label: '🎶 Päivitä soittolista',
                punchline: 'DJ vaihtoi listalle chippiä ja eurodancea – commitit kulkee tuplanopeudella.'
            },
        ],
        []
    )

    const clearJourneyLayers = () => {
        if (journeyLayersRef.current.car) {
            journeyLayersRef.current.car.remove()
        }
        if (journeyLayersRef.current.route) {
            journeyLayersRef.current.route.remove()
        }
        journeyLayersRef.current = {}
    }

    const stopJourneyTimers = () => {
        if (routeAnimationRef.current) {
            cancelAnimationFrame(routeAnimationRef.current)
            routeAnimationRef.current = null
        }
        if (legDelayRef.current) {
            clearTimeout(legDelayRef.current)
            legDelayRef.current = null
        }
    }

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
        const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

        const handler = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase()
            const expected = sequence[konamiProgressRef.current].toLowerCase()

            if (key === expected) {
                konamiProgressRef.current += 1
                if (konamiProgressRef.current === sequence.length) {
                    setJourneyUnlocked(true)
                    setJourneyToast('🎮 Konami löydetty! Vaibaamo roadtrip aukeaa.')
                    konamiProgressRef.current = 0
                }
            } else {
                konamiProgressRef.current = key === sequence[0].toLowerCase() ? 1 : 0
            }
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    useEffect(() => {
        if (!journeyToast) return
        const timeout = setTimeout(() => setJourneyToast(null), 4000)
        return () => clearTimeout(timeout)
    }, [journeyToast])

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
                marker.addTo(markersRef.current)
                bounds.extend([lat, lon])
            })
            map.fitBounds(bounds, { padding: [40, 40] })
        }

        setupMap()

        return () => {
            canceled = true
        }
    }, [geocodedEvents])

    const startLegAnimation = async (startIndex: number) => {
        if (!mapInstanceRef.current || journeyStops.length === 0) return
        const currentStop = journeyStops[startIndex]
        const nextStop = journeyStops[startIndex + 1]

        setJourneyStatus(nextStop ? 'traveling' : 'arrived')
        setJourneyLegIndex(startIndex)
        setJourneyVibe(nextStop ? null : createVibeLine(currentStop.event))
        setJourneyAction(null)

        if (!nextStop) return

        const start = performance.now()
        const duration = 3600 + Math.random() * 800

        const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            const lat = currentStop.lat + (nextStop.lat - currentStop.lat) * progress
            const lon = currentStop.lon + (nextStop.lon - currentStop.lon) * progress

            journeyLayersRef.current.car?.setLatLng([lat, lon])

            if (progress < 1) {
                routeAnimationRef.current = requestAnimationFrame(animate)
            } else {
                setJourneyStatus('arrived')
                setJourneyLegIndex(startIndex + 1)
                setJourneyVibe(createVibeLine(nextStop.event))
                routeAnimationRef.current = null
                legDelayRef.current = setTimeout(() => startLegAnimation(startIndex + 1), 1500)
            }
        }

        routeAnimationRef.current = requestAnimationFrame(animate)
    }

    useEffect(() => {
        if (!journeyUnlocked || !journeyStops.length || !mapInstanceRef.current) {
            return
        }

        let cancelled = false

        const runJourney = async () => {
            stopJourneyTimers()
            clearJourneyLayers()

            const L = await loadLeaflet()
            if (cancelled || !mapInstanceRef.current) return

            const map = mapInstanceRef.current

            if (journeyStops.length > 1) {
                const route = L.polyline(
                    journeyStops.map(({ lat, lon }) => [lat, lon]),
                    { color: '#7c3aed', weight: 3, opacity: 0.7, dashArray: '8 6' }
                )
                route.addTo(map)
                journeyLayersRef.current.route = route
                const bounds = route.getBounds?.() ?? L.latLngBounds(journeyStops.map(({ lat, lon }) => [lat, lon]))
                map.fitBounds(bounds, { padding: [50, 50] })
            } else {
                map.setView([journeyStops[0].lat, journeyStops[0].lon], 8)
            }

            const carIcon = L.divIcon({
                html: '<div style="font-size:24px">🚐</div>',
                className: 'vaibaamo-car-icon',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            })
            const car = L.marker([journeyStops[0].lat, journeyStops[0].lon], { icon: carIcon })
            car.addTo(map)
            journeyLayersRef.current.car = car

            startLegAnimation(0)
        }

        runJourney()

        return () => {
            cancelled = true
            stopJourneyTimers()
            clearJourneyLayers()
        }
    }, [journeyUnlocked, journeyStops])

    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
            stopJourneyTimers()
            clearJourneyLayers()
        }
    }, [])

    const createVibeLine = (event: Event) => {
        const locality = event.location?.split(',')[0]?.trim() || 'mystinen paikka'
        const flavours = [
            'koodikahvit porisevat ja paikallinen radio soittaa taustalla',
            'jengi pair-ohjelmoi ja hakee uusia makuja lähikahvilasta',
            'commitit tehdään saunaetäkonttorilta höyryjen keskeltä',
            'bussillinen devareita testaa uutta featurea torikahvien voimin',
        ]
        const flavour = flavours[event.title.length % flavours.length]
        return `💻 ${locality}: ${flavour}.`
    }

    if (!events.length) return null

    return (
        <section className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {isLoading && (
                    <span className="text-sm text-gray-500">Haetaan sijainteja...</span>
                )}
            </div>
            <div className="relative w-full h-64 rounded-md overflow-hidden border border-gray-200">
                <div className="absolute inset-0" ref={mapRef} />
                <div className="absolute top-2 right-2 flex flex-col gap-2 text-xs text-gray-800">
                    <div className="bg-white/80 backdrop-blur border border-indigo-100 rounded-md px-3 py-2 shadow-sm">
                        <div className="font-semibold text-indigo-700 flex items-center gap-1">
                            <span>🎮</span> Roadtrippi
                        </div>
                        <p className="mt-1 leading-snug text-gray-600">
                            {journeyUnlocked
                                ? 'Vaibaamo-bussi kiertää tapahtumia.'
                                : 'Avaa salamatka: ↑↑↓↓←→←→BA'}
                        </p>
                    </div>
                    {journeyToast && (
                        <div className="bg-indigo-600 text-white rounded-md px-3 py-2 shadow-md animate-pulse">
                            {journeyToast}
                        </div>
                    )}
                </div>
            </div>
            {!eventsWithLocation.length && (
                <p className="mt-3 text-sm text-gray-500">
                    Tapahtumille ei ole lisätty sijaintia.
                </p>
            )}
            <div className="mt-4 border border-indigo-100 rounded-md bg-indigo-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-indigo-800">Vaibaamo Roadtrip</p>
                        <p className="text-sm text-indigo-900/80">
                            {journeyUnlocked
                                ? journeyStops.length
                                    ? `Legi ${Math.min(journeyLegIndex + 1, journeyStops.length)}/${journeyStops.length}: ` +
                                      `${journeyStops[Math.min(journeyLegIndex, journeyStops.length - 1)].event.title}`
                                    : 'Odottelee paikkojen geokoodauksia...'
                                : 'Syötä Konami-koodi avataksesi matkaseurannan.'}
                        </p>
                    </div>
                    {journeyStatus === 'traveling' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-white px-2 py-1 rounded-full shadow-sm">
                            <span className="animate-ping h-2 w-2 rounded-full bg-indigo-500 opacity-75" aria-hidden />
                            Liikkeellä
                        </span>
                    )}
                </div>

                {journeyUnlocked && journeyStops.length > 0 && (
                    <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-900/80">
                            {journeyStops.map((stop, idx) => (
                                <span
                                    key={stop.event.id}
                                    className={`px-2 py-1 rounded-full border ${
                                        idx === journeyLegIndex
                                            ? 'border-indigo-500 bg-white shadow-sm'
                                            : 'border-indigo-200 bg-white/70'
                                    }`}
                                >
                                    {idx + 1}. {stop.event.location || 'Mysteeripaikka'}
                                </span>
                            ))}
                        </div>

                        {journeyVibe && (
                            <div className="rounded-md bg-white border border-indigo-100 p-3 shadow-sm animate-[pulse_2s_ease-in-out]">
                                <p className="text-sm text-indigo-900 font-semibold flex items-center gap-2">
                                    <span className="text-lg">✨</span>
                                    Saapuminen: {journeyStops[journeyLegIndex]?.event.title}
                                </p>
                                <p className="text-sm text-indigo-800 mt-1">{journeyVibe}</p>
                            </div>
                        )}

                        {journeyStatus === 'traveling' && (
                            <div className="rounded-md bg-white border border-indigo-100 p-3 shadow-sm">
                                <p className="text-sm font-semibold text-indigo-900 mb-2">Matkatoiminnot</p>
                                <div className="flex flex-wrap gap-2">
                                    {travelActions.map((action) => (
                                        <button
                                            key={action.label}
                                            type="button"
                                            onClick={() => setJourneyAction(action.punchline)}
                                            className="text-xs px-3 py-2 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                                {journeyAction && (
                                    <p className="mt-2 text-sm text-indigo-900 flex items-center gap-2">
                                        <span className="text-base">🛠️</span>
                                        {journeyAction}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
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
