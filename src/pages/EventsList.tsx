import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Event } from '../types'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function EventsList() {
    const { loading: authLoading, checkSession } = useAuth()
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const DEBUG_AUTH = import.meta.env.VITE_SUPABASE_DEBUG_AUTH === 'true'
    const hasFetchedRef = useRef(false)
    const isFetchingRef = useRef(false)
    const abortRetryRef = useRef(0)

    useEffect(() => {
        const abortController = new AbortController()
        const startFetch = () => {
            if (hasFetchedRef.current || isFetchingRef.current) return
            isFetchingRef.current = true
            if (DEBUG_AUTH) console.log('[EventsList] calling fetchEvents')
            fetchEvents(abortController.signal)
        }

        if (DEBUG_AUTH) console.log('[EventsList] useEffect triggered. authLoading:', authLoading)
        if (authLoading) {
            if (DEBUG_AUTH) console.log('[EventsList] Waiting for auth, starting fallback timer...')
        } else {
            startFetch()
        }

        const fallbackTimer = window.setTimeout(() => {
            if (authLoading) {
                if (DEBUG_AUTH) console.log('[EventsList] Auth still loading, proceeding without it')
                startFetch()
            }
        }, 2000)

        return () => {
            clearTimeout(fallbackTimer)
            abortController.abort()
        }
    }, [authLoading])

    const fetchEvents = async (signal?: AbortSignal) => {
        console.log('Fetching events...')
        setLoading(true)
        setError(null)
        const startTime = Date.now()

        // Use a new controller if one wasn't passed (internal retry)
        // Create a timeout signal if one wasn't provided or to enforce a limit
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
            timeoutController.abort(new Error('Request timed out after 10s'))
        }, 10000);

        try {
            const requestController = new AbortController();

            // If parent signal aborts, abort requestController
            if (signal) {
                // Use 'once' to avoid leak if not using addEventListener options carefully, 
                // but simpler: check if aborted.
                if (signal.aborted) {
                    requestController.abort();
                } else {
                    signal.addEventListener('abort', () => requestController.abort(), { once: true });
                }
            }

            // Also link timeout controller
            timeoutController.signal.addEventListener('abort', () => requestController.abort(timeoutController.signal.reason), { once: true });

            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('start_time', { ascending: true })
                .abortSignal(requestController.signal)

            if (error) {
                if (error?.message?.includes('AbortError')) {
                    throw error
                }
                console.error('Supabase error:', error)
                throw error
            }

            console.log('Events data:', data)
            setEvents(data || [])
            hasFetchedRef.current = true
            console.log(`Events fetched in ${Date.now() - startTime}ms`)
        } catch (err: any) {
            const isAbort = err?.name === 'AbortError' || /aborted without reason/i.test(err?.message || '')
            const isTimeout = timeoutController.signal.aborted || err?.message?.includes('timed out')

            if (isAbort && !isTimeout) {
                if (DEBUG_AUTH) console.log('[EventsList] Request aborted, skipping error UI')
                if (abortRetryRef.current < 1) {
                    abortRetryRef.current += 1
                    fetchEvents()
                }
                return
            }

            console.error('Error fetching events:', err)

            if (isTimeout) {
                console.log('Request timed out, checking session validity...')
                const isSessionValid = await checkSession()
                if (!isSessionValid) {
                    setError('Istunto on vanhentunut. Kirjaudu sisään uudelleen.')
                } else {
                    setError('Yhteys aikakatkaistiin. Tarkista internetyhteytesi.')
                }
            } else {
                setError('Tapahtumien lataaminen epäonnistui. Yritä myöhemmin uudelleen.')
            }
        } finally {
            console.log('Finished loading state')
            setLoading(false)
            clearTimeout(timeoutId)
            isFetchingRef.current = false
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="md:flex md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
                    </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4 animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                            <div className="flex space-x-4 pt-2">
                                <div className="h-4 bg-gray-200 rounded w-20"></div>
                                <div className="h-4 bg-gray-200 rounded w-20"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <h3 className="mt-2 text-lg font-semibold text-gray-900">{error}</h3>
                <button
                    onClick={() => fetchEvents()}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                    Yritä uudelleen
                </button>
            </div>
        )
    }

    if (events.length === 0) {
        return (
            <div className="text-center py-12">
                <h3 className="mt-2 text-sm font-semibold text-gray-900">Ei tulevia tapahtumia</h3>
                <p className="mt-1 text-sm text-gray-500">Tarkista myöhemmin uudelleen!</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="md:flex md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Tulevat tapahtumat
                    </h2>
                </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                    <Link
                        key={event.id}
                        to={`/events/${event.id}`}
                        className="block group relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {event.title}
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                                {event.description}
                            </p>
                            <div className="mt-4 flex items-center text-sm text-gray-500 space-x-4">
                                <div className="flex items-center">
                                    <span className="mr-1.5">📅</span>
                                    {new Date(event.start_time).toLocaleDateString('fi-FI')}
                                </div>
                                <div className="flex items-center">
                                    <span className="mr-1.5">📍</span>
                                    {event.location || 'Online'}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
