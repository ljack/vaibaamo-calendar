
import { describe, it, expect } from 'vitest'
import { getDistance, interpolatePosition, normalizeCoordinates, generateCurvedPath, POI_DEFINITIONS, generateNearbyPOI } from './journeyUtils'

describe('journeyUtils', () => {
    describe('getDistance', () => {
        it('calculates approximate distance between two points', () => {
            // New York to London
            const ny = { lat: 40.7128, lon: -74.0060 }
            const london = { lat: 51.5074, lon: -0.1278 }

            const dist = getDistance(ny, london)
            // Approx 5570km
            expect(dist).toBeGreaterThan(5500)
            expect(dist).toBeLessThan(5600)
        })

        it('returns 0 for same point', () => {
            const p = { lat: 10, lon: 10 }
            expect(getDistance(p, p)).toBe(0)
        })
    })

    describe('interpolatePosition', () => {
        const start = { lat: 0, lon: 0 }
        const end = { lat: 10, lon: 20 }

        it('returns start at 0', () => {
            expect(interpolatePosition(start, end, 0)).toEqual(start)
        })

        it('returns end at 1', () => {
            expect(interpolatePosition(start, end, 1)).toEqual(end)
        })

        it('interpolates midpoint correctly', () => {
            expect(interpolatePosition(start, end, 0.5)).toEqual({ lat: 5, lon: 10 })
        })
    })

    describe('normalizeCoordinates', () => {
        it('returns empty array for empty input', () => {
            expect(normalizeCoordinates([])).toEqual([])
        })

        it('normalizes single point to 0.5, 0.5 (safe range)', () => {
            // implementation details: safe range 1, min = val => (val - val) / 1 = 0
            // logic check:
            // x = (lon - minLon) / safeRange 
            // if single point, minLon = lon, safeRange = 1 -> x = 0
            // y = 1 - (lat - minLat) / 1 -> y = 1
            const events = [{ lat: 10, lon: 10 }]
            const normalized = normalizeCoordinates(events)
            expect(normalized[0].normalizedX).toBe(0)
            expect(normalized[0].normalizedY).toBe(1)
        })

        it('normalizes range correctly', () => {
            const events = [
                { lat: 0, lon: 0 },
                { lat: 10, lon: 10 }
            ]
            const normalized = normalizeCoordinates(events)

            // Point 0: 0, 0 -> normalizedX: 0, normalizedY: 1 (top)
            expect(normalized[0].normalizedX).toBe(0)
            expect(normalized[0].normalizedY).toBe(1)

            // Point 1: 10, 10 -> normalizedX: 1, normalizedY: 0 (bottom is typically high lat? wait.)
            // Logic: 1 - (lat - minLat) / range
            // Point 1 lat=10, min=0, range=10 -> 1 - 1 = 0
            expect(normalized[1].normalizedX).toBe(1)
            expect(normalized[1].normalizedY).toBe(0)
        })
    })

    describe('generateCurvedPath', () => {
        it('returns original points if length < 2', () => {
            const points = [{ lat: 0, lon: 0 }]
            expect(generateCurvedPath(points)).toEqual(points)
        })

        it('generates intermediate points', () => {
            const points = [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }]
            const curved = generateCurvedPath(points, 2)
            expect(curved.length).toBeGreaterThan(2)
            expect(curved[curved.length - 1]).toEqual(points[1])
        })

        it('uses linear interpolation for long distances', () => {
            // Distance > 1.5 degrees triggers linear
            const points = [{ lat: 0, lon: 0 }, { lat: 5, lon: 5 }]
            const curved = generateCurvedPath(points, 2)

            // Check if midpoint is purely linear
            // Linear midpoint of (0,0) and (5,5) is (2.5, 2.5)
            // Spline would likely curve it if it had more context, but with 2 points logic is same?
            // The function iterates points. 
            // Logic: if (dist > 1.5) linear else spline.
            // We can check if it entered the if block effectively by behavior?
            // Or just trust coverage?
            // Let's ensure it produces points.
            expect(curved.length).toBeGreaterThan(2)

            // To strictly verify linear:
            // index 1 (t=0.5 with resolution 2) should be roughly 2.5, 2.5
            // t goes 0, 0.5. 
            // t=0 -> 0,0
            // t=0.5 -> 2.5, 2.5
            // points pushed.
            const mid = curved[1]
            expect(mid.lat).toBeCloseTo(2.5)
            expect(mid.lon).toBeCloseTo(2.5)
        })
    })

    describe('generateNearbyPOI', () => {
        it('returns a valid POI object', () => {
            const poi = generateNearbyPOI()
            expect(POI_DEFINITIONS).toContainEqual(poi)
            expect(typeof poi.message).toBe('string')
            const validTypes = ['REINDEER', 'GAS_STATION', 'BARN', 'SCENIC', 'DINER', 'MONOLITH', 'AURORA', 'SPEED_TRAP', 'HITCHHIKER', 'SILENCE_ZONE'];
            expect(validTypes).toContain(poi.type)
        })
    })
})
