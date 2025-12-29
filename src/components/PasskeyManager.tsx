import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { passkeyService } from '../lib/passkeyService';
import { getPasskeys } from '../lib/supakeys';

type PasskeyItem = {
    id: string;
    name: string;
    created_at: string;
    last_used_at?: string;
    type: 'legacy' | 'supakeys';
};

interface PasskeyManagerProps {
    onClose: () => void;
}

export const PasskeyManager: React.FC<PasskeyManagerProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPasskeys = async () => {
        setLoading(true);
        setError(null);
        try {
            const items: PasskeyItem[] = [];

            // Fetch Legacy Passkeys
            try {
                const legacyList = await passkeyService.list();
                if (legacyList) {
                    legacyList.forEach((pk: any) => {
                        items.push({
                            id: pk.id,
                            name: pk.credential_id ? `Credential ...${pk.credential_id.slice(-6)}` : 'Standard Passkey',
                            created_at: pk.created_at,
                            last_used_at: pk.last_used_at,
                            type: 'legacy'
                        });
                    });
                }
            } catch (e) {
                console.error("Failed to fetch legacy passkeys", e);
            }

            // Fetch Supakeys
            try {
                const supakeysClient = getPasskeys();
                const { passkeys: supakeysList, error: supakeysError } = await supakeysClient.listPasskeys();
                if (supakeysError) throw new Error(supakeysError.message);

                if (supakeysList) {
                    supakeysList.forEach((pk: any) => {
                        items.push({
                            id: pk.credentialId, // user credentialId for deletion
                            name: pk.authenticatorName || 'Supakeys Passkey',
                            created_at: pk.createdAt,
                            last_used_at: pk.lastUsedAt,
                            type: 'supakeys'
                        });
                    });
                }
            } catch (e) {
                console.error("Failed to fetch supakeys", e);
            }

            // Sort by created date desc
            items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setPasskeys(items);

        } catch (e: any) {
            setError(e.message || "Failed to load passkeys");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPasskeys();
    }, []);

    const handleDelete = async (item: PasskeyItem) => {
        if (!confirm(t('common.confirmDelete', 'Are you sure you want to delete this passkey?'))) return;

        try {
            if (item.type === 'legacy') {
                await passkeyService.remove(item.id);
            } else {
                const supakeysClient = getPasskeys();
                await supakeysClient.removePasskey({ credentialId: item.id });
            }
            // Refresh list
            await fetchPasskeys();
        } catch (e: any) {
            alert(t('common.errorDelete', 'Failed to delete passkey') + ': ' + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-cal text-gray-900">Manage Passkeys</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">{error}</div>
                    ) : passkeys.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No passkeys found.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {passkeys.map((pk) => (
                                <div key={pk.id + pk.type} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div>
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            {pk.name}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${pk.type === 'supakeys' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {pk.type === 'supakeys' ? 'Supakeys' : 'Standard'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Added: {new Date(pk.created_at).toLocaleDateString()}
                                        </div>
                                        {pk.last_used_at && (
                                            <div className="text-xs text-gray-400">
                                                Last used: {new Date(pk.last_used_at).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(pk)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
