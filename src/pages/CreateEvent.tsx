import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function CreateEvent() {
    const { user, isAdmin } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        max_participants: ''
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

        setLoading(true)

        try {
            console.log('Sending request to Supabase...')
            const payload = {
                title: formData.title,
                description: formData.description,
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
                location: formData.location,
                max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
                creator_id: user.id
            }
            console.log('Payload:', payload)

            const { data, error } = await supabase
                .from('events')
                .insert(payload)
                .select()

            console.log('Supabase response:', { data, error })

            if (error) throw error

            console.log('Event created successfully, navigating...')
            navigate('/')
        } catch (error: any) {
            console.error('Error creating event:', error)
            alert('Virhe tapahtuman luonnissa: ' + (error.message || 'Tuntematon virhe'))
        } finally {
            console.log('Setting loading to false')
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
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
