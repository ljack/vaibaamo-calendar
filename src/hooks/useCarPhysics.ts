import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_SPEED = 550; // km/h
const ACCELERATION = 2; // km/h per tick
const BRAKING = 5; // km/h per tick
const DRAG = 0.5; // Natural deceleration
const GEAR_RATIOS = [0, 60, 140, 220, 320, 430, 9999]; // Shift points

export type CarState = {
    speed: number;
    gear: number;
    rpm: number; // 0-8000
    distanceTraveled: number; // km
    isBroken: boolean;
};

export type CarControls = {
    accelerate: () => void;
    brake: () => void;
    repair: () => void;
};

export function useCarPhysics(): [CarState, CarControls] {
    const [car, setCar] = useState<CarState>({
        speed: 0,
        gear: 1,
        rpm: 0,
        distanceTraveled: 0,
        isBroken: false
    });

    const controls = useRef({
        accelerating: false,
        braking: false,
        repairing: false,
        shifting: false, // rudimentary auto-shift or debounce
    });

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') controls.current.accelerating = true;
        if (e.key === 'ArrowDown') controls.current.braking = true;
        if (e.key === 'r' || e.key === 'R') controls.current.repairing = true;
    }, []);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') controls.current.accelerating = false;
        if (e.key === 'ArrowDown') controls.current.braking = false;
        if (e.key === 'r' || e.key === 'R') controls.current.repairing = false;
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    // Physics Loop
    useEffect(() => {
        let lastTime = performance.now();
        let frameId: number;

        const loop = (time: number) => {
            const dt = (time - lastTime) / 1000; // seconds
            lastTime = time;

            setCar((prev) => {
                let newSpeed = prev.speed;

                // Accelerate / Brake
                if (controls.current.accelerating) {
                    newSpeed += ACCELERATION;
                } else if (controls.current.braking) {
                    newSpeed -= BRAKING;
                } else {
                    // Drag
                    newSpeed -= DRAG;
                }

                // Breakdown Logic
                let broken = prev.isBroken;
                if (!broken && newSpeed > 400 && Math.random() > 0.995) {
                    // 0.5% chance per tick at high speed -> ~30% chance per second
                    // Adjust for fun: 0.995 is roughly 1/200 chance. 60 ticks/s -> happens every 3-4s. Too frequent?
                    // Let's make it 0.998 -> 1/500 -> ~8s
                    if (Math.random() > 0.99) broken = true;
                }

                if (broken) {
                    // Engine dead, rapid deceleration
                    newSpeed -= 10;
                    if (controls.current.repairing && newSpeed < 10) {
                        broken = false; // Repair successful if stopped/slow
                    }
                }

                // Clamp
                if (newSpeed < 0) newSpeed = 0;
                if (newSpeed > MAX_SPEED) newSpeed = MAX_SPEED;

                // Gears & RPM (Simulated)
                // Find ideal gear
                let idealGear = 1;
                for (let i = 0; i < GEAR_RATIOS.length; i++) {
                    if (newSpeed > GEAR_RATIOS[i]) {
                        idealGear = i + 1;
                    }
                }

                // Simpified Auto Transmission simulation
                const currentGear = idealGear;

                // RPM calc: Just proportional to speed within gear range
                // This is pure "vibe" calculations, not real physics
                const gearMin = GEAR_RATIOS[currentGear - 2] || 0;
                const gearMax = GEAR_RATIOS[currentGear - 1] || MAX_SPEED;
                const gearRange = gearMax - gearMin;
                const speedInGear = newSpeed - gearMin;
                const rpm = (speedInGear / gearRange) * 7000 + 1000; // 1000 idle, max 8000

                // Distance: Speed (km/h) * time (h)
                // dt is seconds. 
                // Let's keep logic simple: km/h * h = km.
                const d_km = (newSpeed * dt) / 3600;

                return {
                    speed: newSpeed,
                    gear: currentGear,
                    rpm: Math.min(Math.max(rpm, 1000), 8000),
                    distanceTraveled: prev.distanceTraveled + d_km,
                    isBroken: broken
                };
            });

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, []);

    return [car, {
        accelerate: () => { controls.current.accelerating = true; },
        brake: () => { controls.current.braking = true; },
        repair: () => { controls.current.repairing = true; }
    }];
}
