
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Event } from '../types'

export default function EditEvent() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        max_participants: ''
    })

    useEffect(() => {
        if (id) {
            fetchEvent(id)
        }
    }, [id])

    const fetchEvent = async (eventId: string) => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single()

            if (error) throw error

            const event = data as Event

            // Format dates for datetime-local input (YYYY-MM-DDThh:mm)
            const formatForInput = (dateString: string) => {
                const date = new Date(dateString)
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
                return date.toISOString().slice(0, 16)
            }

            setFormData({
                title: event.title,
                description: event.description || '',
                start_time: formatForInput(event.start_time),
                end_time: formatForInput(event.end_time),
                location: event.location || '',
                max_participants: event.max_participants ? event.max_participants.toString() : ''
            })

            // Check permissions (redundant to RLS but good for UX)
            // Ideally we'd check if user.id === event.creator_id or isAdmin here, but let's rely on RLS/AuthContext
        } catch (error) {
            console.error('Error fetching event:', error)
            alert('Virhe tapahtuman haussa')
            navigate('/')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !id) return
        setSaving(true)

        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
                location: formData.location,
                max_participants: formData.max_participants ? parseInt(formData.max_participants) : null
            }

            const { error } = await supabase
                .from('events')
                .update(payload)
                .eq('id', id)

            if (error) throw error
            navigate(`/events/${id}`)
        } catch (error: any) {
            console.error('Error updating event:', error)
            alert('Virhe tallennuksessa: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    if (loading) return <div className="text-center py-10">Ladataan...</div>

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-6">Muokkaa tapahtumaa</h2>

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

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                        <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">Alkaa</label>
                        <input
                            id="start_time"
                            type="datetime-local"
                            name="start_time"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.start_time}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">Päättyy</label>
                        <input
                            id="end_time"
                            type="datetime-local"
                            name="end_time"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.end_time}
                            onChange={handleChange}
                        />
                    </div>
                </div>

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

                <div className="flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/events/${id}`)}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
                    >
                        Peruuta
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {saving ? 'Tallennetaan...' : 'Tallenna muutokset'}
                    </button>
                </div>
            </form>
        </div>
    )
}
