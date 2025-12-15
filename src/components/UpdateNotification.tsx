
import { useEffect, useState } from 'react'

export function UpdateNotification() {
    const [hasUpdate, setHasUpdate] = useState(false)
    const [currentVersion, setCurrentVersion] = useState<string | null>(null)

    useEffect(() => {
        // Fetch initial version
        console.log('Initial fetch /version.json')
        fetch('/version.json')
            .then(res => {
                if (!res.ok) throw new Error('Fetch status ' + res.status)
                return res.json()
            })
            .then(data => {
                console.log('Set initial version:', data.version)
                setCurrentVersion(data.version)
            })
            .catch(err => console.error('Initial fetch failed', err))

        // Poll for updates every 60 seconds
        const interval = setInterval(() => {
            checkForUpdate()
        }, 60000)

        // Check on window focus as well
        const handleFocus = () => checkForUpdate()
        window.addEventListener('focus', handleFocus)

        return () => {
            clearInterval(interval)
            window.removeEventListener('focus', handleFocus)
        }
    }, [currentVersion]) // End of useEffect

    const checkForUpdate = async () => {
        if (!currentVersion) return
        console.log('checkForUpdate called, polling')

        try {
            const res = await fetch(`/version.json?t=${Date.now()}`)
            if (!res.ok) return

            const data = await res.json()
            if (data.version && data.version !== currentVersion) {
                setHasUpdate(true)
            }
        } catch (error) {
            console.error('Error checking for updates:', error)
        }
    }

    const handleReload = () => {
        window.location.reload()
    }

    if (!hasUpdate) return null

    return (
        <div data-testid="update-notification">
            <h3>Uusi versio saatavilla!</h3>
            <button onClick={handleReload}>Päivitä nyt</button>
        </div>
    )
}
