import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Event, MediaAsset, EventOwner } from '../types'
import { generateRandomCode } from '../lib/random'

type Tab = 'basic' | 'plan' | 'recap' | 'admins'

export function useEditEvent(id: string | undefined) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>('basic')

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        max_participants: '',
        plan_markdown: '',
        recap_markdown: '',
        scheduling_status: undefined as 'voting' | 'locked' | undefined | null,
        event_type: 'public' as 'public' | 'hidden' | 'invite' | null,
        access_code: '',
        time_type: 'timestamp' as 'timestamp' | 'all_day' | 'all_day_multi' | null
    })

    const [schedulerMode, setSchedulerMode] = useState(false)
    const [proposedDates, setProposedDates] = useState<{ start_time: string; end_time: string }[]>([
        { start_time: '', end_time: '' }
    ])

    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
    const [uploading, setUploading] = useState(false)
    const [owners, setOwners] = useState<EventOwner[]>([])

    const fetchOwners = async (eventId: string) => {
        const { data, error } = await supabase
            .from('event_owners')
            .select('*, profiles(full_name, display_name, avatar_url)')
            .eq('event_id', eventId)
        
        if (error) {
            console.error('Error fetching owners:', error)
            return
        }
        setOwners(data as unknown as EventOwner[])
    }

    const fetchEvent = async (eventId: string) => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single()

            if (error) throw error

            const event = data as Event

            // Fetch proposed dates if scheduler mode
            const { data: optionsData } = await supabase
                .from('event_options')
                .select('*')
                .eq('event_id', eventId)
                .order('start_time', { ascending: true })

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
                max_participants: event.max_participants ? event.max_participants.toString() : '',
                plan_markdown: event.plan_markdown || '',
                recap_markdown: event.recap_markdown || '',
                scheduling_status: event.scheduling_status,
                event_type: event.event_type || 'public',
                access_code: event.access_code || '',
                time_type: event.time_type || 'timestamp'
            })

            if (optionsData && optionsData.length > 0) {
                setSchedulerMode(true)
                setProposedDates(optionsData.map(o => ({
                    start_time: formatForInput(o.start_time),
                    end_time: formatForInput(o.end_time)
                })))
            } else if (event.scheduling_status === 'voting') {
                setSchedulerMode(true)
            }

            setMediaAssets(event.media_assets || [])
            await fetchOwners(eventId)
        } catch (error) {
            console.error('Error fetching event:', error)
            alert(t('events.edit.fetchError'))
            navigate('/')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (id) {
            fetchEvent(id)
        }
    }, [id])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const tab = params.get('tab')
        if (tab && (tab === 'basic' || tab === 'plan' || tab === 'recap' || tab === 'admins')) {
            setActiveTab(tab as Tab)
        }
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => {
            const next = { ...prev, [name]: value }
            
            // Auto-generate code if switching to hidden and no code exists
            if (name === 'event_type' && value === 'hidden' && !prev.access_code) {
                next.access_code = generateRandomCode(10)
            }
            
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !id) return
        setSaving(true)

        try {
            const firstDate = proposedDates[0]
            const payload = {
                title: formData.title,
                description: formData.description,
                start_time: schedulerMode && firstDate?.start_time ? new Date(firstDate.start_time).toISOString() : new Date(formData.start_time).toISOString(),
                end_time: schedulerMode && firstDate?.end_time ? new Date(firstDate.end_time).toISOString() : new Date(formData.end_time).toISOString(),
                location: formData.location,
                max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
                plan_markdown: formData.plan_markdown,
                recap_markdown: formData.recap_markdown,
                media_assets: mediaAssets,
                scheduling_status: schedulerMode ? (formData.scheduling_status || 'voting') : null,
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

            const { error } = await supabase
                .from('events')
                .update(payload)
                .eq('id', id)

            if (error) throw error

            if (schedulerMode) {
                // Fetch existing options to see what we can keep
                const { data: existingOptions, error: fetchOptionsError } = await supabase
                    .from('event_options')
                    .select('*')
                    .eq('event_id', id)
                
                if (fetchOptionsError) throw fetchOptionsError

                const newOptions = proposedDates.filter(pd => pd.start_time && pd.end_time).map(pd => {
                    const opt = {
                        event_id: id,
                        start_time: pd.start_time ? new Date(pd.start_time).toISOString() : '',
                        end_time: pd.end_time ? new Date(pd.end_time).toISOString() : '',
                        time_type: formData.time_type
                    }

                    // Normalize option times
                    if (opt.time_type === 'all_day' && opt.start_time) {
                        const date = new Date(opt.start_time)
                        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
                        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
                        opt.start_time = start.toISOString()
                        opt.end_time = end.toISOString()
                    } else if (opt.time_type === 'all_day_multi' && opt.start_time && opt.end_time) {
                        const startDate = new Date(opt.start_time)
                        const endDate = new Date(opt.end_time)
                        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0)
                        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59)
                        opt.start_time = start.toISOString()
                        opt.end_time = end.toISOString()
                    }
                    return opt
                })

                // Find options to delete (present in DB but not in our new list)
                const toDelete = (existingOptions || []).filter(eo => 
                    !newOptions.some(no => 
                        no.start_time === eo.start_time && 
                        no.end_time === eo.end_time
                    )
                )

                // Find options to insert (in our new list but not in DB)
                const toInsert = newOptions.filter(no => 
                    !(existingOptions || []).some(eo => 
                        eo.start_time === no.start_time && 
                        eo.end_time === no.end_time
                    )
                )

                if (toDelete.length > 0) {
                    const { error: deleteError } = await supabase
                        .from('event_options')
                        .delete()
                        .in('id', toDelete.map(o => o.id))
                    if (deleteError) throw deleteError
                }

                if (toInsert.length > 0) {
                    const { error: insertError } = await supabase
                        .from('event_options')
                        .insert(toInsert)
                    if (insertError) throw insertError
                }
            } else {
                await supabase.from('event_options').delete().eq('event_id', id)
            }

            navigate(`/events/${id}`)
        } catch (error) {
            console.error('Error updating event:', error)
            const message = error instanceof Error ? error.message : t('common.unknownError')
            alert(t('events.edit.errorSave') + ' ' + message)
        } finally {
            setSaving(false)
        }
    }

    const uploadFile = async (file: File, section: 'plan' | 'recap') => {
        if (!id) return
        setUploading(true)
        const fileExt = file.name.split('.').pop()
        const ext = fileExt || 'png'
        const fileName = `${Math.random().toString(36).substring(2)}.${ext}`
        const filePath = `events/${id}/${fileName}`

        try {
            const { error: uploadError } = await supabase.storage
                .from('event-media')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('event-media')
                .getPublicUrl(filePath)

            const newAsset: MediaAsset = {
                url: publicUrl,
                type: file.type.startsWith('video') ? 'video' : 'image',
                caption: file.name || 'Pasted Image',
                section
            }

            setMediaAssets(prev => [...prev, newAsset])
        } catch (error) {
            console.error('Upload error:', error)
            alert(t('events.edit.uploadError'))
        } finally {
            setUploading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, section: 'plan' | 'recap') => {
        if (!e.target.files || e.target.files.length === 0) return
        await uploadFile(e.target.files[0], section)
    }

    const handlePaste = async (e: ClipboardEvent) => {
        if (activeTab === 'basic') return

        if (e.clipboardData && e.clipboardData.files.length > 0) {
            const file = e.clipboardData.files[0]
            if (file.type.startsWith('image/')) {
                e.preventDefault()
                await uploadFile(file, activeTab as 'plan' | 'recap')
            }
        }
    }

    useEffect(() => {
        window.addEventListener('paste', handlePaste)
        return () => {
            window.removeEventListener('paste', handlePaste)
        }
    }, [activeTab, id])

    const handleAIEdit = async (assetIndex: number) => {
        const asset = mediaAssets[assetIndex]
        const userPrompt = prompt(t('events.edit.promptTitle'), t('events.edit.promptDefault'))
        if (!userPrompt) return

        const confirmGen = window.confirm(t('events.edit.confirmAI', { prompt: userPrompt }))
        if (!confirmGen) return

        setUploading(true)
        try {
            const { data, error } = await supabase.functions.invoke('edit-event-image', {
                body: { prompt: userPrompt + ` (inspired by ${asset.caption})`, image_url: asset.url }
            })

            if (error) throw error
            if (data.error) throw new Error(data.error)

            const b64 = data.image_b64
            const byteCharacters = atob(b64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'image/png' })

            const fileName = `ai-gen-${Math.random().toString(36).substring(2)}.png`
            const filePath = `events/${id}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('event-media')
                .upload(filePath, blob, { contentType: 'image/png' })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('event-media')
                .getPublicUrl(filePath)

            const newAsset: MediaAsset = {
                url: publicUrl,
                type: 'image',
                caption: `AI: ${userPrompt}`,
                section: asset.section
            }
            setMediaAssets(prev => [...prev, newAsset])
            alert("AI Image generated successfully!")

        } catch (e) {
            console.error(e)
            const message = e instanceof Error ? e.message : t('common.unknownError')
            alert(t('common.error') + " " + message)
        } finally {
            setUploading(false)
        }
    }

    const handleDeleteAsset = async (asset: MediaAsset) => {
        if (!window.confirm(t('events.edit.confirmDeleteAsset'))) return

        if (asset.url.includes('/storage/v1/object/public/event-media/')) {
            const path = asset.url.split('/storage/v1/object/public/event-media/')[1]
            if (path) {
                const { error } = await supabase.storage
                    .from('event-media')
                    .remove([path])

                if (error) {
                    console.error('Error deleting file:', error)
                }
            }
        }

        setMediaAssets(prev => prev.filter(a => a !== asset))
    }

    const addOwner = async (userId: string) => {
        if (!id) return
        const { error } = await supabase
            .from('event_owners')
            .insert({ event_id: id, user_id: userId })
        
        if (error) {
            console.error('Error adding owner:', error)
            alert(t('events.edit.errorAddOwner') || 'Virhe lisättäessä vastuuhenkilöä.')
            return
        }
        await fetchOwners(id)
    }

    const removeOwner = async (ownerId: string) => {
        if (!window.confirm(t('events.edit.confirmRemoveOwner') || 'Haluatko varmasti poistaa tämän vastuuhenkilön?')) return
        
        const { error } = await supabase
            .from('event_owners')
            .delete()
            .eq('id', ownerId)
        
        if (error) {
            console.error('Error removing owner:', error)
            alert(t('events.edit.errorRemoveOwner') || 'Virhe poistettaessa vastuuhenkilöä.')
            return
        }
        if (id) await fetchOwners(id)
    }

    return {
        id,
        loading,
        saving,
        activeTab,
        setActiveTab,
        formData,
        schedulerMode,
        setSchedulerMode,
        proposedDates,
        setProposedDates,
        mediaAssets,
        owners,
        uploading,
        handleChange,
        handleSubmit,
        handleFileUpload,
        handleAIEdit,
        handleDeleteAsset,
        addOwner,
        removeOwner,
        t,
        navigate
    }
}
