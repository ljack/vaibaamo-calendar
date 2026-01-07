import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import type { MediaAsset } from '../../types'

interface EditPlanTabProps {
    plan_markdown: string
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    mediaAssets: MediaAsset[]
    uploading: boolean
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, section: 'plan' | 'recap') => void
    handleAIEdit: (index: number) => void
    handleDeleteAsset: (asset: MediaAsset) => void
}

export default function EditPlanTab({
    plan_markdown,
    handleChange,
    mediaAssets,
    uploading,
    handleFileUpload,
    handleAIEdit,
    handleDeleteAsset
}: EditPlanTabProps) {
    const { t } = useTranslation()

    const planAssets = mediaAssets.filter(m => m.section === 'plan')

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('events.edit.planLabel')}</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-96">
                    <textarea
                        name="plan_markdown"
                        className="block w-full h-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono"
                        value={plan_markdown}
                        onChange={handleChange}
                        placeholder={t('events.edit.planPlaceholder')}
                    />
                    <div className="border rounded-md p-4 overflow-auto prose prose-sm bg-gray-50 h-full">
                        <ReactMarkdown remarkPlugins={[remarkBreaks]} rehypePlugins={[rehypeSanitize]}>
                            {plan_markdown || `*${t('events.edit.preview')}*`}
                        </ReactMarkdown>
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
                    {planAssets.map((asset) => (
                        <div key={asset.url} className="relative group">
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
    )
}
