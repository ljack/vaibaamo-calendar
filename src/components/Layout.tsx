import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UpdateNotification } from './UpdateNotification'
import { useKonamiCode } from '../hooks/useKonamiCode'
import JourneyOverlay from './JourneyOverlay'
import { useEffect, useState } from 'react'
import { PasskeyPrompt } from './PasskeyPrompt'
import { supabase } from '../lib/supabase'
import type { Event } from '../types'
import { VaibaamoLogo } from './Logo'
import { useTranslation } from 'react-i18next'

import { LanguageSelector } from './LanguageSelector'

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
    const { t } = useTranslation()
    const konamiTriggered = useKonamiCode()
    const [journeyOpen, setJourneyOpen] = useState(false)

    // Check for journey parameters on mount and when location changes
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const hasCar = urlParams.has('car')
        const hasDifficulty = urlParams.has('difficulty')
        const isDemo = urlParams.get('demo') === 'true'

        if ((hasCar && hasDifficulty) || isDemo) {
            setJourneyOpen(true)
        }
    }, [])

    // Also check for Konami code
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
                        <div className="flex items-center space-x-6">
                            <Link to="/" className="flex-shrink-0 flex items-center group">
                                <VaibaamoLogo />
                            </Link>
                            <Link to="/concept" className="text-gray-500 hover:text-gray-900 font-medium">
                                {t('layout.concept')}
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <LanguageSelector />
                            {isAdmin && (
                                <Link
                                    to="/events/new"
                                    className="text-gray-900 hover:text-indigo-600 font-medium text-sm"
                                >
                                    {t('layout.createEvent')}
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
                                        {t('layout.logout')}
                                    </button>
                                </>
                            ) : (
                                <Link
                                    to="/login"
                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                    {t('layout.login')}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <PasskeyPrompt />

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
                    <div className="flex items-center gap-4">
                        <span>&copy; {new Date().getFullYear()} {t('layout.footer')}</span>
                        <a
                            href="https://github.com/ljack/vaibaamo-calendar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-indigo-600 transition-colors duration-300 flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.744.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            GitHub
                        </a>
                    </div>

                    <button
                        onClick={() => setJourneyOpen(true)}
                        className="text-xs text-gray-300 hover:text-gray-500 transition-colors duration-300 cursor-pointer"
                        title={t('layout.startJourney')}
                    >
                        π
                    </button>
                </div>
            </footer>
        </div>
    )
}
