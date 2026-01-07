import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile as UserProfile } from '../types'

export default function Profile() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    
    const [displayName, setDisplayName] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return
            
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (error) throw error
                
                if (data) {
                    const p = data as unknown as UserProfile
                    setProfile(p)
                    setDisplayName(p.display_name || '')
                    setFirstName(p.first_name || '')
                    setLastName(p.last_name || '')
                }
            } catch (err: unknown) {
                console.error('Error fetching profile:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [user])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setSaving(true)
        setMessage(null)

        try {
            // Check if display_name is already taken by someone else
            if (displayName && displayName !== profile?.display_name) {
                const { data: existing, error: checkError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('display_name', displayName)
                    .neq('id', user.id)
                    .maybeSingle()

                if (checkError) throw checkError
                if (existing) {
                    setMessage({ type: 'error', text: t('profile.handleReserved') })
                    setSaving(false)
                    return
                }
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: displayName,
                    first_name: firstName,
                    last_name: lastName,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)

            if (error) throw error

            setMessage({ type: 'success', text: t('profile.success') })
            setProfile(prev => prev ? { ...prev, display_name: displayName, first_name: firstName, last_name: lastName } : null)
        } catch (err: unknown) {
            console.error('Error updating profile:', err)
            setMessage({ type: 'error', text: t('profile.error') })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6">{t('profile.title')}</h1>
            
            <div className="bg-white shadow rounded-xl p-8 border border-gray-100">
                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('profile.email')}
                        </label>
                        <input
                            type="text"
                            disabled
                            value={user?.email || ''}
                            className="block w-full rounded-lg border-gray-200 bg-gray-50 text-gray-500 sm:text-sm cursor-not-allowed"
                        />
                    </div>

                    <div className="border-t border-gray-50 pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('profile.handle')}
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="e.g. jdoe"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            {t('profile.handleHint')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('profile.firstName')}
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('profile.lastName')}
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg text-sm ${
                            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            {saving ? t('profile.saving') : t('profile.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
