import { describe, it, expect, beforeEach, vi } from 'vitest'
import { geocodeLocation } from './geocode'

const createStorage = () => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => {
            store[key] = value
        },
        clear: () => {
            store = {}
        },
        removeItem: (key: string) => {
            delete store[key]
        },
    }
}

describe('geocodeLocation', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        Object.defineProperty(globalThis, 'localStorage', {
            value: createStorage(),
            configurable: true,
        })
    })

    it('returns cached results when available', async () => {
        localStorage.setItem('geocode:helsinki', JSON.stringify({ lat: 60.17, lon: 24.94 }))

        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        const result = await geocodeLocation('Helsinki')
        expect(result).toEqual({ lat: 60.17, lon: 24.94 })
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('stores results after successful fetch', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [{ lat: '60.2', lon: '24.9' }],
        } as any)

        const result = await geocodeLocation('Espoo')
        expect(result).toEqual({ lat: 60.2, lon: 24.9 })
        expect(fetchSpy).toHaveBeenCalled()
        expect(JSON.parse(localStorage.getItem('geocode:espoo') || '')).toEqual({
            lat: 60.2,
            lon: 24.9,
        })
    })

    it('returns null when no results are found', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [],
        } as any)

        const result = await geocodeLocation('Nowhere')
        expect(result).toBeNull()
    })

    it('returns null for empty locations', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const result = await geocodeLocation('   ')
        expect(result).toBeNull()
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('ignores invalid cached values and fetches', async () => {
        localStorage.setItem('geocode:invalid', JSON.stringify({ lat: 'nope', lon: null }))
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [{ lat: '60.2', lon: '24.9' }],
        } as any)

        const result = await geocodeLocation('invalid')
        expect(result).toEqual({ lat: 60.2, lon: 24.9 })
        expect(fetchSpy).toHaveBeenCalled()
    })

    it('returns null when response is not ok', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            json: async () => [],
        } as any)

        const result = await geocodeLocation('Bad response')
        expect(result).toBeNull()
    })

    it('returns null when coordinates are invalid', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [{ lat: 'NaN', lon: 'NaN' }],
        } as any)

        const result = await geocodeLocation('Invalid coords')
        expect(result).toBeNull()
    })

    it('returns null on abort error', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))

        const result = await geocodeLocation('Abort here')
        expect(result).toBeNull()
    })

    it('returns null on generic fetch errors', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

        const result = await geocodeLocation('Offline')
        expect(result).toBeNull()
    })
})
