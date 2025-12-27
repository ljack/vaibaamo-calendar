import { describe, it, expect, vi } from 'vitest'
import { loadLeaflet } from './leafletLoader'

const mergeOptions = vi.fn()
const iconDefault = function Default() { }
iconDefault.prototype = {}
iconDefault.mergeOptions = mergeOptions

vi.mock('leaflet', () => ({
    Icon: {
        Default: iconDefault,
    },
}))

describe('loadLeaflet', () => {
    it('configures default marker icons', async () => {
        const L = await loadLeaflet()

        expect(mergeOptions).toHaveBeenCalledWith({
            iconRetinaUrl: expect.stringContaining('marker-icon-2x.png'),
            iconUrl: expect.stringContaining('marker-icon.png'),
            shadowUrl: expect.stringContaining('marker-shadow.png'),
        })
        expect(L.Icon.Default).toBe(iconDefault)
    })
})
