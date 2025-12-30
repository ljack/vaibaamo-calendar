
import { useEffect, useRef, useState } from 'react';
import { getDistance, generateNearbyPOI, POI_DEFINITIONS, getPoiImage } from '../../lib/journeyUtils';
import type { PoiType } from '../../lib/journeyUtils';
import { supabase } from '../../lib/supabase';
import { useCarPhysics } from '../../hooks/useCarPhysics';
import type { DifficultyMode } from '../../hooks/useCarPhysics';
import type { CarType, CarManifest } from './types';
import { CAR_CONFIGS, ARRIVAL_MESSAGES } from './types';
import { useJourneyMapInit } from './useJourneyMapInit';

interface UseJourneyMapLogicProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocodedEvents: any[];
    selectedCar: CarType;
    difficulty: DifficultyMode;
    carManifests: Record<string, CarManifest>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFinish: (stats: any) => void;
    demoMode?: boolean;
}

export const useJourneyMapLogic = ({
    geocodedEvents,
    selectedCar,
    difficulty,
    carManifests,
    onFinish,
    demoMode = false
}: UseJourneyMapLogicProps) => {

    const positionRef = useRef<{ lat: number; lon: number } | null>(
        geocodedEvents.length > 0 ? { lat: geocodedEvents[0].lat, lon: geocodedEvents[0].lon } : null
    );

    const {
        mapContainerRef,
        mapInstanceRef,
        carMarkerRef,
        isZoomingRef,
        pathRef,
        isMapReady
    } = useJourneyMapInit({ geocodedEvents, selectedCar, carManifests, positionRef });

    const pathNodeIndexRef = useRef(1);
    const lastPoiCheckRef = useRef(0);
    const spriteFrameRef = useRef((selectedCar === 'red' || selectedCar === 'blue') ? 1 : 0);
    const lastFrameTimeRef = useRef(0);
    const poiQueueRef = useRef<PoiType[]>([]);
    const isArrivingRef = useRef(false);
    const lastMoveTimeRef = useRef(0);

    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [message, setMessage] = useState('');
    const [visualEvent, setVisualEvent] = useState<{ image: string; active: boolean; title?: string } | null>(null);
    const [showIdleWarning, setShowIdleWarning] = useState(false);
    const [idleCountdown, setIdleCountdown] = useState(30);
    const [showAgileMaster, setShowAgileMaster] = useState(false);
    const [bearing, setBearing] = useState(0);
    const lastBearingRef = useRef(0);
    const mapDistanceTraveledRef = useRef(0);
    const [distanceTraveled, setDistanceTraveled] = useState(0);
    const [collectedEvents, setCollectedEvents] = useState<{ type: PoiType; message: string; timestamp: number; location: { lat: number; lon: number } }[]>([]);
    const [carState, controls] = useCarPhysics(difficulty);

    useEffect(() => {
        lastMoveTimeRef.current = Date.now();
    }, []);

    // Helper to get next POI type from a shuffled queue
    const getNextPoiType = (isDemo: boolean): PoiType => {
        if (poiQueueRef.current.length === 0) {
            let newQueue: PoiType[];
            if (isDemo) {
                newQueue = ['PEE_BREAK', 'SHOP_RUN', 'WRONG_TURN', 'MOB_ATTACK'];
            } else {
                newQueue = POI_DEFINITIONS.map(d => d.type);
            }

            for (let i = newQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
            }
            poiQueueRef.current = newQueue;
        }
        return poiQueueRef.current.pop() as PoiType;
    };

    // Check for fuel out
    useEffect(() => {
        if (carState.fuel <= 0) {
            onFinish({
                distance: mapDistanceTraveledRef.current,
                score: carState.score,
                reason: 'OUT_OF_FUEL',
                efficiency: mapDistanceTraveledRef.current > 0 ? (carState.score / mapDistanceTraveledRef.current).toFixed(2) : '0.00',
                routePlaces: geocodedEvents.map(e => e.title || e.location)
            });
        }
    }, [carState.fuel, carState.distanceTraveled, carState.score, onFinish, geocodedEvents]);

    // Game Loop
    useEffect(() => {
        if (!positionRef.current || !mapInstanceRef.current || !pathRef.current.length) return;

        const targetIndex = currentEventIndex + 1;
        if (targetIndex >= geocodedEvents.length) {
            onFinish({
                distance: mapDistanceTraveledRef.current,
                score: carState.score,
                reason: 'COMPLETED',
                fuel: carState.fuel,
                efficiency: mapDistanceTraveledRef.current > 0 ? (carState.score / mapDistanceTraveledRef.current).toFixed(2) : '0.00',
                collectedEvents,
                routePlaces: geocodedEvents.map(e => e.title || e.location)
            });
            return;
        }

        const currentTarget = geocodedEvents[targetIndex];
        const currentPos = positionRef.current;
        if (!currentPos) return;

        const speedKmH = carState.speed;

        // Idle Check
        if (speedKmH > 1 || carState.autocruise !== 'off') {
            lastMoveTimeRef.current = Date.now();
            if (showIdleWarning) setShowIdleWarning(false);
        } else {
            const idleTime = Date.now() - lastMoveTimeRef.current;
            const remaining = Math.max(0, Math.ceil((30000 - idleTime) / 1000));

            if (showIdleWarning && remaining !== idleCountdown) {
                setIdleCountdown(remaining);
            }

            if (idleTime > 30000) {
                controls.toggleAutocruise();
                lastMoveTimeRef.current = Date.now();
                setShowIdleWarning(false);
                setMessage("🔌 Auto-Pilot Engaged");
                setTimeout(() => setMessage(''), 3000);
            } else if (idleTime > 5000 && !showIdleWarning) {
                setShowIdleWarning(true);
            }
        }

        const normalizedOffset = ((carState.rotationOffset % 360) + 360) % 360;
        const isWrongDirection = normalizedOffset > 45 && normalizedOffset < 315;
        if (isWrongDirection !== showAgileMaster) {
            setShowAgileMaster(isWrongDirection);
        }

        if (speedKmH > 0 && pathRef.current.length > 0) {
            let targetNodeIndex = pathNodeIndexRef.current;
            if (targetNodeIndex >= pathRef.current.length) {
                targetNodeIndex = pathRef.current.length - 1;
            }

            const targetNode = pathRef.current[targetNodeIndex];
            const dLat = targetNode.lat - currentPos.lat;
            const dLon = targetNode.lon - currentPos.lon;
            const distToNode = Math.sqrt(dLat * dLat + dLon * dLon);
            const moveDistDegrees = (speedKmH * 0.000005);

            if (pathRef.current.length > 0 && pathNodeIndexRef.current >= pathRef.current.length - 1) {
                if (!isArrivingRef.current) {
                    isArrivingRef.current = true;
                    if (currentEventIndex < geocodedEvents.length - 1) {
                        setCurrentEventIndex(prev => prev + 1);
                    } else {
                        onFinish({
                            distance: mapDistanceTraveledRef.current,
                            score: carState.score,
                            reason: 'COMPLETED',
                            isDemo: demoMode,
                            collectedEvents,
                            fuel: carState.fuel,
                            routePlaces: geocodedEvents.map(e => e.title || e.location)
                        });
                    }
                    setTimeout(() => { isArrivingRef.current = false; }, 2000);
                }
            }

            if (distToNode < moveDistDegrees) {
                const stepDist = getDistance(currentPos, targetNode);
                mapDistanceTraveledRef.current += stepDist;
                positionRef.current = targetNode;
                pathNodeIndexRef.current = Math.min(targetNodeIndex + 1, pathRef.current.length - 1);
            } else {
                const fraction = moveDistDegrees / distToNode;
                const newPos = {
                    lat: currentPos.lat + dLat * fraction,
                    lon: currentPos.lon + dLon * fraction
                };
                const stepDist = getDistance(currentPos, newPos);
                mapDistanceTraveledRef.current += stepDist;
                positionRef.current = newPos;
            }

            const distToWaypoint = getDistance(positionRef.current, { lat: currentTarget.lat, lon: currentTarget.lon });
            if (distToWaypoint < 0.2 && !isArrivingRef.current) {
                isArrivingRef.current = true;
                setMessage(ARRIVAL_MESSAGES[Math.floor(Math.random() * ARRIVAL_MESSAGES.length)]);

                setTimeout(() => {
                    if (currentEventIndex < geocodedEvents.length - 1) {
                        setCurrentEventIndex(prev => prev + 1);
                        setMessage('');
                        isArrivingRef.current = false;
                    } else {
                        onFinish({
                            distance: mapDistanceTraveledRef.current,
                            score: carState.score,
                            reason: 'COMPLETED',
                            isDemo: demoMode,
                            collectedEvents,
                            routePlaces: geocodedEvents.map(e => e.title || e.location)
                        });
                    }
                }, 3000);
            }
        }

        if (Date.now() - lastFrameTimeRef.current > 100) {
            lastFrameTimeRef.current = Date.now();
            if (carState.isBroken) {
                spriteFrameRef.current = (spriteFrameRef.current + 1) % 2;
            } else if (speedKmH > 10) {
                if (selectedCar === 'red' || selectedCar === 'blue') {
                    spriteFrameRef.current = 1;
                } else {
                    spriteFrameRef.current = (spriteFrameRef.current + 1) % 4;
                }
            }
        }

        if (positionRef.current) {
            const nextNode = pathRef.current[pathNodeIndexRef.current] || currentTarget;
            let rotation = 0;
            if (mapInstanceRef.current) {
                const p1 = mapInstanceRef.current.latLngToLayerPoint([currentPos.lat, currentPos.lon]);
                const p2 = mapInstanceRef.current.latLngToLayerPoint([nextNode.lat, nextNode.lon]);
                const dy = p2.y - p1.y;
                const dx = p2.x - p1.x;
                const rads = Math.atan2(dy, dx);
                const degs = rads * (180 / Math.PI);
                rotation = degs + 90 + (carState.rotationOffset || 0);
            }

            const normalizedBearing = Math.round((rotation + 360) % 360);
            if (Math.abs(normalizedBearing - lastBearingRef.current) >= 1) {
                lastBearingRef.current = normalizedBearing;
                setBearing(normalizedBearing);
            }

            setDistanceTraveled(mapDistanceTraveledRef.current);

            if (mapInstanceRef.current && !isZoomingRef.current && carMarkerRef.current) {
                carMarkerRef.current.setLatLng([positionRef.current.lat, positionRef.current.lon]);
                mapInstanceRef.current.panTo([positionRef.current.lat, positionRef.current.lon], { animate: false });
            }

            if (carMarkerRef.current) {
                const iconEl = carMarkerRef.current.getElement();
                if (iconEl) {
                    const inner = iconEl.querySelector('.car-sprite') as HTMLElement;
                    if (inner) {
                        const manifest = carManifests[selectedCar];
                        const isManifestCar = selectedCar === 'red' || selectedCar === 'blue';
                        const carScale = CAR_CONFIGS[selectedCar]?.scale || 0.15;

                        if (isManifestCar && manifest) {
                            const frame = manifest.frames[spriteFrameRef.current];
                            inner.style.backgroundPosition = `-${Math.round(frame.x * carScale)}px -${Math.round(frame.y * carScale)}px`;
                            inner.style.width = `${Math.round(frame.width * carScale)}px`;
                            inner.style.height = `${Math.round(frame.height * carScale)}px`;
                            inner.style.backgroundSize = `${Math.round(manifest.meta.imageWidth * carScale)}px ${Math.round(manifest.meta.imageHeight * carScale)}px`;
                            inner.style.filter = carState.isBroken ? 'grayscale(100%) sepia(100%) hue-rotate(0deg) saturate(500%) brightness(0.6)' : 'none';
                        } else {
                            inner.className = `car-sprite car-${selectedCar} ${carState.isBroken ? 'broken-' : 'frame-'}${spriteFrameRef.current}`;
                        }
                        inner.style.transform = `rotate(${rotation - 10}deg)`;
                    }
                }
            }
        }

        const checkInterval = demoMode ? 5000 : 5000;
        const triggerChance = demoMode ? 0.95 : 0.7;
        const speedThreshold = demoMode ? 10 : 100;

        if (Date.now() - lastPoiCheckRef.current > checkInterval && speedKmH > speedThreshold) {
            lastPoiCheckRef.current = Date.now();
            if (Math.random() < triggerChance) {
                const poiType = getNextPoiType(demoMode);
                const def = POI_DEFINITIONS.find(d => d.type === poiType) || generateNearbyPOI();

                const poi = {
                    message: def.message,
                    type: def.type,
                    location: { lat: positionRef.current?.lat || 0, lon: positionRef.current?.lon || 0 }
                };

                setMessage(`${poi.message}`);

                if (poi.type === 'PEE_BREAK') {
                    controls.emergencyStop();
                } else if (poi.type === 'SHOP_RUN') {
                    controls.emergencyStop();
                    controls.refuel();
                } else if (poi.type === 'WRONG_TURN') {
                    controls.spin(360);
                } else if (poi.type === 'MOB_ATTACK') {
                    controls.emergencyStop();
                }

                setCollectedEvents(prev => [...prev, { type: poi.type, message: poi.message, timestamp: Date.now(), location: poi.location }]);
                setVisualEvent({ image: getPoiImage(poi.type), active: true, title: 'Scanning...' });

                supabase.functions.invoke('generate-journey-story', {
                    body: { events: [poi], mode: 'title' }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }).then(({ data, error }: { data: { title?: string } | null, error: any }) => {
                    if (!error && data?.title) {
                        setVisualEvent(prev => prev ? { ...prev, title: data.title } : null);
                    } else {
                        setVisualEvent(prev => prev ? { ...prev, title: poi.message } : null);
                    }
                });

                setTimeout(() => setVisualEvent(null), 14000);
                setTimeout(() => setMessage(''), 3000);
            }
        }
    }, [carState, geocodedEvents, currentEventIndex, selectedCar, carManifests, onFinish, controls, demoMode, isMapReady, showAgileMaster, showIdleWarning, idleCountdown, mapInstanceRef, pathRef, carMarkerRef, isZoomingRef]);

    return {
        mapContainerRef,
        carState,
        bearing,
        distanceTraveled,
        message,
        visualEvent,
        showIdleWarning,
        idleCountdown,
        collectedEvents,
        controls
    };
};
