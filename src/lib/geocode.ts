type GeocodeResult = {
    lat: number
    lon: number
}

const cachePrefix = 'geocode:'

const normalizeLocation = (location: string) => location.trim().toLowerCase()

export const createMapLink = (location: string) => {
    const query = encodeURIComponent(location)
    return `https://www.google.com/maps/search/?api=1&query=${query}`
}

export async function geocodeLocation(
    location: string,
    signal?: AbortSignal
): Promise<GeocodeResult | null> {
    const normalized = normalizeLocation(location)
    if (!normalized) return null

    const cacheKey = `${cachePrefix}${normalized}`
    try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
            const parsed = JSON.parse(cached) as GeocodeResult
            if (typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
                return parsed
            }
        }
    } catch {
        // Ignore cache read errors.
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('q', location)
        url.searchParams.set('format', 'json')
        url.searchParams.set('limit', '1')

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept-Language': 'fi',
            },
            signal,
        })

        if (!response.ok) return null
        const data = (await response.json()) as Array<{ lat: string; lon: string }>
        if (!data?.length) return null

        const lat = Number.parseFloat(data[0].lat)
        const lon = Number.parseFloat(data[0].lon)
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null

        const result = { lat, lon }
        try {
            localStorage.setItem(cacheKey, JSON.stringify(result))
        } catch {
            // Ignore cache write errors.
        }

        return result
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            return null
        }
        return null
    }
}
