import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fi from './locales/fi.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en,
            },
            fi: {
                translation: fi,
            },
        },
        fallbackLng: 'en',
        debug: import.meta.env.DEV, // Enable debug in development
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage', 'cookie'],
            lookupQuerystring: 'lang',
        }
    });

export default i18n;
