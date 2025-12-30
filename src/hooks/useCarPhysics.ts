import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_SPEED = 850; // km/h
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
    fuel: number; // 0-100 (percentage)
    fuelConsumption: number; // liters per km
    score: number; // based on efficiency
    autocruise: 'off' | 'cruise' | 'turbo';
    rotationOffset: number; // degrees
};

export type CarControls = {
    accelerate: () => void;
    brake: () => void;
    repair: () => void;
    toggleAutocruise: () => void;
    turnLeft: (isTurning: boolean) => void;
    turnRight: (isTurning: boolean) => void;
};

export type DifficultyMode = 'easy' | 'normal' | 'hard';

export function useCarPhysics(difficulty: DifficultyMode = 'normal'): [CarState, CarControls] {
    const [car, setCar] = useState<CarState>({
        speed: 0,
        gear: 1,
        rpm: 0,
        distanceTraveled: 0,
        isBroken: false,
        fuel: difficulty === 'easy' ? 100 : 80,
        fuelConsumption: 0,
        score: 0,
        autocruise: 'off',
        rotationOffset: 0
    });

    const difficultyRef = useRef<DifficultyMode>(difficulty);

    useEffect(() => {
        difficultyRef.current = difficulty;
    }, [difficulty]);

    const controls = useRef<{
        accelerating: boolean;
        braking: boolean;
        turningLeft: boolean;
        turningRight: boolean;
        repairing: boolean;
        shifting: boolean;
        autocruise: 'off' | 'cruise' | 'turbo';
    }>({
        accelerating: false,
        braking: false,
        turningLeft: false,
        turningRight: false,
        repairing: false,
        shifting: false, // rudimentary auto-shift or debounce
        autocruise: 'off',
    });

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') controls.current.accelerating = true;
        if (e.key === 'ArrowDown') controls.current.braking = true;
        if (e.key === 'ArrowLeft') controls.current.turningLeft = true;
        if (e.key === 'ArrowRight') controls.current.turningRight = true;
        if (e.key === 'r' || e.key === 'R') controls.current.repairing = true;
        if (e.key === 'c' || e.key === 'C') {
            if (e.repeat) return;

            let nextMode: 'off' | 'cruise' | 'turbo' = 'off';
            switch (controls.current.autocruise) {
                case 'off':
                    nextMode = 'cruise';
                    break;
                case 'cruise':
                    nextMode = 'turbo';
                    break;
                case 'turbo':
                    nextMode = 'off';
                    break;
            }
            controls.current.autocruise = nextMode;
        }
    }, []);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') controls.current.accelerating = false;
        if (e.key === 'ArrowDown') controls.current.braking = false;
        if (e.key === 'ArrowLeft') controls.current.turningLeft = false;
        if (e.key === 'ArrowRight') controls.current.turningRight = false;
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
                let newRotationOffset = prev.rotationOffset;

                // Steering
                const TURN_SPEED = 180; // degrees per second
                if (controls.current.turningLeft) {
                    newRotationOffset -= TURN_SPEED * dt;
                }
                if (controls.current.turningRight) {
                    newRotationOffset += TURN_SPEED * dt;
                }
                // Normalize to 0-360 - REMOVED to prevent wrap glitches
                // newRotationOffset = (newRotationOffset + 360) % 360;

                // Autocruise Logic
                if (controls.current.autocruise !== 'off') {
                    if (controls.current.braking) {
                        controls.current.autocruise = 'off'; // Disengage on brake
                    } else {
                        const targetSpeed = controls.current.autocruise === 'turbo' ? 666 : 200;
                        if (prev.speed < targetSpeed) {
                            controls.current.accelerating = true;
                        } else {
                            controls.current.accelerating = false;
                        }
                    }
                }

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

                // Fuel consumption: increases with speed and acceleration
                // Optimal speed is ~200 km/h. Too fast or too slow = inefficient
                const speedPenalty = Math.abs(newSpeed - 200) / 200;
                const accelerationPenalty = controls.current.accelerating ? 0.3 : 0;
                let fuelBurn = (0.05 + speedPenalty * 0.1 + accelerationPenalty) * d_km;

                // Easy mode: no fuel consumption
                if (difficultyRef.current === 'easy') {
                    fuelBurn = 0;
                }

                const newFuel = Math.max(0, prev.fuel - fuelBurn);

                // Score: reward efficient driving
                // Points for distance + bonus for optimal speed (180-220 km/h) + fuel efficiency
                const speedBonus = newSpeed >= 180 && newSpeed <= 220 ? 10 : 0;
                const distancePoints = d_km * 2;
                const fuelBonus = difficultyRef.current !== 'easy' ? (100 - fuelBurn) * 0.1 : 0;
                const newScore = prev.score + Math.max(0, distancePoints + speedBonus + fuelBonus);

                return {
                    speed: newSpeed,
                    rotationOffset: newRotationOffset,
                    gear: currentGear,
                    rpm: Math.min(Math.max(rpm, 1000), 8000),
                    distanceTraveled: prev.distanceTraveled + d_km,
                    isBroken: broken,
                    fuel: newFuel,
                    fuelConsumption: fuelBurn / d_km,
                    score: newScore,
                    autocruise: controls.current.autocruise
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
        turnLeft: (isTurning: boolean) => { controls.current.turningLeft = isTurning; },
        turnRight: (isTurning: boolean) => { controls.current.turningRight = isTurning; },
        repair: () => { controls.current.repairing = true; },
        toggleAutocruise: () => {
            const nextMode =
                controls.current.autocruise === 'off' ? 'cruise' :
                    controls.current.autocruise === 'cruise' ? 'turbo' : 'off';
            controls.current.autocruise = nextMode;
        }
    }];
}
