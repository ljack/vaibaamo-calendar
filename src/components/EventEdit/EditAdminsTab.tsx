import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { EventOwner, Profile } from '../../types'

interface EditAdminsTabProps {
    owners: EventOwner[]
    addOwner: (userId: string) => Promise<void>
    removeOwner: (ownerId: string) => Promise<void>
}

export default function EditAdminsTab({ owners, addOwner, removeOwner }: EditAdminsTabProps) {
    const { t } = useTranslation()
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Profile[]>([])
    const [searching, setSearching] = useState(false)

    useEffect(() => {
        const searchUsers = async () => {
            if (searchTerm.length < 2) {
                setSearchResults([])
                return
            }

            setSearching(true)
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .or(`display_name.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
                    .limit(5)

                if (error) throw error
                // Filter out users who are already owners
                const filtered = (data || []).filter(
                    (p: Profile) => !owners.some(o => o.user_id === p.id)
                )
                setSearchResults(filtered as Profile[])
            } catch (error) {
                console.error('Error searching users:', error)
            } finally {
                setSearching(false)
            }
        }

        const timer = setTimeout(searchUsers, 500)
        return () => clearTimeout(timer)
    }, [searchTerm, owners])

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">{t('events.edit.adminsTitle') || 'Vastuuhenkilöt'}</h3>
                <p className="text-sm text-gray-500 mb-4">
                    {t('events.edit.adminsDesc') || 'Lisää muita vastuuhenkilöitä, jotka voivat muokata tätä tapahtumaa.'}
                </p>

                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                    {owners.map(owner => (
                        <li key={owner.id} className="flex justify-between items-center py-3 px-4 bg-white">
                            <div className="flex items-center">
                                <span className="font-medium">
                                    {owner.profiles?.display_name || owner.profiles?.full_name || 'Tuntematon'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeOwner(owner.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                                {t('common.remove') || 'Poista'}
                            </button>
                        </li>
                    ))}
                    {owners.length === 0 && (
                        <li className="py-3 px-4 text-gray-500 italic text-sm">
                            {t('events.edit.noAdmins') || 'Ei muita vastuuhenkilöitä.'}
                        </li>
                    )}
                </ul>
            </div>

            <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700">
                    {t('events.edit.addAdmin') || 'Lisää vastuuhenkilö'}
                </label>
                <div className="mt-1 relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('events.edit.searchUsersPlaceholder') || 'Etsi käyttäjänimellä tai nimellä...'}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    
                    {searching && (
                        <div className="absolute right-3 top-2.5">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        </div>
                    )}

                    {searchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {searchResults.map(user => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                        addOwner(user.id)
                                        setSearchTerm('')
                                        setSearchResults([])
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between"
                                >
                                    <span>{user.display_name || user.full_name}</span>
                                    <span className="text-indigo-600 font-medium">{t('common.add') || 'Lisää'}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
