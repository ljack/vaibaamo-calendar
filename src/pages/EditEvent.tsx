
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Event, MediaAsset } from '../types'

type Tab = 'basic' | 'plan' | 'recap'

export default function EditEvent() {
    const { id } = useParams<{ id: string }>()
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
        recap_markdown: ''
    })

    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (id) {
            fetchEvent(id)
        }
    }, [id])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const tab = params.get('tab')
        if (tab && (tab === 'basic' || tab === 'plan' || tab === 'recap')) {
            setActiveTab(tab as Tab)
        }
    }, [])

    const fetchEvent = async (eventId: string) => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single()

            if (error) throw error

            const event = data as Event

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
                recap_markdown: event.recap_markdown || ''
            })

            setMediaAssets(event.media_assets || [])
        } catch (error) {
            console.error('Error fetching event:', error)
            console.error('Error fetching event:', error)
            alert(t('events.edit.fetchError'))
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
                max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
                plan_markdown: formData.plan_markdown,
                recap_markdown: formData.recap_markdown,
                media_assets: mediaAssets // Save the JSONB array
            }

            const { error } = await supabase
                .from('events')
                .update(payload)
                .eq('id', id)

            if (error) throw error
            navigate(`/events/${id}`)
        } catch (error: any) {
            console.error('Error updating event:', error)
            console.error('Error updating event:', error)
            alert(t('events.edit.errorSave') + ' ' + error.message)
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

    const uploadFile = async (file: File, section: 'plan' | 'recap') => {
        setUploading(true)
        const fileExt = file.name.split('.').pop()
        // If file doesn't have an extension (e.g. pasted image), default to png
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
        } catch (error: any) {
            console.error('Upload error:', error)
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
        if (activeTab === 'basic') return; // Only allow paste in Plan or Recap tabs

        if (e.clipboardData && e.clipboardData.files.length > 0) {
            const file = e.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
                e.preventDefault();
                await uploadFile(file, activeTab as 'plan' | 'recap');
            }
        }
    }

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        }
    }, [activeTab, id]) // Re-bind when activeTab changes so we know where to upload

    const handleAIEdit = async (assetIndex: number) => {
        const asset = mediaAssets[assetIndex];
        const userPrompt = prompt(t('events.edit.promptTitle'), t('events.edit.promptDefault'));
        if (!userPrompt) return;

        const confirmGen = window.confirm(`Generate new image with prompt: "${userPrompt}"? This might take a moment.`);
        if (!confirmGen) return;

        setUploading(true);
        try {
            // 1. Call AI Generation
            const { data, error } = await supabase.functions.invoke('edit-event-image', {
                body: { prompt: userPrompt + ` (inspired by ${asset.caption})`, image_url: asset.url }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            // 2. Process Base64 to Blob
            const b64 = data.image_b64;
            const byteCharacters = atob(b64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // 3. Upload to Storage
            const fileName = `ai-gen-${Math.random().toString(36).substring(2)}.png`;
            const filePath = `events/${id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('event-media')
                .upload(filePath, blob, { contentType: 'image/png' });

            if (uploadError) throw uploadError;

            // 4. Get URL
            const { data: { publicUrl } } = supabase.storage
                .from('event-media')
                .getPublicUrl(filePath);

            // 5. Add to assets
            const newAsset: MediaAsset = {
                url: publicUrl,
                type: 'image',
                caption: `AI: ${userPrompt}`,
                section: asset.section
            }
            setMediaAssets(prev => [...prev, newAsset]);

            alert("AI Image generated successfully!");

        } catch (e: any) {
            console.error(e);
            alert(t('common.error') + " " + e.message);
        } finally {
            setUploading(false);
        }
    }

    const handleDeleteAsset = async (asset: MediaAsset) => {
        if (!window.confirm(t('events.edit.confirmDeleteAsset'))) return

        // If it's a supabase storage url, try to delete from storage
        // URL format: .../storage/v1/object/public/event-media/events/{id}/{file}
        if (asset.url.includes('/storage/v1/object/public/event-media/')) {
            const path = asset.url.split('/storage/v1/object/public/event-media/')[1]
            if (path) {
                const { error } = await supabase.storage
                    .from('event-media')
                    .remove([path])

                if (error) {
                    console.error('Error deleting file:', error)
                    // We interpret this as a warning but still remove from state so user isn't blocked
                }
            }
        }

        setMediaAssets(prev => prev.filter(a => a !== asset))
    }

    if (loading) return <div className="text-center py-10">{t('common.loading')}</div>

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-6">{t('events.edit.title')}</h2>

            <div className="flex border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('basic')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'basic' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    {t('events.edit.tabBasic')}
                </button>
                <button
                    onClick={() => setActiveTab('plan')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'plan' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    {t('events.edit.tabPlan')}
                </button>
                <button
                    onClick={() => setActiveTab('recap')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'recap' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    {t('events.edit.tabRecap')}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* BASIC INFO TAB */}
                {activeTab === 'basic' && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Otsikko</label>
                            <input
                                type="text"
                                name="title"
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={formData.title}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Kuvaus</label>
                            <textarea
                                name="description"
                                rows={3}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={formData.description}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Alkaa</label>
                                <input
                                    type="datetime-local"
                                    name="start_time"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Päättyy</label>
                                <input
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
                            <label className="block text-sm font-medium text-gray-700">Sijainti</label>
                            <input
                                type="text"
                                name="location"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={formData.location}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Osallistujamäärä (max)</label>
                            <input
                                type="number"
                                name="max_participants"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                value={formData.max_participants}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                )}

                {/* PLAN TAB */}
                {activeTab === 'plan' && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('events.edit.planLabel')}</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-96">
                                <textarea
                                    name="plan_markdown"
                                    className="block w-full h-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono"
                                    value={formData.plan_markdown}
                                    onChange={handleChange}
                                    placeholder={t('events.edit.planPlaceholder')}
                                />
                                <div className="border rounded-md p-4 overflow-auto prose prose-sm bg-gray-50 h-full">
                                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{formData.plan_markdown || `*${t('events.edit.preview')}*`}</ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('events.edit.attachmentsPlan')}</h3>
                            <input
                                type="file"
                                onChange={(e) => handleFileUpload(e, 'plan')}
                                disabled={uploading}
                                className="mb-4"
                            />
                            {uploading && <p className="text-sm text-gray-500">{t('events.edit.uploading')}</p>}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {mediaAssets.filter(m => m.section === 'plan').map((asset, i) => (
                                    <div key={i} className="relative group">
                                        <img src={asset.url} alt={asset.caption} className="h-24 w-full object-cover rounded-md" />
                                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity rounded-md" />
                                        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => handleAIEdit(mediaAssets.indexOf(asset))}
                                                className="bg-purple-600 text-white p-1 px-2 rounded text-xs shadow-sm hover:bg-purple-700"
                                                title={t('events.edit.aiEdit')}
                                            >
                                                ✨
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`![${asset.caption || 'image'}](${asset.url})`);
                                                    alert(t('events.edit.markdownCopied'));
                                                }}
                                                className="bg-gray-800 text-white p-1 px-2 rounded text-xs shadow-sm hover:bg-gray-700"
                                                title={t('events.edit.copyMarkdown')}
                                            >
                                                {t('events.edit.copyMarkdown')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteAsset(asset)}
                                                className="bg-red-600 text-white p-1 px-2 rounded text-xs shadow-sm hover:bg-red-700"
                                                title={t('events.edit.deleteAsset')}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* RECAP TAB */}
                {activeTab === 'recap' && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('events.edit.recapLabel')}</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-96">
                                <textarea
                                    name="recap_markdown"
                                    className="block w-full h-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono"
                                    value={formData.recap_markdown}
                                    onChange={handleChange}
                                    placeholder={t('events.edit.recapPlaceholder')}
                                />
                                <div className="border rounded-md p-4 overflow-auto prose prose-sm bg-gray-50 h-full">
                                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{formData.recap_markdown || `*${t('events.edit.preview')}*`}</ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('events.edit.attachmentsRecap')}</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <input
                                    type="file"
                                    onChange={(e) => handleFileUpload(e, 'recap')}
                                    disabled={uploading}
                                />
                                {uploading && <span className="text-sm text-gray-500">{t('events.edit.uploading')}</span>}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {mediaAssets.filter(m => m.section === 'recap').map((asset, i) => (
                                    <div key={i} className="relative group">
                                        <img src={asset.url} alt={asset.caption} className="h-24 w-full object-cover rounded-md border" />
                                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity rounded-md" />
                                        <div className="text-xs truncate mt-1">{asset.caption}</div>
                                        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => handleAIEdit(mediaAssets.indexOf(asset))}
                                                className="bg-purple-600 text-white p-1 px-2 rounded text-xs shadow-sm hover:bg-purple-700"
                                                title={t('events.edit.aiEdit')}
                                            >
                                                ✨
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`![${asset.caption || 'image'}](${asset.url})`);
                                                    alert(t('events.edit.markdownCopied'));
                                                }}
                                                className="bg-gray-800 text-white p-1 px-2 rounded text-xs shadow-sm hover:bg-gray-700"
                                                title={t('events.edit.copyMarkdown')}
                                            >
                                                {t('events.edit.copyMarkdown')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteAsset(asset)}
                                                className="bg-red-600 text-white p-1 px-2 rounded text-xs shadow-sm hover:bg-red-700"
                                                title={t('events.edit.deleteAsset')}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {mediaAssets.filter(m => m.section === 'recap').length === 0 && (
                                    <p className="text-gray-400 text-sm col-span-4">{t('events.edit.noImages')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-6 border-t">
                    <button
                        type="button"
                        onClick={() => navigate(`/events/${id}`)}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
                    >
                        {t('events.edit.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {saving ? t('events.edit.saving') : t('events.edit.save')}
                    </button>
                </div>
            </form>
        </div>
    )
}
