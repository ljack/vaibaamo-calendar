import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UpdateNotification } from './UpdateNotification'
import { useKonamiCode } from '../hooks/useKonamiCode'
import JourneyOverlay from './JourneyOverlay'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Event } from '../types'

function JourneyFeature({
    isOpen,
    onClose,
}: {
    isOpen: boolean
    onClose: () => void
}) {
    const [events, setEvents] = useState<Event[]>([])
    const [hasFetched, setHasFetched] = useState(false)

    useEffect(() => {
        if (isOpen && !hasFetched) {
            // Fetch events only when triggered
            supabase
                .from('events')
                .select('*')
                .then(({ data }) => {
                    if (data) {
                        setEvents(data as unknown as Event[])
                        setHasFetched(true)
                    }
                })
        }
    }, [isOpen, hasFetched])

    if (!isOpen) return null

    return <JourneyOverlay events={events} onClose={onClose} />
}

export default function Layout() {
    const { user, isAdmin, signOut } = useAuth()
    const konamiTriggered = useKonamiCode()
    const [journeyOpen, setJourneyOpen] = useState(false)

    useEffect(() => {
        if (konamiTriggered) {
            setJourneyOpen(true)
        }
    }, [konamiTriggered])

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <Link to="/" className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold text-indigo-600">Vaibaamo</span>
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            {isAdmin && (
                                <Link
                                    to="/events/new"
                                    className="text-gray-900 hover:text-indigo-600 font-medium text-sm"
                                >
                                    + Luo tapahtuma
                                </Link>
                            )}
                            {user ? (
                                <>
                                    <span className="text-sm text-gray-700 hidden sm:block">
                                        {user.email}
                                    </span>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await signOut()
                                            } catch (e) {
                                                console.error('Sign out failed', e)
                                            } finally {
                                                window.location.href = '/'
                                            }
                                        }}
                                        className="ml-4 px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Kirjaudu ulos
                                    </button>
                                </>
                            ) : (
                                <Link
                                    to="/login"
                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                    Kirjaudu sisään
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto py-6 sm:px-6 lg:px-8">
                <Outlet />
            </main>

            <JourneyFeature
                isOpen={journeyOpen}
                onClose={() => setJourneyOpen(false)}
            />

            <UpdateNotification />

            <footer className="bg-white border-t border-gray-200 py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                    <div>&copy; {new Date().getFullYear()} Vaibaamo.</div>
                    <button
                        onClick={() => setJourneyOpen(true)}
                        className="text-xs text-gray-300 hover:text-gray-500 transition-colors duration-300 cursor-pointer"
                        title="Start Journey"
                    >
                        π
                    </button>
                </div>
            </footer>
        </div>
    )
}
