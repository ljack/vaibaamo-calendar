import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Event, Participant } from '../types'
import EventsMap from '../components/EventsMap'
import { createMapLink } from '../lib/geocode'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type ParticipantEmail = {
    user_id: string
    email: string | null
}

export default function EventDetails() {
    const { t, i18n } = useTranslation()
    const { id } = useParams<{ id: string }>()
    const { user, isAdmin } = useAuth()
    const navigate = useNavigate()
    const [event, setEvent] = useState<Event | null>(null)
    const [participant, setParticipant] = useState<Participant | null>(null)
    const [participantCount, setParticipantCount] = useState<number | null>(null)
    const [participantEmails, setParticipantEmails] = useState<string[]>([])
    const [participantEmailsError, setParticipantEmailsError] = useState<string | null>(null)
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

            const { count, error: countError } = await supabase
                .from('participants')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('status', 'registered')

            if (countError) {
                console.error('Error fetching participant count:', countError)
                setParticipantCount(null)
            } else {
                setParticipantCount(count ?? 0)
            }

            if (user) {
                const { data: partData } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('event_id', eventId)
                    .eq('user_id', user.id)
                    .single()

                setParticipant(partData)

                const canViewEmails = isAdmin || user.id === data.creator_id
                if (canViewEmails) {
                    const { data: participantData, error: participantError } = await supabase.rpc('get_event_participants', {
                        p_event_id: eventId,
                    })

                    if (participantError) {
                        console.error('Error fetching participant emails:', participantError)
                        setParticipantEmails([])
                        setParticipantEmailsError(t('events.details.emailsError'))
                    } else {
                        const emails = (participantData as ParticipantEmail[] | null)?.map((row) => row.email).filter(Boolean) as string[] || []
                        setParticipantEmails(emails)
                        setParticipantEmailsError(null)
                    }
                } else {
                    setParticipantEmails([])
                    setParticipantEmailsError(null)
                }
            } else {
                setParticipantEmails([])
                setParticipantEmailsError(null)
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
            alert(t('events.details.registerError') + ' ' + error.message)
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
            alert(t('events.details.cancelError') + ' ' + error.message)
        } finally {
            setRegistering(false)
        }
    }

    const handleDelete = async () => {
        if (!event) return
        setDeleteError(null)

        const confirmed = window.confirm(t('events.details.confirmDelete'))
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
            setDeleteError(error.message || t('events.details.deleteError'))
        } finally {
            setDeleting(false)
        }
    }

    const [activeTab, setActiveTabState] = useState<'info' | 'plan' | 'recap'>('info')
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

    const setActiveTab = (tab: 'info' | 'plan' | 'recap') => {
        setActiveTabState(tab)
        const url = new URL(window.location.href)
        if (tab === 'info') {
            url.searchParams.delete('tab')
        } else {
            url.searchParams.set('tab', tab)
        }
        window.history.pushState({}, '', url.toString())
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const tab = params.get('tab')
        if (tab === 'plan' || tab === 'recap') {
            setActiveTabState(tab)
        }
    }, [])

    const copyLink = (tab: string) => {
        // 1. Construct the direct deep link to the app (for the redirect)
        const directUrl = new URL(window.location.href)
        directUrl.searchParams.set('tab', tab)
        const redirectParam = encodeURIComponent(directUrl.toString())

        // 2. Construct the Sharing Proxy URL (Supabase Edge Function)
        // This URL returns HTML with Open Graph tags + JS Redirect
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        let finalUrl = directUrl.toString()

        if (supabaseUrl) {
            finalUrl = `${supabaseUrl}/functions/v1/event-og-share?id=${id}&tab=${tab}&redirect=${redirectParam}`
        }

        navigator.clipboard.writeText(finalUrl)
        setCopyFeedback(tab)
        setTimeout(() => setCopyFeedback(null), 2000)
    }

    if (loading) {
        return <div className="text-center py-10">{t('events.details.loading')}</div>
    }

    if (!event) {
        return <div className="text-center py-10">{t('events.details.notFound')}</div>
    }

    // Determine locale for dates (default to fi-FI if not set or en-US)
    const dateLocale = i18n.language || 'fi-FI'

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
                <div>
                    <h3 className="text-2xl font-semibold leading-7 text-gray-900">
                        {event.title}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        {event.description}
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    {!user ? (
                        <Link
                            to="/login"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            {t('events.details.loginToJoin')}
                        </Link>
                    ) : (
                        <>
                            {(isAdmin || user.id === (event as any).creator_id) && (
                                <Link
                                    to={`/events/${event.id}/edit?tab=${activeTab === 'info' ? 'basic' : activeTab}`}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {t('events.details.edit')}
                                </Link>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    {deleting ? t('events.details.deleting') : t('events.details.delete')}
                                </button>
                            )}
                            {participant ? (
                                <button
                                    onClick={handleCancel}
                                    disabled={registering}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {registering ? t('events.details.leaving') : t('events.details.leave')}
                                </button>
                            ) : (
                                <button
                                    onClick={handleRegister}
                                    disabled={registering}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {registering ? t('events.details.joining') : t('events.details.join')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`${activeTab === 'info'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        {t('events.details.tabInfo')}
                    </button>
                    {(event.plan_markdown || event.media_assets?.some((m) => m.section === 'plan')) && (
                        <button
                            onClick={() => setActiveTab('plan')}
                            className={`${activeTab === 'plan'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {t('events.details.tabPlan')}
                        </button>
                    )}
                    {(event.recap_markdown || event.media_assets?.some((m) => m.section === 'recap')) && (
                        <button
                            onClick={() => setActiveTab('recap')}
                            className={`${activeTab === 'recap'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {t('events.details.tabRecap')}
                        </button>
                    )}
                </nav>
            </div>

            <div className="px-4 py-5 sm:px-6 min-h-[400px]">
                {activeTab === 'info' && (
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">{t('events.details.time')}</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                                {new Date(event.start_time).toLocaleString(dateLocale)} - {new Date(event.end_time).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                            </dd>
                        </div>
                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">{t('events.details.location')}</dt>
                            <dd className="mt-1 text-sm text-gray-900">{event.location || t('events.details.online')}</dd>
                            {event.location && (
                                <a
                                    href={createMapLink(event.location)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-sm text-indigo-600 hover:underline"
                                >
                                    {t('events.details.openMap')}
                                </a>
                            )}
                        </div>
                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">{t('events.details.participants')}</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                                {participantCount === null
                                    ? '—'
                                    : event.max_participants
                                        ? `${participantCount} / ${event.max_participants}`
                                        : t('events.details.participantsCount', { count: participantCount })}
                            </dd>
                        </div>
                        {event.location && (
                            <div className="sm:col-span-2">
                                <EventsMap
                                    events={[event]}
                                    title={t('events.details.mapTitle')}
                                    showList={false}
                                />
                            </div>
                        )}
                        {(isAdmin || (user && user.id === event.creator_id)) && (
                            <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-gray-500">{t('events.details.registered')}</dt>
                                <dd className="mt-2 text-sm text-gray-900">
                                    {participantEmailsError && (
                                        <span className="text-sm text-red-600">{participantEmailsError}</span>
                                    )}
                                    {!participantEmailsError && participantEmails.length === 0 && (
                                        <span className="text-sm text-gray-500">{t('events.details.noRegistered')}</span>
                                    )}
                                    {!participantEmailsError && participantEmails.length > 0 && (
                                        <ul className="space-y-1">
                                            {participantEmails.map((email) => (
                                                <li key={email}>{email}</li>
                                            ))}
                                        </ul>
                                    )}
                                </dd>
                            </div>
                        )}
                        {deleteError && (
                            <div className="sm:col-span-2">
                                <p className="text-sm text-red-600">{deleteError}</p>
                            </div>
                        )}

                    </dl>
                )}

                {activeTab === 'plan' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="prose max-w-none">
                                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                                    {event.plan_markdown || `*${t('events.details.noPlan')}*`}
                                </ReactMarkdown>
                            </div>
                            <button
                                onClick={() => copyLink('plan')}
                                className="text-indigo-600 text-sm hover:underline flex items-center gap-1"
                            >
                                🔗 {copyFeedback === 'plan' ? t('events.details.copied') : t('events.details.share')}
                            </button>
                        </div>

                        {event.media_assets?.some((m) => m.section === 'plan') && (
                            <div className="border-t pt-6">
                                <h4 className="text-lg font-medium mb-4">{t('events.details.galleryPlan')}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {event.media_assets.filter((m) => m.section === 'plan').map((asset, i) => (
                                        <div key={i} className="group relative">
                                            <a href={asset.url} target="_blank" rel="noreferrer">
                                                <img src={asset.url} alt={asset.caption} className="rounded-lg shadow-sm object-cover h-32 w-full hover:opacity-90 transition-opacity" />
                                            </a>
                                            {asset.caption && <div className="text-xs text-gray-500 mt-1">{asset.caption}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'recap' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="prose max-w-none">
                                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                                    {event.recap_markdown || `*${t('events.details.noRecap')}*`}
                                </ReactMarkdown>
                            </div>
                            <button
                                onClick={() => copyLink('recap')}
                                className="text-indigo-600 text-sm hover:underline flex items-center gap-1"
                            >
                                🔗 {copyFeedback === 'recap' ? t('events.details.copied') : t('events.details.share')}
                            </button>
                        </div>

                        {event.media_assets?.some((m) => m.section === 'recap') && (
                            <div className="border-t pt-6">
                                <h4 className="text-lg font-medium mb-4">{t('events.details.galleryRecap')}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {event.media_assets.filter((m) => m.section === 'recap').map((asset, i) => (
                                        <div key={i} className="group relative">
                                            <a href={asset.url} target="_blank" rel="noreferrer">
                                                <img src={asset.url} alt={asset.caption} className="rounded-lg shadow-sm object-cover h-32 w-full hover:opacity-90 transition-opacity" />
                                            </a>
                                            {asset.caption && <div className="text-xs text-gray-500 mt-1">{asset.caption}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
