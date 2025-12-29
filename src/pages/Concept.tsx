
import { Link } from 'react-router-dom'

// Inline icons to avoid unknown module error
function CalendarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
    )
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
    )
}

function MapIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.159.69.159 1.006 0z" />
        </svg>
    )
}

function ZapIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
    )
}

export default function Concept() {
    return (
        <div className="bg-white">
            {/* Hero Section */}
            <div className="relative isolate px-6 pt-14 lg:px-8">
                <div className="mx-auto max-w-2xl py-12 sm:py-24 lg:py-24">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                            Vaibaamo
                        </h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Vaibaamo on <strong>Vibe-koodaustapahtuma</strong>. Näissä tapahtumissa keskustellaan tekoälystä yleisesti, AI-koodauksesta ja jaetaan osaamista.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6">
                            <Link
                                to="/"
                                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all duration-200"
                            >
                                Selaa tapahtumia
                            </Link>
                            <Link to="/events/new" className="text-sm font-semibold leading-6 text-gray-900">
                                Luo uusi <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Section */}
            <div className="py-24 sm:py-32 bg-gray-50 rounded-3xl mx-4 sm:mx-8 mb-16">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl lg:text-center">
                        <h2 className="text-base font-semibold leading-7 text-indigo-600">Filosofia</h2>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            Mistä on kyse?
                        </p>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Vaibaamo syntyi sanaleikistä: <strong>Vibe</strong> + <strong>Aamo</strong> (kuten sana 'koodaamo' tai 'hautomö').
                        </p>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Se on paikka ("-aamo"), jossa hyvä fiilis ("vibe") ja tekoälykoodaus kohtaavat. Tavoitteena on luoda rento ympäristö oppimiselle ja verkostoitumiselle.
                        </p>
                    </div>
                    <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
                        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
                            <div className="relative pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                                        <CalendarIcon className="h-6 w-6 text-white" />
                                    </div>
                                    Tapahtumat keskiössä
                                </dt>
                                <dd className="mt-2 text-base leading-7 text-gray-600">
                                    Löydä tulevat tapahtumat helposti aikajärjestyksessä. Ei turhaa säätöä, vain olennaiset tiedot: missä, milloin ja ketä on tulossa.
                                </dd>
                            </div>
                            <div className="relative pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                                        <UsersIcon className="h-6 w-6 text-white" />
                                    </div>
                                    Yhteisöllisyys
                                </dt>
                                <dd className="mt-2 text-base leading-7 text-gray-600">
                                    Näe ketkä ovat ilmoittautuneet ja liity mukaan. Vaibaamo tekee osallistumisesta helppoa ja sosiaalista.
                                </dd>
                            </div>
                            <div className="relative pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                                        <MapIcon className="h-6 w-6 text-white" />
                                    </div>
                                    Kartat ja Sijainnit
                                </dt>
                                <dd className="mt-2 text-base leading-7 text-gray-600">
                                    Integroitu karttanäkymä auttaa hahmottamaan, missä tapahtuu. Klikkaa itsesi suoraan perille.
                                </dd>
                            </div>
                            <div className="relative pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                                        <ZapIcon className="h-6 w-6 text-white" />
                                    </div>
                                    Sähköinen ja Nopea
                                </dt>
                                <dd className="mt-2 text-base leading-7 text-gray-600">
                                    Rakennettu modernilla teknologialla (React, Supabase, Vite) nopeaa ja responsiivista käyttökokemusta varten. Ja ehkä sieltä löytyy jotain muutakin... (vinkki: π)
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div >

            {/* Credits Section */}
            < div className="border-t border-gray-200 py-12 px-6" >
                <div className="mx-auto max-w-7xl text-center">
                    <p className="text-sm text-gray-500">
                        &copy; 2025 Vaibaamo Project. Rakennettu rakkaudella ja koodilla.
                    </p>
                </div>
            </div >
        </div >
    )
}
