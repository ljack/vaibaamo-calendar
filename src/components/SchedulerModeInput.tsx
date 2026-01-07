import { useTranslation } from 'react-i18next'

interface ProposedDate {
    start_time: string
    end_time: string
}

interface SchedulerModeInputProps {
    schedulerMode: boolean
    setSchedulerMode: (val: boolean) => void
    proposedDates: ProposedDate[]
    setProposedDates: (dates: ProposedDate[]) => void
    timeType?: 'timestamp' | 'all_day' | 'all_day_multi' | null
}

export default function SchedulerModeInput({
    schedulerMode,
    setSchedulerMode,
    proposedDates,
    setProposedDates,
    timeType = 'timestamp'
}: SchedulerModeInputProps) {
    const { t } = useTranslation()

    const addProposedDate = () => {
        setProposedDates([...proposedDates, { start_time: '', end_time: '' }])
    }

    const removeProposedDate = (index: number) => {
        setProposedDates(proposedDates.filter((_, i) => i !== index))
    }

    const handleProposedDateChange = (index: number, field: keyof ProposedDate, value: string) => {
        const newDates = [...proposedDates]
        newDates[index] = { ...newDates[index], [field]: value }
        setProposedDates(newDates)
    }

    const inputType = timeType === 'timestamp' ? 'datetime-local' : 'date'

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <input
                    id="schedulerMode"
                    type="checkbox"
                    checked={schedulerMode}
                    onChange={(e) => setSchedulerMode(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="schedulerMode" className="text-sm font-medium text-gray-700">
                    {t('events.scheduler.enable')}
                </label>
            </div>

            {schedulerMode && (
                <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-900">{t('events.scheduler.description')}</h4>
                    {proposedDates.map((date, index) => (
                        <div key={index} className="grid grid-cols-1 gap-4 sm:grid-cols-2 relative pb-4 border-b last:border-b-0 last:pb-0">
                            <div>
                                <label className="block text-xs font-medium text-gray-500">
                                    {timeType === 'timestamp' ? 'Alkaa' : 'Päivä'} {timeType === 'all_day_multi' ? '(alkaa)' : ''}
                                </label>
                                <input
                                    type={inputType}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1 border"
                                    value={date.start_time}
                                    onChange={(e) => handleProposedDateChange(index, 'start_time', e.target.value)}
                                />
                            </div>
                            {timeType !== 'all_day' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500">
                                        {timeType === 'timestamp' ? 'Päättyy' : 'Päivä (loppuu)'}
                                    </label>
                                    <input
                                        type={inputType}
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1 border"
                                        value={date.end_time}
                                        onChange={(e) => handleProposedDateChange(index, 'end_time', e.target.value)}
                                    />
                                </div>
                            )}
                            {proposedDates.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeProposedDate(index)}
                                    className="absolute -right-2 -top-2 text-red-500 hover:text-red-700"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addProposedDate}
                        className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                        {t('events.scheduler.addDate')}
                    </button>
                </div>
            )}
        </div>
    )
}
