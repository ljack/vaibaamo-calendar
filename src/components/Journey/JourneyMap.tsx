
import React, { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { loadLeaflet } from '../../lib/leafletLoader';
import { generateCurvedPath, getDistance, generateNearbyPOI, POI_DEFINITIONS } from '../../lib/journeyUtils';
import { supabase } from '../../lib/supabase';
import type { PoiType } from '../../lib/journeyUtils';
import { useCarPhysics } from '../../hooks/useCarPhysics';
import type { DifficultyMode } from '../../hooks/useCarPhysics';
import type { CarType, CarManifest } from './types';
import { CAR_CONFIGS, getCarSpriteUrl, ARRIVAL_MESSAGES } from './types';
import 'leaflet/dist/leaflet.css';
import '../JourneyOverlay.css';

interface JourneyMapProps {
    geocodedEvents: any[];
    selectedCar: CarType;
    difficulty: DifficultyMode;
    carManifests: Record<string, CarManifest>;
    onFinish: (stats: any) => void;
    onClose: () => void;
    demoMode?: boolean;
}

const getCardinalDirection = (angle: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(angle / 45) % 8];
};

// Helper to get image for POI type
const getPoiImage = (type: PoiType): string => {
    switch (type) {
        case 'REINDEER': return '/poro.png';
        case 'AURORA': return '/aurora.png';
        case 'GAS_STATION': return '/gas_station.png';
        case 'BARN': return '/barn.png';
        case 'SCENIC': return '/scenic_view.png';
        case 'DINER': return '/diner.png';
        case 'MONOLITH': return '/monolith.png';
        case 'SPEED_TRAP': return '/speed_trap.png';
        case 'HITCHHIKER': return '/hitchhiker.png';
        case 'SILENCE_ZONE': return '/radio_tower.png';
        case 'PEE_BREAK': return '/bus_stop_pee.png';
        case 'SHOP_RUN': return '/shop_stop.png';
        case 'WRONG_TURN': return '/wrong_turn.png';
        case 'MOB_ATTACK': return '/mob_attack.png';
        default: return '/poro.png'; // Fallback
    }
};

export const JourneyMap: React.FC<JourneyMapProps> = ({
    geocodedEvents,
    selectedCar,
    difficulty,
    carManifests,
    onFinish,
    onClose,
    demoMode = false
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapInstanceRef = useRef<any>(null);
    const mapInitializedRef = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const carMarkerRef = useRef<any>(null);
    const isZoomingRef = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roadEdgeRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roadBaseRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roadDashRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LRef = useRef<any>(null);

    const positionRef = useRef<{ lat: number; lon: number } | null>(
        geocodedEvents.length > 0 ? { lat: geocodedEvents[0].lat, lon: geocodedEvents[0].lon } : null
    );
    const pathRef = useRef<{ lat: number; lon: number }[]>([]);
    const pathNodeIndexRef = useRef(1);
    const lastPoiCheckRef = useRef(0);
    const spriteFrameRef = useRef((selectedCar === 'red' || selectedCar === 'blue') ? 1 : 0);
    const lastFrameTimeRef = useRef(0);
    const poiQueueRef = useRef<PoiType[]>([]);
    const isArrivingRef = useRef(false);
    const lastMoveTimeRef = useRef(0);

    useEffect(() => {
        lastMoveTimeRef.current = Date.now();
    }, []);

    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [message, setMessage] = useState('');
    const [visualEvent, setVisualEvent] = useState<{ image: string; active: boolean; title?: string } | null>(null);
    const [showIdleWarning, setShowIdleWarning] = useState(false);
    const [showAgileMaster, setShowAgileMaster] = useState(false);
    const [bearing, setBearing] = useState(0);
    const [isMapReady, setIsMapReady] = useState(false);
    const lastBearingRef = useRef(0);
    const mapDistanceTraveledRef = useRef(0);
    const [distanceTraveled, setDistanceTraveled] = useState(0);
    const [collectedEvents, setCollectedEvents] = useState<{ type: PoiType; message: string; timestamp: number }[]>([]);
    const [carState, controls] = useCarPhysics(difficulty);

    // Helper to get next POI type from a shuffled queue
    const getNextPoiType = (isDemo: boolean): PoiType => {
        if (poiQueueRef.current.length === 0) {
            // Refill queue
            let newQueue: PoiType[];
            if (isDemo) {
                newQueue = ['PEE_BREAK', 'SHOP_RUN', 'WRONG_TURN', 'MOB_ATTACK'];
            } else {
                newQueue = POI_DEFINITIONS.map(d => d.type);
            }

            // Fisher-Yates shuffle
            for (let i = newQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
            }
            poiQueueRef.current = newQueue;
        }
        return poiQueueRef.current.pop() as PoiType;
    };

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current || geocodedEvents.length === 0 || mapInitializedRef.current) return;

        const initMap = async () => {
            if (!mapContainerRef.current) return;
            try {
                const L = await loadLeaflet();
                LRef.current = L;

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }

                const startPos = positionRef.current || geocodedEvents[0];
                const map = L.map(mapContainerRef.current, {
                    zoomControl: false,
                    attributionControl: false,
                    keyboard: false
                }).setView([startPos.lat, startPos.lon], 6);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);

                geocodedEvents.forEach(evt => {
                    L.marker([evt.lat, evt.lon])
                        .bindPopup(evt.title)
                        .addTo(map);
                });

                const carSpriteUrl = getCarSpriteUrl(selectedCar);
                const isManifestCar = selectedCar === 'red' || selectedCar === 'blue';
                const manifest = carManifests[selectedCar];
                const initialFrame = isManifestCar && manifest ? manifest.frames[1] : null;
                const carScale = CAR_CONFIGS[selectedCar]?.scale || 0.15;

                const carIcon = L.divIcon({
                    html: `<div class="car-sprite car-${selectedCar} ${isManifestCar ? 'frame-1' : 'frame-0'}" style="
                        transform: rotate(90deg);
                        background-image: url('${carSpriteUrl}');
                        ${isManifestCar && manifest ? `
                            width: ${Math.round((initialFrame?.width || 241) * carScale)}px;
                            height: ${Math.round((initialFrame?.height || 290) * carScale)}px;
                            background-position: -${Math.round((initialFrame?.x || 0) * carScale)}px -${Math.round((initialFrame?.y || 0) * carScale)}px;
                            background-size: ${Math.round(manifest.meta.imageWidth * carScale)}px ${Math.round(manifest.meta.imageHeight * carScale)}px;
                        ` : ''}
                    "></div>`,
                    className: 'car-icon-marker',
                    iconSize: isManifestCar && initialFrame ? [Math.round(initialFrame.width * carScale), Math.round(initialFrame.height * carScale)] : [64, 96],
                    iconAnchor: isManifestCar && initialFrame ? [Math.round(initialFrame.width / 2 * carScale), Math.round(initialFrame.height / 2 * carScale)] : [32, 48]
                });
                carMarkerRef.current = L.marker([startPos.lat, startPos.lon], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);

                const rawPoints = geocodedEvents.map(e => ({ lat: e.lat, lon: e.lon }));
                const curvedPath = generateCurvedPath(rawPoints, 20);
                pathRef.current = curvedPath;
                pathNodeIndexRef.current = 1;

                const latlngs: [number, number][] = curvedPath.map(p => [p.lat, p.lon]);

                const canvasRenderer = L.canvas();

                const roadOptions = { renderer: canvasRenderer, interactive: false, smoothFactor: 0, noClip: true };

                roadEdgeRef.current = L.polyline(latlngs, { ...roadOptions, color: '#f5d547', weight: 44, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                roadBaseRef.current = L.polyline(latlngs, { ...roadOptions, color: '#1a1a1a', weight: 40, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                roadDashRef.current = L.polyline(latlngs, { ...roadOptions, color: '#fff', weight: 1.5, opacity: 0.6, dashArray: '20, 30', lineCap: 'butt' }).addTo(map);
                L.polyline(latlngs, { ...roadOptions, color: '#000', weight: 50, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }).addTo(map);

                mapInstanceRef.current = map;
                mapInitializedRef.current = true;
                setIsMapReady(true);

                map.on('zoomstart', () => { isZoomingRef.current = true; });
                map.on('zoomend', () => { isZoomingRef.current = false; });
            } catch (error) {
                console.error('[JourneyMap] Map initialization error:', error);
            }
        };

        if (geocodedEvents.length > 0) {
            initMap();
        }
    }, [geocodedEvents, selectedCar, carManifests]);

    // Cleanup Map
    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                mapInitializedRef.current = false;
            }
        };
    }, []);

    // Check for fuel out
    useEffect(() => {
        if (carState.fuel <= 0) {
            onFinish({
                distance: carState.distanceTraveled,
                score: carState.score,
                reason: 'OUT_OF_FUEL',
                efficiency: carState.distanceTraveled > 0 ? (carState.score / carState.distanceTraveled).toFixed(2) : 0
            });
        }
    }, [carState.fuel, carState.distanceTraveled, carState.score, onFinish]);

    // Game Loop
    useEffect(() => {
        if (!positionRef.current || !mapInstanceRef.current || !pathRef.current.length) return;

        // ... (movement logic: lines 206-334)
        const targetIndex = currentEventIndex + 1;
        if (targetIndex >= geocodedEvents.length) {
            onFinish({
                distance: carState.distanceTraveled,
                score: carState.score,
                reason: 'COMPLETED',
                fuel: carState.fuel,
                efficiency: carState.distanceTraveled > 0 ? (carState.score / carState.distanceTraveled).toFixed(2) : 0,
                collectedEvents
            });
            return;
        }

        const currentTarget = geocodedEvents[targetIndex];
        const currentPos = positionRef.current;
        if (!currentPos) return;

        const speedKmH = carState.speed;

        // Idle Check: If moving or in autocruise, reset timer
        if (speedKmH > 1 || carState.autocruise !== 'off') {
            lastMoveTimeRef.current = Date.now();
            if (showIdleWarning) setShowIdleWarning(false);
        } else {
            const idleTime = Date.now() - lastMoveTimeRef.current;

            // Auto-enable autocruise after 30s
            if (idleTime > 30000) {
                controls.toggleAutocruise();
                lastMoveTimeRef.current = Date.now();
                setShowIdleWarning(false);
                setMessage("🔌 Auto-Pilot Engaged");
                setTimeout(() => setMessage(''), 3000);
            }
            // Show warning after 5s
            else if (idleTime > 5000 && !showIdleWarning) {
                setShowIdleWarning(true);
            }
        }

        // Agile Master / Wrong Direction Check
        const normalizedOffset = ((carState.rotationOffset % 360) + 360) % 360;
        // Check if deviation is significant (> 45 degrees)
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

            // ROBUST COMPLETION CHECK: If we are at the end of the path
            if (pathRef.current.length > 0 && pathNodeIndexRef.current >= pathRef.current.length - 1) {
                // Force completion of this segment
                if (!isArrivingRef.current) {
                    isArrivingRef.current = true;
                    if (currentEventIndex < geocodedEvents.length - 1) {
                        setCurrentEventIndex(prev => prev + 1);
                        // Reset path index for next segment implicitly involves generating new path? 
                        // Actually in this arch, pathRef covers START -> END entire route? 
                        // No, generateCurvedPath() takes ALL points. So pathRef is the WHOLE journey.
                        // So if we are at the end of pathRef, we are DONE with the whole journey.
                    } else {
                        onFinish({
                            distance: mapDistanceTraveledRef.current,
                            score: carState.score,
                            reason: 'COMPLETED',
                            isDemo: demoMode,
                            collectedEvents,
                            fuel: carState.fuel
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

            // Threshold 0.2km (200m) + Lock to prevent multiple triggers
            if (distToWaypoint < 0.2 && !isArrivingRef.current) {
                isArrivingRef.current = true;
                setMessage(ARRIVAL_MESSAGES[Math.floor(Math.random() * ARRIVAL_MESSAGES.length)]);

                setTimeout(() => {
                    if (currentEventIndex < geocodedEvents.length - 1) {
                        setCurrentEventIndex(prev => prev + 1);
                        setMessage('');
                        // Unlock only after moving to next event (and likely away from waypoint)
                        // But strictly speaking, we are now targeting a NEW waypoint far away.
                        // We reset the lock immediately after state update.
                        isArrivingRef.current = false;
                    } else {
                        onFinish({
                            distance: mapDistanceTraveledRef.current,
                            score: carState.score,
                            reason: 'COMPLETED',
                            isDemo: demoMode,
                            collectedEvents
                        });
                        // No need to unlock, journey finished
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

            // Sync ref to state for safe rendering
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

        // Check POI and Events
        const checkInterval = demoMode ? 5000 : 5000;
        const triggerChance = demoMode ? 0.95 : 0.7;
        const speedThreshold = demoMode ? 10 : 100;

        if (Date.now() - lastPoiCheckRef.current > checkInterval && speedKmH > speedThreshold) {
            lastPoiCheckRef.current = Date.now();
            if (Math.random() < triggerChance) {
                const poiType = getNextPoiType(demoMode);
                const def = POI_DEFINITIONS.find(d => d.type === poiType);
                const poi = def ? {
                    message: def.message,
                    type: poiType,
                    location: { lat: positionRef.current?.lat || 0, lon: positionRef.current?.lon || 0 }
                } : generateNearbyPOI();

                setMessage(`${poi.message}`);

                // Apply Physics Effects for events
                if (poi.type === 'PEE_BREAK') {
                    controls.emergencyStop();
                } else if (poi.type === 'SHOP_RUN') {
                    controls.emergencyStop();
                    controls.refuel();
                } else if (poi.type === 'WRONG_TURN') {
                    controls.spin(360);
                } else if (poi.type === 'MOB_ATTACK') {
                    controls.emergencyStop();
                    // maybe extra damage or score penalty?
                }

                // Collect Event
                setCollectedEvents(prev => [...prev, { type: poi.type, message: poi.message, timestamp: Date.now() }]);

                // Trigger visual event for all types
                setVisualEvent({ image: getPoiImage(poi.type), active: true, title: 'Scanning...' });

                // Fetch AI Title
                supabase.functions.invoke('generate-journey-story', {
                    body: { events: [poi], mode: 'title' }
                }).then(({ data, error }: { data: { title?: string } | null, error: any }) => {
                    if (!error && data?.title) {
                        setVisualEvent(prev => prev ? { ...prev, title: data.title } : null);
                    } else {
                        setVisualEvent(prev => prev ? { ...prev, title: poi.message } : null);
                    }
                });

                setTimeout(() => setVisualEvent(null), 6000); // Longer display time

                setTimeout(() => setMessage(''), 3000);
            }
        }

    }, [carState, geocodedEvents, currentEventIndex, selectedCar, carManifests, onFinish, controls, demoMode, isMapReady]);

    return (
        <div className="journey-map">
            <div ref={mapContainerRef} className="journey-map-container" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }} />

            {/* Visual Event Overlay */}
            {visualEvent && visualEvent.active && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '20%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1500,
                    animation: 'spinAndBounce 4s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none'
                }}>
                    <img src={visualEvent.image} alt="Event Visual" style={{
                        width: '300px', // Larger
                        height: 'auto',
                        imageRendering: 'pixelated',
                        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))'
                    }} />
                    <div style={{
                        marginTop: '20px',
                        background: 'linear-gradient(90deg, #000 0%, #333 50%, #000 100%)',
                        border: '2px solid #FFD700',
                        color: '#FFD700',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontFamily: '"Franklin Gothic Medium", sans-serif',
                        fontSize: '1.5rem',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        maxWidth: '300px',
                        boxShadow: '0 0 15px #FFD700'
                    }}>
                        {visualEvent.title || 'Event Detected'}
                    </div>
                    <style>{`
                        @keyframes spinAndBounce {
                            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
                            10% { transform: translate(-50%, -50%) scale(1.2) rotate(5deg); opacity: 1; }
                            20% { transform: translate(-50%, -60%) scale(1) rotate(-5deg); }
                            30% { transform: translate(-50%, -50%) scale(1.1) rotate(3deg); }
                            80% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
                            100% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
                        }
                    `}</style>
                </div>
            )}

            {/* Exit Button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    zIndex: 2000,
                    background: 'rgba(255, 68, 68, 0.8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                }}
            >
                EXIT
            </button>

            {/* Collected Events UI */}
            <div style={{
                position: 'absolute',
                top: 80,
                right: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 1900,
                pointerEvents: 'none'
            }}>
                {collectedEvents.map((evt, i) => (
                    <div key={i} style={{
                        width: '40px',
                        height: '40px',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid rgba(255,255,255,0.3)',
                        animation: 'fadeIn 0.5s ease-out'
                    }}>
                        <img
                            src={getPoiImage(evt.type)}
                            alt={evt.type}
                            style={{
                                width: '28px',
                                height: '28px',
                                imageRendering: 'pixelated'
                            }}
                        />
                    </div>
                ))}
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: scale(0); }
                        to { opacity: 1; transform: scale(1); }
                    }
                `}</style>
            </div>

            {/* Dashboard / HUD */}
            <div className="journey-dashboard" style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)',
                padding: '15px 30px',
                borderRadius: '50px',
                display: 'flex',
                gap: '20px',
                color: 'white',
                zIndex: 1000,
                border: '1px solid #444',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(5px)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>SPEED</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50' }}>{Math.round(carState.speed)}</div>
                </div>
                <div style={{ width: '1px', background: '#444' }}></div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>HEADING</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '60px' }}>
                        {bearing}°
                        <span style={{ fontSize: '0.7rem', color: '#aaa', marginLeft: '4px' }}>
                            {getCardinalDirection(bearing)}
                        </span>
                    </div>
                </div>
                {carState.autocruise !== 'off' && (
                    <>
                        <div style={{ width: '1px', background: '#444' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#aaa' }}>MODE</div>
                            <div style={{
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                color: carState.autocruise === 'turbo' ? '#ff00ff' : '#00ff00',
                                textShadow: `0 0 5px ${carState.autocruise === 'turbo' ? '#ff00ff' : '#00ff00'}`
                            }}>
                                {carState.autocruise === 'turbo' ? 'TURBO' : 'AUTO'}
                            </div>
                        </div>
                    </>
                )}
                <div style={{ width: '1px', background: '#444' }}></div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>FUEL</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: carState.fuel < 20 ? '#ff4444' : '#2196F3' }}>
                        {Math.round(carState.fuel)}%
                    </div>
                </div>
                <div style={{ width: '1px', background: '#444' }}></div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>DIST</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FFD700' }}>{distanceTraveled.toFixed(1)}</div>
                </div>
                <div style={{ width: '1px', background: '#444' }}></div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>SCORE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#e0e0e0' }}>{Math.round(carState.score)}</div>
                </div>
            </div>

            {/* Controls Help */}
            <div style={{
                position: 'absolute',
                bottom: 30,
                left: 30,
                color: 'rgba(255,255,255,0.7)',
                zIndex: 1000,
                fontSize: '0.9rem',
                pointerEvents: 'none'
            }}>
                <p>Controls:</p>
                <p>⬆️ Accelerate</p>
                <p>⬇️ Brake/Reverse</p>
                <p>⬅️ ➡️ Turn</p>
                <p>C: Autocruise</p>
            </div>

            {/* Message Overlay */}
            {message && (
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.85)',
                    color: '#fff',
                    padding: '20px 40px',
                    borderRadius: '15px',
                    fontSize: '2rem',
                    zIndex: 2000,
                    textAlign: 'center',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                    border: '2px solid #FFD700',
                    animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    {message}
                </div>
            )}

            {/* Emergency Idle Warning */}
            {showIdleWarning && (
                <div className="idle-warning" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(255, 0, 0, 0.9)',
                    color: 'white',
                    padding: '30px 50px',
                    borderRadius: '20px',
                    zIndex: 2500,
                    textAlign: 'center',
                    boxShadow: '0 0 50px rgba(255, 0, 0, 0.6)',
                    border: '4px solid white',
                    animation: 'pulse 1s infinite'
                }}>
                    <h2 style={{ fontSize: '2.5rem', margin: '0 0 20px 0', textTransform: 'uppercase' }}>⚠️ ENGINE IDLE ⚠️</h2>
                    <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>Press ⬆️ to Accelerate</p>
                    <p style={{ fontSize: '1.2rem', margin: '10px 0', opacity: 0.9 }}>- OR -</p>
                    <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>Press <strong>"C"</strong> for Autocruise</p>
                    <style>{`
                        @keyframes pulse {
                            0% { transform: translate(-50%, -50%) scale(1); }
                            50% { transform: translate(-50%, -50%) scale(1.05); }
                            100% { transform: translate(-50%, -50%) scale(1); }
                        }
                    `}</style>
                </div>
            )}

            {/* Agile Master Suvi Overlay */}
            {showAgileMaster && (
                <div className="agile-master-overlay" style={{
                    position: 'absolute',
                    bottom: '20%',
                    right: '5%',
                    background: 'linear-gradient(135deg, #6e8efb, #a777e3)',
                    color: 'white',
                    padding: '20px 30px',
                    borderRadius: '20px 20px 0 20px',
                    zIndex: 2600,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    border: '3px solid #fff',
                    maxWidth: '400px',
                    animation: 'slideInRight 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '10px' }}>👩‍🏫</div>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>Agile Master Suvi</h3>
                    <p style={{ margin: '0 0 15px 0', fontSize: '1.1rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                        "We need alignment! You are drifting away from the critical path!"
                    </p>
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '10px',
                        borderRadius: '10px',
                        width: '100%',
                        textAlign: 'center'
                    }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>Straighten up!</p>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem' }}>Use ⬅️ and ➡️ keys</p>
                    </div>
                </div>
            )}
        </div>
    );
};
