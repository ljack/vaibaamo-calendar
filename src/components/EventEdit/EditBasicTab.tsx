import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SchedulerModeInput from '../SchedulerModeInput'

interface EditBasicTabProps {
    formData: {
        title: string
        description: string
        start_time: string
        end_time: string
        location: string
        max_participants: string
        event_type: 'public' | 'hidden' | 'invite' | null
        access_code: string
        time_type: 'timestamp' | 'all_day' | 'all_day_multi' | null
    }
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    schedulerMode: boolean
    setSchedulerMode: (val: boolean) => void
    proposedDates: { start_time: string; end_time: string }[]
    setProposedDates: (dates: { start_time: string; end_time: string }[]) => void
    eventId?: string
}

export default function EditBasicTab({
    formData,
    handleChange,
    schedulerMode,
    setSchedulerMode,
    proposedDates,
    setProposedDates,
    eventId
}: EditBasicTabProps) {
    const { t } = useTranslation()
    const [copyFeedback, setCopyFeedback] = useState(false)

    const handleCopyLink = () => {
        if (!eventId) return
        const url = new URL(window.location.origin)
        url.pathname = `/events/${eventId}`
        url.searchParams.set('code', formData.access_code)
        navigator.clipboard.writeText(url.toString())
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2000)
    }

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">{t('events.details.title') || 'Otsikko'}</label>
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
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">{t('events.details.description') || 'Kuvaus'}</label>
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
                    value={formData.time_type || 'timestamp'}
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
                <label className="block text-sm font-medium text-gray-700">{t('events.details.location') || 'Sijainti'}</label>
                <input
                    type="text"
                    name="location"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    value={formData.location}
                    onChange={handleChange}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">{t('events.details.maxParticipants') || 'Osallistujamäärä (max)'}</label>
                <input
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
                    value={formData.event_type || 'public'}
                    onChange={handleChange}
                >
                    <option value="public">{t('events.edit.typePublic')}</option>
                    <option value="hidden">{t('events.edit.typeHidden')}</option>
                    <option value="invite">{t('events.edit.typeInvite')}</option>
                </select>
            </div>

            {formData.event_type === 'hidden' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('events.edit.accessCode')}</label>
                        <div className="mt-1 flex gap-2">
                            <input
                                type="text"
                                name="access_code"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={formData.access_code}
                                onChange={handleChange}
                                placeholder="e.g. secret123"
                            />
                            {eventId && (
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    {copyFeedback ? t('events.edit.linkCopied') : t('events.edit.copyLink')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
