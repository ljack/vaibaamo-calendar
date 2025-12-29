
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCarPhysics } from './useCarPhysics'

describe('useCarPhysics', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

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
        // Need to mock requestAnimationFrame for hook testing if running in JSDOM environment
        // but Vitest environment is jsdom.
        // The hook uses requestAnimationFrame loop. We need to let time pass.

        const { result } = renderHook(() => useCarPhysics())
        const [, controls] = result.current

        act(() => {
            controls.accelerate()
        })

        // Advance time for physics loop
        await act(async () => {
            vi.advanceTimersByTime(100) // 100ms
        })

        expect(result.current[0].speed).toBeGreaterThan(0)
    })

    it('brakes when control is triggered', async () => {
        const { result } = renderHook(() => useCarPhysics())
        const [, controls] = result.current

        // First accelerate
        act(() => {
            controls.accelerate()
        })
        await act(async () => {
            vi.advanceTimersByTime(500)
        })

        const speedBeforeBrake = result.current[0].speed
        expect(speedBeforeBrake).toBeGreaterThan(0)

        // Then brake
        act(() => {
            // Need to release accelerator first based on hook logic? 
            // Hook implementation: if (accelerating) ... else if (braking)
            // So we need to stop accelerating to brake
            // But the exposed controls are imperative "start accelerating" functions?
            // Checking impl: 
            // controls.accelerate = () => { controls.current.accelerating = true }
            // So we can't easily "unpress" via exposed controls without keyboard events?
            // Actually the exposed controls are: accelerate, brake, repair.
            // And keyboard listeners toggle the refs.
            // The exposed controls in return tuple set the ref to true.
            // There is NO exposed way to set them to false via the returned controls object!
            // Wait, looking at file:
            // handleKeyUp sets them to false.
            // The returned controls are just convenience for touch/buttons? 
            // Yes: accelerate: () => { controls.current.accelerating = true; }

            // So to test braking efficiently without keyboard events, 
            // we might be limited if we can't "stop" accelerating via the exposed API.
            // But we can simulate keyboard events.
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))
            controls.brake()
        })

        await act(async () => {
            vi.advanceTimersByTime(100)
        })

        expect(result.current[0].speed).toBeLessThan(speedBeforeBrake)
    })

    it('consumes fuel in normal mode', async () => {
        const { result } = renderHook(() => useCarPhysics('normal'))
        const [, controls] = result.current

        act(() => {
            controls.accelerate()
        })

        await act(async () => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current[0].fuel).toBeLessThan(80)
    })

    it('does not consume fuel in easy mode', async () => {
        const { result } = renderHook(() => useCarPhysics('easy'))
        const [, controls] = result.current

        act(() => {
            controls.accelerate()
        })

        await act(async () => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current[0].fuel).toBe(100)
    })

    it('handles keyboard events', async () => {
        const { result } = renderHook(() => useCarPhysics())

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
        })

        await act(async () => {
            vi.advanceTimersByTime(100)
        })

        expect(result.current[0].speed).toBeGreaterThan(0)

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))
        })

        // Coasting (drag)
        const speedPeak = result.current[0].speed
        await act(async () => {
            vi.advanceTimersByTime(100)
        })

        expect(result.current[0].speed).toBeLessThan(speedPeak)
    })

    it('handles breakdown and repair', async () => {
        const { result } = renderHook(() => useCarPhysics())
        const [, controls] = result.current

        // Accelerate to high speed
        act(() => {
            controls.accelerate()
        })
        // Advance time in chunks to ensure rAF loop fires consistently
        for (let i = 0; i < 50; i++) {
            await act(async () => {
                vi.advanceTimersByTime(100)
            })
        }

        expect(result.current[0].speed).toBeGreaterThan(350)

        // Force breakdown
        vi.spyOn(Math, 'random').mockReturnValue(0.999)

        // Tick once
        await act(async () => {
            vi.advanceTimersByTime(20)
        })

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
        await act(async () => {
            vi.advanceTimersByTime(2000)
        })

        expect(result.current[0].speed).toBeLessThan(10)
        // Since speed < 10 and repairing is true, it should fix itself
        await act(async () => {
            vi.advanceTimersByTime(100)
        })
        expect(result.current[0].isBroken).toBe(false)
    })
})
