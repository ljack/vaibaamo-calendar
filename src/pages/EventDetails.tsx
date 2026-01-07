import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Event, Participant, EventOption, EventVote } from '../types'
import EventsMap from '../components/EventsMap'
import { createMapLink } from '../lib/geocode'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'

type ParticipantEmail = {
    user_id: string
    email: string | null
}

interface EventVoteWithProfile extends EventVote {
    profiles: {
        full_name: string | null
        display_name: string | null
    } | null
    participant_display_name?: string | null
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
    const [options, setOptions] = useState<EventOption[]>([])
    const [votes, setVotes] = useState<EventVoteWithProfile[]>([])
    const [votingLoading, setVotingLoading] = useState(false)
    const [accessCodeInput, setAccessCodeInput] = useState('')
    const [showCodePrompt, setShowCodePrompt] = useState(false)
    const [accessDenied, setAccessDenied] = useState(false)
    const [joinDisplayName, setJoinDisplayName] = useState('')
    const [eventOwners, setEventOwners] = useState<string[]>([])

    useEffect(() => {
        if (id) {
            fetchEvent(id)
            fetchVotingData(id)
        }
    }, [id, user])

    const fetchVotingData = async (eventId: string) => {
        try {
            const { data: optionsData } = await supabase
                .from('event_options')
                .select('*')
                .eq('event_id', eventId)
                .order('start_time', { ascending: true })

            setOptions(optionsData || [])

            const { data: votesData } = await supabase
                .from('event_votes')
                .select('*, profiles(full_name, display_name)')
                .in('option_id', (optionsData || []).map(o => o.id))

            // Fetch participants to get event-specific display names
            const { data: participantsData } = await supabase
                .from('participants')
                .select('user_id, display_name')
                .eq('event_id', eventId)

            const participantMap = new Map(participantsData?.map(p => [p.user_id, p.display_name]) || [])

            const votesWithParticipantNames = (votesData || []).map(v => ({
                ...v,
                participant_display_name: participantMap.get(v.user_id)
            }))

            setVotes(votesWithParticipantNames as EventVoteWithProfile[])
            
            // Fetch event owners
            const { data: ownersData } = await supabase
                .from('event_owners')
                .select('user_id')
                .eq('event_id', eventId)
            
            setEventOwners(ownersData?.map(o => o.user_id) || [])
        } catch (error) {
            console.error('Error fetching voting data:', error)
        }
    }

    const fetchEvent = async (eventId: string) => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') { // Not found - might be restricted by RLS
                    setAccessDenied(true)
                }
                throw error
            }

            // Access control for hidden events
            if (data.event_type === 'hidden') {
                const params = new URLSearchParams(window.location.search)
                const urlCode = params.get('code')
                const storageKey = `event_access_code_${eventId}`
                const storedCode = localStorage.getItem(storageKey)
                const effectiveCode = urlCode || storedCode
                
                const isCreatorOrAdmin = isAdmin || (user && (user.id === data.creator_id || eventOwners.includes(user.id)))
                
                if (isCreatorOrAdmin || effectiveCode === data.access_code) {
                    setShowCodePrompt(false)
                    // Persist the code if it's correct
                    if (effectiveCode && effectiveCode === data.access_code) {
                        localStorage.setItem(storageKey, effectiveCode)
                        // Clean up URL if code was in it
                        if (urlCode) {
                            const newUrl = new URL(window.location.href)
                            newUrl.searchParams.delete('code')
                            window.history.replaceState({}, '', newUrl.toString())
                        }
                    }
                } else {
                    setShowCodePrompt(true)
                }
            } else {
                setShowCodePrompt(false)
            }

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

                // Pre-fill Join Display Name if profile has one and we haven't typed anything yet
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', user.id)
                    .single()
                
                if (profile?.display_name && !joinDisplayName) {
                    setJoinDisplayName(profile.display_name)
                }

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

    const handleVerifyCode = (e: React.FormEvent) => {
        e.preventDefault()
        if (event && accessCodeInput === event.access_code) {
            setShowCodePrompt(false)
            // Persist the code
            localStorage.setItem(`event_access_code_${event.id}`, accessCodeInput)
        } else {
            window.alert(t('events.details.wrongCode'))
        }
    }

    const handleVote = async (optionId: string) => {
        if (!user) {
            window.alert(t('events.details.loginToJoin'))
            navigate('/login')
            return
        }
        setVotingLoading(true)
        try {
            const existingVote = votes.find(v => v.option_id === optionId && v.user_id === user.id)
            if (existingVote) {
                const { error } = await supabase.from('event_votes').delete().eq('id', existingVote.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('event_votes').insert({ option_id: optionId, user_id: user.id })
                if (error) throw error
            }
            if (id) await fetchVotingData(id)
        } catch (error) {
            console.error('Error voting:', error)
            window.alert(t('events.details.voteError') || 'Virhe äänestettäessä. Yritä uudelleen.')
        } finally {
            setVotingLoading(false)
        }
    }

    const handleLockDate = async (option: EventOption) => {
        if (!isAdmin || !event) return
        const confirmed = window.confirm(t('events.scheduler.lockDate') + '?')
        if (!confirmed) return

        try {
            const { error } = await supabase
                .from('events')
                .update({
                    start_time: option.start_time,
                    end_time: option.end_time,
                    scheduling_status: 'locked'
                })
                .eq('id', event.id)

            if (error) throw error
            await fetchEvent(event.id)
        } catch (error) {
            console.error('Error locking date:', error)
            window.alert(t('events.scheduler.lockError') || 'Virhe päivän lukitsemisessa.')
        }
    }

    const handleRestartVoting = async () => {
        if (!isAdmin || !event) return
        try {
            const { error } = await supabase
                .from('events')
                .update({ scheduling_status: 'voting' })
                .eq('id', event.id)

            if (error) throw error
            await fetchEvent(event.id)
        } catch (error) {
            console.error('Error restarting voting:', error)
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
                    status: 'registered',
                    display_name: joinDisplayName || null
                })

            if (error) throw error
            await fetchEvent(event.id)
        } catch (error: any) {
            window.alert(t('events.details.registerError') + ' ' + error.message)
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
            window.alert(t('events.details.cancelError') + ' ' + error.message)
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

    const copyLink = (tab?: string) => {
        if (!event) return
        // 1. Construct the direct deep link to the app (for the redirect)
        const directUrl = new URL(window.location.pathname, window.location.origin)
        if (tab) directUrl.searchParams.set('tab', tab)
        
        // Add access code for hidden events if not already there
        if (event.event_type === 'hidden' && event.access_code) {
            directUrl.searchParams.set('code', event.access_code)
        }
        
        const redirectParam = encodeURIComponent(directUrl.toString())
 
        // 2. Construct the Sharing Proxy URL (Supabase Edge Function)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        let finalUrl = directUrl.toString()
 
        if (supabaseUrl) {
            finalUrl = `${supabaseUrl}/functions/v1/event-og-share?id=${id}&redirect=${redirectParam}`
            if (tab) finalUrl += `&tab=${tab}`
            if (event.event_type === 'hidden' && event.access_code) {
                finalUrl += `&code=${event.access_code}`
            }
        }
 
        navigator.clipboard.writeText(finalUrl)
        setCopyFeedback(tab || 'header')
        setTimeout(() => setCopyFeedback(null), 2000)
    }

    if (loading) {
        return <div className="text-center py-10">{t('events.details.loading')}</div>
    }

    if (accessDenied) {
        return (
            <div className="text-center py-10">
                <h3 className="text-lg font-medium text-gray-900">{t('events.details.noAccess')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('events.details.inviteOnly')}</p>
                <div className="mt-6">
                    <Link to="/" className="text-indigo-600 hover:text-indigo-500 font-medium">
                        &larr; {t('common.back')}
                    </Link>
                </div>
            </div>
        )
    }

    if (!event) {
        return <div className="text-center py-10">{t('events.details.notFound')}</div>
    }

    if (showCodePrompt) {
        return (
            <div className="max-w-md mx-auto py-12 px-4">
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t('events.details.inputCode')}</h3>
                    <form onSubmit={handleVerifyCode} className="space-y-4">
                        <input
                            type="text"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={accessCodeInput}
                            onChange={(e) => setAccessCodeInput(e.target.value)}
                            placeholder="Access Code"
                            autoFocus
                        />
                        <div className="flex justify-between items-center">
                            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                                {t('common.cancel')}
                            </Link>
                            <button
                                type="submit"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                {t('events.details.verifyCode')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    // Determine locale for dates (default to fi-FI if not set or en-US)
    const dateLocale = i18n.language || 'fi-FI'

    const isCreatorOrAdmin = isAdmin || (user && (user.id === event.creator_id || eventOwners.includes(user.id)))

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
                    {event.scheduling_status && (
                        <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.scheduling_status === 'voting' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                            }`}>
                            {event.scheduling_status === 'voting' ? t('events.scheduler.statusVoting') : t('events.scheduler.statusLocked')}
                        </span>
                    )}
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
                            {isCreatorOrAdmin && (
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
                            <button
                                onClick={() => copyLink()}
                                data-testid="header-share-button"
                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                🔗 {copyFeedback === 'header' ? t('events.details.copied') : t('events.details.share')}
                            </button>
                            {participant ? (
                                <button
                                    onClick={handleCancel}
                                    disabled={registering}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {registering ? t('events.details.leaving') : t('events.details.leave')}
                                </button>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={joinDisplayName}
                                        onChange={(e) => setJoinDisplayName(e.target.value)}
                                        placeholder={t('profile.displayName')}
                                        className="block w-40 sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    />
                                    <button
                                        onClick={handleRegister}
                                        disabled={registering}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        {registering ? t('events.details.joining') : t('events.details.join')}
                                    </button>
                                </div>
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
                                {event.time_type === 'timestamp' || !event.time_type ? (
                                    <>
                                        {new Date(event.start_time).toLocaleString(dateLocale)} - {new Date(event.end_time).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                                    </>
                                ) : event.time_type === 'all_day' ? (
                                    <>
                                        {new Date(event.start_time).toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </>
                                ) : (
                                    <>
                                        {new Date(event.start_time).toLocaleDateString(dateLocale)} - {new Date(event.end_time).toLocaleDateString(dateLocale)}
                                    </>
                                )}
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

                        {event.scheduling_status === 'voting' && options.length > 0 && (
                            <div className="sm:col-span-2 border-t pt-6">
                                <dt className="text-sm font-medium text-gray-500 mb-4">{t('events.scheduler.votingTitle')}</dt>
                                <dd className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {options.map((option) => {
                                        const optionVotes = votes.filter(v => v.option_id === option.id)
                                        const hasVoted = user && optionVotes.some(v => v.user_id === user.id)
                                        return (
                                            <div key={option.id} className="border rounded-lg p-4 flex justify-between items-center bg-gray-50">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {option.time_type === 'timestamp' || !option.time_type 
                                                            ? new Date(option.start_time).toLocaleString(dateLocale)
                                                            : new Date(option.start_time).toLocaleDateString(dateLocale)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {option.time_type === 'timestamp' || !option.time_type
                                                            ? new Date(option.end_time).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
                                                            : option.time_type === 'all_day_multi'
                                                                ? new Date(option.end_time).toLocaleDateString(dateLocale)
                                                                : ''}
                                                    </div>
                                                    <div className="mt-1 text-xs font-medium text-indigo-600">
                                                        {optionVotes.length} {t('events.scheduler.votes')}
                                                        {optionVotes.length > 0 && (
                                                            <div className="text-gray-400 font-normal mt-0.5">
                                                                {optionVotes.map((v) => (user ? (v.participant_display_name || v.profiles?.display_name || v.profiles?.full_name || t('common.anonymous')) : t('common.anonymous'))).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => handleVote(option.id)}
                                                        disabled={votingLoading}
                                                        className={`px-3 py-1 text-xs font-medium rounded-md border ${hasVoted
                                                            ? 'bg-indigo-600 text-white border-transparent'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {hasVoted ? t('events.scheduler.unvote') : t('events.scheduler.vote')}
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleLockDate(option)}
                                                            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                                        >
                                                            {t('events.scheduler.lockDate')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </dd>
                            </div>
                        )}

                        {isAdmin && event.scheduling_status === 'locked' && (
                            <div className="sm:col-span-2">
                                <button
                                    onClick={handleRestartVoting}
                                    className="text-xs text-indigo-600 hover:text-indigo-500 font-medium"
                                >
                                    {t('events.scheduler.restartVoting')}
                                </button>
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
                                <ReactMarkdown remarkPlugins={[remarkBreaks]} rehypePlugins={[rehypeSanitize]}>
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
                                <ReactMarkdown remarkPlugins={[remarkBreaks]} rehypePlugins={[rehypeSanitize]}>
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
