import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import SchedulerModeInput from '../components/SchedulerModeInput'
import { generateRandomCode } from '../lib/random'

export default function CreateEvent() {
    const { t } = useTranslation()
    const { user, isAdmin } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)

    const [schedulerMode, setSchedulerMode] = useState(false)
    const [proposedDates, setProposedDates] = useState([{ start_time: '', end_time: '' }])
    interface FormData {
        title: string
        description: string
        start_time: string
        end_time: string
        location: string
        max_participants: string
        event_type: 'public' | 'hidden' | 'invite'
        access_code: string
        time_type: 'timestamp' | 'all_day' | 'all_day_multi'
    }

    const [formData, setFormData] = useState<FormData>({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        max_participants: '',
        event_type: 'public',
        access_code: '',
        time_type: 'timestamp'
    })

    if (!isAdmin) {
        return (
            <div className="text-center py-10">
                <h3 className="text-lg font-medium text-gray-900">Ei oikeuksia</h3>
                <p className="mt-1 text-sm text-gray-500">Vain ylläpitäjät voivat luoda tapahtumia.</p>
            </div>
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log('Form submitted', formData)

        if (!user) {
            console.error('No user found')
            return
        }

        if (formData.event_type === 'hidden' && (!formData.access_code || formData.access_code.length < 4)) {
            window.alert(t('events.edit.accessCodeTooShort') || 'Pääsykoodin on oltava vähintään 4 merkkiä pitkä.')
            return
        }

        setLoading(true)

        try {
            console.log('Sending request to Supabase...')
            const payload = {
                title: formData.title,
                description: formData.description,
                start_time: schedulerMode ? new Date(proposedDates[0].start_time).toISOString() : new Date(formData.start_time).toISOString(),
                end_time: schedulerMode ? new Date(proposedDates[0].end_time).toISOString() : new Date(formData.end_time).toISOString(),
                location: formData.location,
                max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
                creator_id: user.id,
                scheduling_status: schedulerMode ? 'voting' : null,
                event_type: formData.event_type,
                access_code: formData.event_type === 'hidden' ? formData.access_code : null,
                time_type: formData.time_type
            }

            // Normalize times for all-day events
            if (payload.time_type === 'all_day') {
                const date = new Date(formData.start_time)
                payload.start_time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString()
                payload.end_time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
            } else if (payload.time_type === 'all_day_multi') {
                const startDate = new Date(formData.start_time)
                const endDate = new Date(formData.end_time)
                payload.start_time = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0).toISOString()
                payload.end_time = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString()
            }

            const { data, error } = await supabase
                .from('events')
                .insert(payload)
                .select()
                .single()

            if (error) throw error

            if (schedulerMode && data) {
                const options = proposedDates.map((pd: { start_time: string; end_time: string }) => ({
                    event_id: data.id,
                    start_time: pd.start_time ? new Date(pd.start_time).toISOString() : '',
                    end_time: pd.end_time ? new Date(pd.end_time).toISOString() : '',
                    time_type: formData.time_type
                }))

                // Normalize option times
                options.forEach(opt => {
                    if (opt.time_type === 'all_day' && opt.start_time) {
                        const date = new Date(opt.start_time)
                        opt.start_time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString()
                        opt.end_time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
                    } else if (opt.time_type === 'all_day_multi' && opt.start_time && opt.end_time) {
                        const startDate = new Date(opt.start_time)
                        const endDate = new Date(opt.end_time)
                        opt.start_time = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0).toISOString()
                        opt.end_time = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString()
                    }
                })

                const { error: optionsError } = await supabase
                    .from('event_options')
                    .insert(options)

                if (optionsError) throw optionsError
            }

            navigate('/')
        } catch (error) {
            console.error('Error creating event:', error)
            const message = error instanceof Error ? error.message : 'Tuntematon virhe'
            alert('Virhe tapahtuman luonnissa: ' + message)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target

        if (name === 'time_type') {
            const newType = value as 'timestamp' | 'all_day' | 'all_day_multi'
            const normalize = (v: string) => {
                if (!v) return v
                if ((newType === 'all_day' || newType === 'all_day_multi') && v.includes('T')) {
                    return v.split('T')[0]
                }
                if (newType === 'timestamp' && v.length === 10) {
                    return `${v}T12:00`
                }
                return v
            }

            setFormData(prev => {
                const next = { 
                    ...prev, 
                    time_type: newType,
                    start_time: normalize(prev.start_time),
                    end_time: normalize(prev.end_time)
                }
                if (newType === 'all_day_multi' && !next.end_time && next.start_time) {
                    next.end_time = next.start_time
                }
                return next
            })

            setProposedDates(prevDates => prevDates.map(pd => {
                const normStart = normalize(pd.start_time)
                let normEnd = normalize(pd.end_time)
                if (newType === 'all_day_multi' && !normEnd && normStart) {
                    normEnd = normStart
                }
                return {
                    start_time: normStart,
                    end_time: normEnd
                }
            }))
            return
        }

        setFormData((prev) => {
            const next = { ...prev, [name]: value }
            
            // Auto-generate code if switching to hidden and no code exists
            if (name === 'event_type' && value === 'hidden' && !prev.access_code) {
                next.access_code = generateRandomCode(10)
            }
            
            return next as FormData
        })
    }

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-6">Luo uusi tapahtuma</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">Otsikko</label>
                    <input
                        id="title"
                        type="text"
                        name="title"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        value={formData.title}
                        onChange={handleChange}
                    />
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Kuvaus</label>
                    <textarea
                        id="description"
                        name="description"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        value={formData.description}
                        onChange={handleChange}
                    />
                </div>

                <SchedulerModeInput
                    schedulerMode={schedulerMode}
                    setSchedulerMode={setSchedulerMode}
                    proposedDates={proposedDates}
                    setProposedDates={setProposedDates}
                    timeType={formData.time_type}
                />

                <div className="border-t pt-6">
                    <label className="block text-sm font-medium text-gray-700">{t('events.edit.timeType')}</label>
                    <select
                        name="time_type"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        value={formData.time_type}
                        onChange={handleChange}
                    >
                        <option value="timestamp">{t('events.edit.timeTimestamp')}</option>
                        <option value="all_day">{t('events.edit.timeAllDay')}</option>
                        <option value="all_day_multi">{t('events.edit.timeAllDayMulti')}</option>
                    </select>
                </div>

                {!schedulerMode && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                                {formData.time_type === 'timestamp' || !formData.time_type ? 'Alkaa' : t('common.date') + ' (Alkaa)'}
                            </label>
                            <input
                                id="start_time"
                                type={formData.time_type === 'timestamp' ? 'datetime-local' : 'date'}
                                name="start_time"
                                required={!schedulerMode}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={formData.start_time}
                                onChange={handleChange}
                            />
                        </div>

                        {formData.time_type !== 'all_day' && (
                            <div>
                                <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                                    {formData.time_type === 'timestamp' || !formData.time_type ? 'Päättyy' : t('common.date') + ' (Päättyy)'}
                                </label>
                                <input
                                    id="end_time"
                                    type={formData.time_type === 'timestamp' ? 'datetime-local' : 'date'}
                                    name="end_time"
                                    required={!schedulerMode}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                />
                            </div>
                        )}
                    </div>
                )}
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">Sijainti</label>
                    <input
                        id="location"
                        type="text"
                        name="location"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        value={formData.location}
                        onChange={handleChange}
                    />
                </div>

                <div>
                    <label htmlFor="max_participants" className="block text-sm font-medium text-gray-700">Osallistujamäärä (max)</label>
                    <input
                        id="max_participants"
                        type="number"
                        name="max_participants"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        value={formData.max_participants}
                        onChange={handleChange}
                    />
                </div>

                <div className="border-t pt-6">
                    <label className="block text-sm font-medium text-gray-700">{t('events.edit.eventType')}</label>
                    <select
                        name="event_type"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        value={formData.event_type}
                        onChange={handleChange}
                    >
                        <option value="public">{t('events.edit.typePublic')}</option>
                        <option value="hidden">{t('events.edit.typeHidden')}</option>
                        <option value="invite">{t('events.edit.typeInvite')}</option>
                    </select>
                </div>

                {formData.event_type === 'hidden' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('events.edit.accessCode')}</label>
                        <input
                            type="text"
                            name="access_code"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.access_code}
                            onChange={handleChange}
                            placeholder="e.g. secret123"
                        />
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {loading ? 'Luodaan...' : 'Luo tapahtuma'}
                    </button>
                </div>
            </form>
        </div>
    )
}
