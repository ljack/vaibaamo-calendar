
import React, { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { loadLeaflet } from '../../lib/leafletLoader';
import { generateCurvedPath, getDistance, generateNearbyPOI } from '../../lib/journeyUtils';
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
    onClose
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

    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [message, setMessage] = useState('');
    const [visualEvent, setVisualEvent] = useState<{ image: string; active: boolean } | null>(null);
    const [bearing, setBearing] = useState(0);
    const lastBearingRef = useRef(0);
    const mapDistanceTraveledRef = useRef(0);
    const [distanceTraveled, setDistanceTraveled] = useState(0);
    const [carState, controls] = useCarPhysics(difficulty);

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

        const targetIndex = currentEventIndex + 1;
        if (targetIndex >= geocodedEvents.length) {
            onFinish({
                distance: carState.distanceTraveled,
                score: carState.score,
                reason: 'COMPLETED',
                fuel: carState.fuel,
                efficiency: carState.distanceTraveled > 0 ? (carState.score / carState.distanceTraveled).toFixed(2) : 0
            });
            return;
        }

        const currentTarget = geocodedEvents[targetIndex];
        const currentPos = positionRef.current;
        if (!currentPos) return;

        const speedKmH = carState.speed;
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
            if (distToWaypoint < 0.5) {
                setMessage(ARRIVAL_MESSAGES[Math.floor(Math.random() * ARRIVAL_MESSAGES.length)]);
                setTimeout(() => {
                    if (currentEventIndex < geocodedEvents.length - 1) {
                        setCurrentEventIndex(prev => prev + 1);
                        setMessage('');
                    } else {
                        onFinish({
                            distance: mapDistanceTraveledRef.current,
                            score: carState.score,
                            reason: 'COMPLETED'
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
        if (Date.now() - lastPoiCheckRef.current > 5000 && speedKmH > 100) {
            lastPoiCheckRef.current = Date.now();
            if (Math.random() > 0.7) {
                const poi = generateNearbyPOI();
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

                // Trigger visual event for all types
                setVisualEvent({ image: getPoiImage(poi.type), active: true });
                setTimeout(() => setVisualEvent(null), 4000);

                setTimeout(() => setMessage(''), 3000);
            }
        }

    }, [carState, geocodedEvents, currentEventIndex, selectedCar, carManifests, onFinish, controls]);

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
                    animation: 'spinAndBounce 4s ease-in-out'
                }}>
                    <img src={visualEvent.image} alt="Event Visual" style={{ width: '200px', height: 'auto', imageRendering: 'pixelated' }} />
                    <style>{`
                        @keyframes spinAndBounce {
                            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
                            20% { transform: translate(-50%, -50%) scale(1.2) rotate(10deg); opacity: 1; }
                            40% { transform: translate(-50%, -60%) scale(1) rotate(-10deg); }
                            60% { transform: translate(-50%, -50%) scale(1.1) rotate(5deg); }
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
        </div>
    );
};
