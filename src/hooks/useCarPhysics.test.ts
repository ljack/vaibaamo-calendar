
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCarPhysics } from './useCarPhysics'

describe('useCarPhysics', () => {
    let originalRAF: typeof requestAnimationFrame
    let originalCAF: typeof cancelAnimationFrame
    let rafCallbacks: Map<number, FrameRequestCallback>
    let nextRafId: number
    let now: number

    beforeEach(() => {
        vi.useFakeTimers()

        // Manual rAF mock for deterministic physics testing
        rafCallbacks = new Map()
        nextRafId = 1
        now = 0

        originalRAF = window.requestAnimationFrame
        originalCAF = window.cancelAnimationFrame

        window.requestAnimationFrame = (callback) => {
            const id = nextRafId++
            rafCallbacks.set(id, callback)
            return id
        }

        window.cancelAnimationFrame = (id) => {
            rafCallbacks.delete(id)
        }

        // Mock performance.now to follow our manual time
        vi.spyOn(performance, 'now').mockImplementation(() => now)
    })

    afterEach(() => {
        window.requestAnimationFrame = originalRAF
        window.cancelAnimationFrame = originalCAF
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    const advanceTime = async (ms: number) => {
        // Advance time in steps (e.g. 16ms for ~60fps)
        const step = 16
        let remaining = ms

        while (remaining > 0) {
            const currentStep = Math.min(remaining, step)
            now += currentStep
            remaining -= currentStep

            // Execute all pending callbacks
            const callbacks = new Map(rafCallbacks)
            rafCallbacks.clear()

            for (const cb of callbacks.values()) {
                cb(now)
            }

            // Allow state updates to propagate
            await act(async () => {
                vi.advanceTimersByTime(currentStep)
            })
        }
    }

    it('initializes with default state', () => {
        const { result } = renderHook(() => useCarPhysics())

        expect(result.current[0]).toEqual(expect.objectContaining({
            speed: 0,
            gear: 1,
            distanceTraveled: 0,
            fuel: 80, // Normal mode default
            isBroken: false
        }))
    })

    it('initializes with easy difficulty', () => {
        const { result } = renderHook(() => useCarPhysics('easy'))
        expect(result.current[0].fuel).toBe(100)
    })

    it('accelerates when control is triggered', async () => {
        const { result } = renderHook(() => useCarPhysics())
        const [, controls] = result.current

        act(() => {
            controls.accelerate()
        })

        await advanceTime(100)

        expect(result.current[0].speed).toBeGreaterThan(0)
    })

    it('brakes when control is triggered', async () => {
        const { result } = renderHook(() => useCarPhysics())
        const [, controls] = result.current

        // First accelerate
        act(() => {
            controls.accelerate()
        })
        await advanceTime(500)

        const speedBeforeBrake = result.current[0].speed
        expect(speedBeforeBrake).toBeGreaterThan(0)

        // Then brake
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))
            controls.brake()
        })

        await advanceTime(100)

        expect(result.current[0].speed).toBeLessThan(speedBeforeBrake)
    })

    it('consumes fuel in normal mode', async () => {
        const { result } = renderHook(() => useCarPhysics('normal'))
        const [, controls] = result.current

        act(() => {
            controls.accelerate()
        })

        await advanceTime(1000)

        expect(result.current[0].fuel).toBeLessThan(80)
    })

    it('does not consume fuel in easy mode', async () => {
        const { result } = renderHook(() => useCarPhysics('easy'))
        const [, controls] = result.current

        act(() => {
            controls.accelerate()
        })

        await advanceTime(1000)

        expect(result.current[0].fuel).toBe(100)
    })

    it('handles keyboard events', async () => {
        const { result } = renderHook(() => useCarPhysics())

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
        })

        await advanceTime(100)

        expect(result.current[0].speed).toBeGreaterThan(0)

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))
        })

        // Coasting (drag)
        const speedPeak = result.current[0].speed
        await advanceTime(100)

        expect(result.current[0].speed).toBeLessThan(speedPeak)
    })

    it('handles breakdown and repair', async () => {
        const { result } = renderHook(() => useCarPhysics())
        const [, controls] = result.current

        // Accelerate to high speed
        act(() => {
            controls.accelerate()
        })

        await advanceTime(5000)

        expect(result.current[0].speed).toBeGreaterThan(350)

        // Force breakdown
        vi.spyOn(Math, 'random').mockReturnValue(0.999)

        // Tick once
        await advanceTime(20)

        expect(result.current[0].isBroken).toBe(true)
        vi.spyOn(Math, 'random').mockRestore()

        // Test repair logic
        act(() => {
            // Stop accelerating
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))
            // Start repairing
            controls.repair()
        })

        // Wait for speed to drop
        await advanceTime(2000)

        expect(result.current[0].speed).toBeLessThan(10)
        // Since speed < 10 and repairing is true, it should fix itself
        await advanceTime(100)
        expect(result.current[0].isBroken).toBe(false)
    })
})
