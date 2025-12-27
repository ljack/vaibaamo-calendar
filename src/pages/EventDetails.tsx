import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Event, Participant } from '../types'
import EventsMap from '../components/EventsMap'
import { createMapLink } from '../lib/geocode'

export default function EventDetails() {
    const { id } = useParams<{ id: string }>()
    const { user, isAdmin } = useAuth()
    const navigate = useNavigate()
    const [event, setEvent] = useState<Event | null>(null)
    const [participant, setParticipant] = useState<Participant | null>(null)
    const [loading, setLoading] = useState(true)
    const [registering, setRegistering] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    useEffect(() => {
        if (id) {
            fetchEvent(id)
        }
    }, [id, user])

    const fetchEvent = async (eventId: string) => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single()

            if (error) throw error
            setEvent(data)

            if (user) {
                const { data: partData } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('event_id', eventId)
                    .eq('user_id', user.id)
                    .single()

                setParticipant(partData)
            }
        } catch (error) {
            console.error('Error fetching event:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async () => {
        if (!user || !event) return
        setRegistering(true)

        try {
            const { error } = await supabase
                .from('participants')
                .insert({
                    event_id: event.id,
                    user_id: user.id,
                    status: 'registered'
                })

            if (error) throw error
            await fetchEvent(event.id)
        } catch (error: any) {
            alert('Virhe ilmoittautumisessa: ' + error.message)
        } finally {
            setRegistering(false)
        }
    }

    const handleCancel = async () => {
        if (!user || !event || !participant) return
        setRegistering(true)

        try {
            const { error } = await supabase
                .from('participants')
                .delete()
                .eq('id', participant.id)

            if (error) throw error
            setParticipant(null)
        } catch (error: any) {
            alert('Virhe peruutuksessa: ' + error.message)
        } finally {
            setRegistering(false)
        }
    }

    const handleDelete = async () => {
        if (!event) return
        setDeleteError(null)

        const confirmed = window.confirm('Haluatko varmasti poistaa tapahtuman?')
        if (!confirmed) return

        setDeleting(true)
        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', event.id)

            if (error) throw error
            navigate('/')
        } catch (error: any) {
            setDeleteError(error.message || 'Tapahtuman poistaminen epäonnistui.')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return <div className="text-center py-10">Ladataan tietoja...</div>
    }

    if (!event) {
        return <div className="text-center py-10">Tapahtumaa ei löytynyt.</div>
    }

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
                <h3 className="text-2xl font-semibold leading-7 text-gray-900">
                    {event.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    {event.description}
                </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Ajankohta</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                            {new Date(event.start_time).toLocaleString('fi-FI')} - {new Date(event.end_time).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                        </dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Sijainti</dt>
                        <dd className="mt-1 text-sm text-gray-900">{event.location || 'Online'}</dd>
                        {event.location && (
                            <a
                                href={createMapLink(event.location)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex text-sm text-indigo-600 hover:underline"
                            >
                                Avaa kartassa
                            </a>
                        )}
                    </div>
                    {event.location && (
                        <div className="sm:col-span-2">
                            <EventsMap
                                events={[event]}
                                title="Sijainti kartalla"
                                showList={false}
                            />
                        </div>
                    )}
                    {deleteError && (
                        <div className="sm:col-span-2">
                            <p className="text-sm text-red-600">{deleteError}</p>
                        </div>
                    )}
                    <div className="sm:col-span-2">
                        <div className="flex items-center justify-end space-x-4 mt-6">
                            {!user ? (
                                <Link
                                    to="/login"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Kirjaudu ilmoittautuaksesi
                                </Link>
                            ) : (
                                <>
                                    {/* Show Edit button if user is creator OR admin. 
                                        Note: event type likely needs creator_id added to TypeScript interface to avoid error.
                                        We cast to any for now or should handle type update. 
                                    */}
                                    {(isAdmin || user.id === (event as any).creator_id) && (
                                        <Link
                                            to={`/events/${event.id}/edit`}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
                                        >
                                            Muokkaa
                                        </Link>
                                    )}
                                    {isAdmin && (
                                        <button
                                            onClick={handleDelete}
                                            disabled={deleting}
                                            className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            {deleting ? 'Poistetaan...' : 'Poista'}
                                        </button>
                                    )}

                                    {participant ? (
                                        <button
                                            onClick={handleCancel}
                                            disabled={registering}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            {registering ? 'Perutaan...' : 'Peru ilmoittautuminen'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleRegister}
                                            disabled={registering}
                                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            {registering ? 'Ilmoittaudutaan...' : 'Ilmoittaudu mukaan'}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </dl>
            </div>
        </div>
    )
}
