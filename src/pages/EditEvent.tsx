import { useParams } from 'react-router-dom'
import EditBasicTab from '../components/EventEdit/EditBasicTab'
import EditPlanTab from '../components/EventEdit/EditPlanTab'
import EditRecapTab from '../components/EventEdit/EditRecapTab'
import { useEditEvent } from '../hooks/useEditEvent'

export default function EditEvent() {
    const { id } = useParams<{ id: string }>()
    const {
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
        uploading,
        handleChange,
        handleSubmit,
        handleFileUpload,
        handleAIEdit,
        handleDeleteAsset,
        t,
        navigate
    } = useEditEvent(id)

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
                    <EditBasicTab
                        formData={formData}
                        handleChange={handleChange}
                        schedulerMode={schedulerMode}
                        setSchedulerMode={setSchedulerMode}
                        proposedDates={proposedDates}
                        setProposedDates={setProposedDates}
                        eventId={id}
                    />
                )}

                {/* PLAN TAB */}
                {activeTab === 'plan' && (
                    <EditPlanTab
                        plan_markdown={formData.plan_markdown}
                        handleChange={handleChange}
                        mediaAssets={mediaAssets}
                        uploading={uploading}
                        handleFileUpload={handleFileUpload}
                        handleAIEdit={handleAIEdit}
                        handleDeleteAsset={handleDeleteAsset}
                    />
                )}

                {/* RECAP TAB */}
                {activeTab === 'recap' && (
                    <EditRecapTab
                        recap_markdown={formData.recap_markdown}
                        handleChange={handleChange}
                        mediaAssets={mediaAssets}
                        uploading={uploading}
                        handleFileUpload={handleFileUpload}
                        handleAIEdit={handleAIEdit}
                        handleDeleteAsset={handleDeleteAsset}
                    />
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
