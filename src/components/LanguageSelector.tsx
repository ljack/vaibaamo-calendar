import { useTranslation } from 'react-i18next';

export const LanguageSelector = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const currentLang = i18n.resolvedLanguage || i18n.language;
    const isFi = currentLang?.startsWith('fi');
    const isEn = currentLang?.startsWith('en');

    return (
        <div className="flex items-center space-x-1 text-sm border-l border-gray-200 pl-4 ml-2">
            <button
                onClick={() => changeLanguage('fi')}
                className={`px-2 py-1 rounded-md transition-all duration-200 ${isFi
                        ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                title="Suomi"
                aria-label="Switch to Finnish"
                aria-current={isFi ? 'true' : undefined}
            >
                FI
            </button>
            <button
                onClick={() => changeLanguage('en')}
                className={`px-2 py-1 rounded-md transition-all duration-200 ${isEn
                        ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                title="English"
                aria-label="Switch to English"
                aria-current={isEn ? 'true' : undefined}
            >
                EN
            </button>
        </div>
    );
};
