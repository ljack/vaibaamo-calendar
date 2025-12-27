import { useEffect, useState, useRef, useMemo } from 'react';
import type { Event } from '../types';
import { geocodeLocation } from '../lib/geocode';
import { getDistance, generateNearbyPOI, generateCurvedPath } from '../lib/journeyUtils';
import { useCarPhysics, type DifficultyMode } from '../hooks/useCarPhysics';
import { loadLeaflet } from '../lib/leafletLoader';
import 'leaflet/dist/leaflet.css';
import './JourneyOverlay.css';

type JourneyOverlayProps = {
    events: Event[];
    onClose: () => void;
};

type JourneyState = 'LOADING' | 'TRAVELING' | 'ARRIVED' | 'FINISHED' | 'SELECT_CAR' | 'SELECT_DIFFICULTY';
type CarType = 'red' | 'blue';

const AVAILABLE_CARS: CarType[] = ['red', 'blue'];

const ARRIVAL_MESSAGES = [
    "Vibe Coding!",
    "Refactoring the universe...",
    "Deploying on Friday...",
    "Fixing bugs in production...",
    "Adding more AI...",
];

// Car sprite configuration
const getCarSpriteUrl = (carType: CarType): string => {
    return `/car_sprites_${carType}.png`;
};

export default function JourneyOverlay({ events, onClose }: JourneyOverlayProps) {
    // Parse URL parameters for direct journey start
    const urlParams = new URLSearchParams(window.location.search);
    const urlCar = urlParams.get('car') as CarType | null;
    const urlDifficulty = urlParams.get('difficulty') as DifficultyMode | null;

    const [geocodedEvents, setGeocodedEvents] = useState<any[]>([]);

    // Initialize car and difficulty from URL or defaults
    const initialCar = (urlCar || null) as CarType | null;
    const initialDifficulty = (urlDifficulty || null) as DifficultyMode | null;

    const [selectedCar, setSelectedCar] = useState<CarType | null>(initialCar);
    const [difficulty, setDifficulty] = useState<DifficultyMode | null>(initialDifficulty);
    const [gameState, setGameState] = useState<JourneyState>(
        initialCar && initialDifficulty ? 'LOADING' : 'SELECT_CAR'
    );
    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [message, setMessage] = useState('');
    const [finalStats, setFinalStats] = useState<any>(null);

    // Physics engine
    const [carState, carControls] = useCarPhysics(difficulty || 'normal');

    // Sprite Animation
    const spriteFrameRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    // Map refs
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const mapInitializedRef = useRef(false);
    const carMarkerRef = useRef<any>(null);
    const isZoomingRef = useRef(false);
    const roadEdgeRef = useRef<any>(null);
    const roadBaseRef = useRef<any>(null);
    const roadDashRef = useRef<any>(null);
    const LRef = useRef<any>(null);

    // Position state (lat, lon)
    const positionRef = useRef<{ lat: number, lon: number } | null>(null);
    // Path tracking
    const pathRef = useRef<{ lat: number, lon: number }[]>([]);
    const pathNodeIndexRef = useRef(1);


    // POI
    const lastPoiCheckRef = useRef(0);

    const eventsValid = useMemo(
        () => events.filter((event) => event.location?.trim()),
        [events]
    );

    // 1. Geocode Events - Only after car is selected and events are loaded
    useEffect(() => {
        if (!selectedCar || eventsValid.length === 0) {
            return; // Wait for car selection and events to load
        }

        const fetchLocations = async () => {
            const results = [];

            // Filter events with valid location strings (not "Ei sijaintia" or empty)
            const eventsWithLocations = eventsValid.filter(event =>
                event.location &&
                event.location.trim() &&
                event.location.toLowerCase() !== 'ei sijaintia'
            );

            for (const event of eventsWithLocations) {
                try {
                    const location = event.location || '';
                    const coords = await geocodeLocation(location);
                    if (coords) {
                        results.push({ ...event, lat: coords.lat, lon: coords.lon });
                    }
                } catch (error) {
                    console.error('[JourneyOverlay] Geocoding error:', event.location, error);
                }
            }

            if (results.length < 2) {
                // Not enough events for a journey
                setFinalStats({
                    distance: 0,
                    score: 0,
                    reason: 'INSUFFICIENT_EVENTS',
                    message: `Need at least 2 events with locations (found ${results.length})`
                });
                setGameState('FINISHED');
                return;
            }

            setGeocodedEvents(results);
            // Start at first event
            positionRef.current = { lat: results[0].lat, lon: results[0].lon };
            // Don't start traveling yet - wait for difficulty selection
        };
        fetchLocations();
    }, [eventsValid, selectedCar]);

    // Advance to difficulty selection after car is selected
    useEffect(() => {
        if (selectedCar && gameState === 'SELECT_CAR') {
            setGameState('SELECT_DIFFICULTY');
        }
    }, [selectedCar, gameState]);

    // Start traveling after difficulty is selected or when URL params are ready
    useEffect(() => {
        if (difficulty && selectedCar && geocodedEvents.length > 0) {
            if (gameState === 'SELECT_DIFFICULTY' || gameState === 'LOADING') {
                setGameState('TRAVELING');
            }
        }
    }, [difficulty, selectedCar, geocodedEvents.length, gameState]);

    // 2. Initialize Map (Leaflet)
    useEffect(() => {
        // Guard: wait for container and events to be ready
        if (!mapContainerRef.current || geocodedEvents.length === 0) {
            return;
        }

        // Guard: only initialize once
        if (mapInitializedRef.current) {
            return;
        }

        const initMap = async () => {
            try {
                // Ensure container is present
                if (!mapContainerRef.current) return;

                const L = await loadLeaflet();
                LRef.current = L;

                // Cleanup existing map if it exists
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }

                const startPos = geocodedEvents[0];
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

                const carSpriteUrl = getCarSpriteUrl(selectedCar || 'red');
                const carIcon = L.divIcon({
                    html: `<div class="car-sprite car-${selectedCar || 'red'} frame-0" style="transform: rotate(90deg); background-image: url('${carSpriteUrl}');"></div>`,
                    className: 'car-icon-marker',
                    iconSize: [64, 96],
                    iconAnchor: [32, 48]
                });
                carMarkerRef.current = L.marker([startPos.lat, startPos.lon], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);

                const rawPoints = geocodedEvents.map(e => ({ lat: e.lat, lon: e.lon }));
                const curvedPath = generateCurvedPath(rawPoints, 20);
                pathRef.current = curvedPath;
                pathNodeIndexRef.current = 1;

                const latlngs: [number, number][] = curvedPath.map(p => [p.lat, p.lon]);

                roadEdgeRef.current = L.polyline(latlngs, { color: '#f5d547', weight: 54, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                roadBaseRef.current = L.polyline(latlngs, { color: '#333', weight: 50, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                roadDashRef.current = L.polyline(latlngs, { color: '#fff', weight: 2, opacity: 1, dashArray: '20, 30', lineCap: 'butt' }).addTo(map);

                mapInstanceRef.current = map;
                mapInitializedRef.current = true;

                map.on('zoomstart', () => { isZoomingRef.current = true; });
                map.on('zoomend', () => { isZoomingRef.current = false; });
            } catch (error) {
                console.error('[JourneyOverlay] Map initialization error:', error);
            }
        };

        if (geocodedEvents.length > 0 && (gameState === 'TRAVELING' || gameState === 'ARRIVED')) {
            initMap();
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                mapInitializedRef.current = false;
            }
        };
    }, [geocodedEvents.length, selectedCar, gameState]);

    // Check for fuel out and game over
    useEffect(() => {
        if (gameState === 'TRAVELING' && carState.fuel <= 0) {
            setGameState('FINISHED');
            setFinalStats({
                distance: carState.distanceTraveled,
                score: carState.score,
                reason: 'OUT_OF_FUEL',
                efficiency: carState.distanceTraveled > 0 ? (carState.score / carState.distanceTraveled).toFixed(2) : 0
            });
        }
    }, [carState.fuel, gameState, carState.distanceTraveled, carState.score]);

    // 3. Game Loop using Physics
    useEffect(() => {
        if (gameState !== 'TRAVELING' || !positionRef.current || !mapInstanceRef.current || !pathRef.current.length) return;

        const targetIndex = currentEventIndex + 1;
        if (targetIndex >= geocodedEvents.length) {
            setGameState('FINISHED');
            setFinalStats({
                distance: carState.distanceTraveled,
                score: carState.score,
                reason: 'COMPLETED',
                fuel: carState.fuel,
                efficiency: carState.distanceTraveled > 0 ? (carState.score / carState.distanceTraveled).toFixed(2) : 0
            });
            return;
        }

        const currentTarget = geocodedEvents[targetIndex];

        // Calculate distance to target to normalize progress
        // We are actually simulating movement along the straight line for simplicity
        // Real routing would require OSRM, which is too complex for this demo

        const currentPos = positionRef.current;
        const distToTarget = getDistance(currentPos, { lat: currentTarget.lat, lon: currentTarget.lon }); // km

        if (distToTarget < 0.1) {
            // Arrived at waypoint
            setGameState('ARRIVED');
            setMessage(ARRIVAL_MESSAGES[Math.floor(Math.random() * ARRIVAL_MESSAGES.length)]);

            setTimeout(() => {
                if (currentEventIndex < geocodedEvents.length - 2) {
                    setCurrentEventIndex(prev => prev + 1);
                    setGameState('TRAVELING');
                    setMessage('');
                    // Snap to exact pos
                    positionRef.current = { lat: currentTarget.lat, lon: currentTarget.lon };
                } else {
                    setGameState('FINISHED');
                }
            }, 3000);
            return;
        }


        // Move car based on speed
        const speedKmH = carState.speed;
        if (speedKmH > 0 && pathRef.current.length > 0) {
            // Target the next node in the refined curved path
            // We need a path tracking index
            let targetNodeIndex = pathNodeIndexRef.current;

            // Safety check
            if (targetNodeIndex >= pathRef.current.length) {
                targetNodeIndex = pathRef.current.length - 1;
            }

            const currentPos = positionRef.current;
            const targetNode = pathRef.current[targetNodeIndex];

            // Distance to next specific path node (meters? no, degrees)
            const dLat = targetNode.lat - currentPos.lat;
            const dLon = targetNode.lon - currentPos.lon;
            const distToNode = Math.sqrt(dLat * dLat + dLon * dLon);

            // Move distance per frame (approx)
            // 550km/h is fast.
            // visual speed factor needs to be calibrated to map zoom 6
            const moveDistDegrees = (speedKmH * 0.000005);

            if (distToNode < moveDistDegrees) {
                // We reached this node, snap and target next
                positionRef.current = targetNode;
                pathNodeIndexRef.current = Math.min(targetNodeIndex + 1, pathRef.current.length - 1);
            } else {
                // Move towards node
                const fraction = moveDistDegrees / distToNode;
                positionRef.current = {
                    lat: currentPos.lat + dLat * fraction,
                    lon: currentPos.lon + dLon * fraction
                };
            }

            // Check if we arrived at the major Waypoint (Event)
            const distToWaypoint = getDistance(positionRef.current, { lat: currentTarget.lat, lon: currentTarget.lon });
            if (distToWaypoint < 0.5) { // 500m tolerance
                // Arrived at waypoint
                setGameState('ARRIVED');
                setMessage(ARRIVAL_MESSAGES[Math.floor(Math.random() * ARRIVAL_MESSAGES.length)]);

                setTimeout(() => {
                    if (currentEventIndex < geocodedEvents.length - 1) {
                        // Only advance event index if not last
                        setCurrentEventIndex(prev => prev + 1);
                        setGameState('TRAVELING');
                        setMessage('');
                    } else {
                        setGameState('FINISHED');
                    }
                }, 3000);
            }
        }


        // Animate Sprite
        // 4 driving frames. Switch every 100km/h / 2? Or just 10fps?
        // Let's do 10fps if moving.
        if (Date.now() - lastFrameTimeRef.current > 100) {
            lastFrameTimeRef.current = Date.now();
            if (carState.isBroken) {
                // Toggle broken frames 0-1
                // Assuming broken frames are specialized and fine using the broken logic
                // But earlier CSS reused frame 0 for broken. 
                // Let's stick to existing broken logic for now, or just use 0.
                const next = (spriteFrameRef.current + 1) % 2;
                spriteFrameRef.current = next;
            } else if (speedKmH > 10) {
                // User Feedback: Frames 2 and 4 (Indices 1 and 3) look bad.
                // Restrict to Frame 1 and 3 (Indices 0 and 2).
                // We need to know which "step" of the allowed frames we are on.
                // We can just toggle between 0 and 2.
                const current = spriteFrameRef.current;
                const next = current === 0 ? 2 : 0;
                spriteFrameRef.current = next;
            }
        }

        // Update Map & Rotation
        if (positionRef.current) {

            // Calculate Bearing
            // Look ahead a bit for smoother rotation?
            // Just look at next node
            const nextNode = pathRef.current[pathNodeIndexRef.current] || currentTarget;

            const dLat = nextNode.lat - currentPos.lat;
            const dLon = nextNode.lon - currentPos.lon;

            const rads = Math.atan2(dLat, dLon); // Angle from East
            // We want degrees.
            let degs = rads * (180 / Math.PI);
            // Leaflet standard rotation: clockwise from North?
            // Actually, simple CSS rotation on a div that is "facing right"
            // -90 is Up (North). 0 is Right (East). 90 is Down (South).
            // Math.atan2(1,0) = +90 (North). We want -90.
            // So -degs is correct.

            // Sprite is UP (North). We want to rotate it to match travel direction.
            // degs is angle from East.
            // If degs=0 (East), we want Sprite (Up) to rotate 90 deg (Right).
            // so rotation = degs + 90?
            // Test: North (degs=90). rot = 180? No.
            // Leaflet coordinates:
            // Lat increases Up. Lon increases Right.
            // dLat > 0, dLon = 0. atan2(1,0) = PI/2 = 90 deg.
            // We want car to face Up. (0 rotation).
            // rot = 0.
            // 90 (degs) -> 0.
            // 0 (degs, East) -> 90.
            // -90 (degs, South) -> 180.
            // Formula: rot = 90 - degs.
            // Check North (90): 90 - 90 = 0. Correct.
            // Check East (0): 90 - 0 = 90. Correct.
            // Check South (-90): 90 - -90 = 180. Correct.
            // Check West (180): 90 - 180 = -90 (270). Correct.

            const rotation = 90 - degs;

            if (mapInstanceRef.current && !isZoomingRef.current && carMarkerRef.current) {
                carMarkerRef.current.setLatLng([positionRef.current.lat, positionRef.current.lon]);
                mapInstanceRef.current.panTo([positionRef.current.lat, positionRef.current.lon], { animate: false });
            }

            // Update Icon HTML for frame and rotation
            if (carMarkerRef.current) {
                const iconEl = carMarkerRef.current.getElement();
                if (iconEl) {
                    const inner = iconEl.querySelector('.car-sprite');
                    if (inner) {
                        // Update class for frame
                        inner.className = `car-sprite car-${selectedCar || 'red'} ${carState.isBroken ? 'broken-' : 'frame-'}${spriteFrameRef.current}`;
                        // Update rotation
                        inner.style.transform = `rotate(${rotation}deg)`;
                    }
                }
            }

        }

        // Check POI
        if (Date.now() - lastPoiCheckRef.current > 5000 && speedKmH > 100) {
            lastPoiCheckRef.current = Date.now();
            if (Math.random() > 0.7) {
                const poi = generateNearbyPOI();
                setMessage(`Passing by: ${poi}`);
                setTimeout(() => setMessage(''), 3000);
            }
        }

    }, [carState, gameState, geocodedEvents, currentEventIndex]);


    // Car Selection Screen
    if (gameState === 'SELECT_CAR') {
        return (
            <div className="journey-overlay">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Choose Your Vehicle</h1>
                    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {AVAILABLE_CARS.map(car => (
                            <button
                                key={car}
                                onClick={() => setSelectedCar(car)}
                                style={{
                                    padding: '30px 40px',
                                    fontSize: '1.2rem',
                                    background: car === 'red' ? '#e74c3c' : '#3498db',
                                    color: 'white',
                                    border: '3px solid ' + (car === 'red' ? '#c0392b' : '#2980b9'),
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'transform 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '15px',
                                    minWidth: '200px'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                <div style={{ fontSize: '3rem' }}>
                                    {car === 'red' ? '🚗' : '🚘'}
                                </div>
                                <div style={{ textTransform: 'capitalize', fontSize: '1.3rem' }}>
                                    {car} Car
                                </div>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            fontSize: '1rem',
                            background: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginTop: '20px'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Difficulty Selection Screen
    if (gameState === 'SELECT_DIFFICULTY') {
        return (
            <div className="journey-overlay">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <h1>Select Difficulty</h1>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button
                            onClick={() => setDifficulty('easy')}
                            style={{
                                padding: '15px 30px',
                                fontSize: '1.1rem',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            🟢 Easy (Unlimited Fuel)
                        </button>
                        <button
                            onClick={() => setDifficulty('normal')}
                            style={{
                                padding: '15px 30px',
                                fontSize: '1.1rem',
                                background: '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            🟠 Normal (Limited Fuel)
                        </button>
                        <button
                            onClick={() => setDifficulty('hard')}
                            style={{
                                padding: '15px 30px',
                                fontSize: '1.1rem',
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            🔴 Hard (Very Limited Fuel)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'LOADING') {
        return <div className="journey-overlay"><h1>Initializing GPS...</h1></div>
    }

    if (gameState === 'FINISHED') {
        if (finalStats?.reason === 'COMPLETED') {
            return (
                <div className="journey-overlay">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '30px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        padding: '40px'
                    }}>
                        <h1 style={{ fontSize: '3rem', margin: 0 }}>🎉 JOURNEY COMPLETE!</h1>
                        <div style={{
                            background: 'rgba(0,0,0,0.7)',
                            padding: '30px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            minWidth: '400px'
                        }}>
                            <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>📍 Distance: <strong>{finalStats.distance.toFixed(1)} km</strong></p>
                            <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>⭐ Score: <strong>{Math.round(finalStats.score)}</strong></p>
                            <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>⚡ Fuel Remaining: <strong>{finalStats.fuel?.toFixed(1)}%</strong></p>
                            <p style={{ fontSize: '1.3rem', margin: '10px 0', color: '#FFD700' }}>🏆 Efficiency: <strong>{finalStats.efficiency}</strong> pts/km</p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '15px 40px',
                                fontSize: '1.2rem',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Continue
                        </button>
                    </div>
                </div>
            );
        } else if (finalStats?.reason === 'OUT_OF_FUEL') {
            return (
                <div className="journey-overlay">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '30px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        background: 'linear-gradient(135deg, #d32f2f 0%, #7b1fa2 100%)',
                        padding: '40px'
                    }}>
                        <h1 style={{ fontSize: '3rem', margin: 0 }}>⛽ OUT OF FUEL!</h1>
                        <div style={{
                            background: 'rgba(0,0,0,0.7)',
                            padding: '30px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            minWidth: '400px'
                        }}>
                            <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>📍 Distance Traveled: <strong>{finalStats.distance.toFixed(1)} km</strong></p>
                            <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>⭐ Score: <strong>{Math.round(finalStats.score)}</strong></p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '15px 40px',
                                fontSize: '1.2rem',
                                background: '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        } else if (finalStats?.reason === 'INSUFFICIENT_EVENTS') {
            return (
                <div className="journey-overlay">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '30px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        background: '#1a1a2e',
                        padding: '40px'
                    }}>
                        <h1 style={{ fontSize: '2rem' }}>⚠️ Journey Not Available</h1>
                        <p style={{ fontSize: '1.1rem', color: '#aaa' }}>{finalStats.message}</p>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '15px 40px',
                                fontSize: '1.2rem',
                                background: '#FF6B6B',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Back
                        </button>
                    </div>
                </div>
            );
        } else {
            // Fallback for unknown finish state
            return (
                <div className="journey-overlay">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '30px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        background: '#1a1a2e',
                        padding: '40px'
                    }}>
                        <h1>Journey Ended</h1>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '15px 40px',
                                fontSize: '1.2rem',
                                background: '#FF6B6B',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Back
                        </button>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="journey-overlay">
            <div className="journey-map" ref={mapContainerRef} style={{ height: '100%' }}>
                {/* Map renders here */}
            </div>

            <div className="journey-controls enhanced-controls">
                <div className="dashboard-grid">
                    <div className="gauge">
                        <span className="label">SPEED</span>
                        <span className="value">{Math.round(carState.speed)}</span>
                        <span className="unit">km/h</span>
                    </div>
                    <div className="gauge">
                        <span className="label">RPM</span>
                        <span className="value">{Math.round(carState.rpm)}</span>
                        <span className="unit">x1000</span>
                    </div>
                    <div className="gauge">
                        <span className="label">GEAR</span>
                        <span className="value">{carState.gear}</span>
                    </div>
                    <div className="gauge">
                        <span className="label">FUEL</span>
                        <span className="value" style={{ color: carState.fuel < 20 ? '#ff4444' : '#0ff' }}>
                            {carState.fuel.toFixed(0)}
                        </span>
                        <span className="unit">%</span>
                    </div>
                    <div className="gauge">
                        <span className="label">DIST</span>
                        <span className="value">{carState.distanceTraveled.toFixed(1)}</span>
                        <span className="unit">km</span>
                    </div>
                    <div className="gauge">
                        <span className="label">SCORE</span>
                        <span className="value" style={{ color: '#FFD700' }}>{Math.round(carState.score)}</span>
                        <span className="unit">pts</span>
                    </div>
                </div>

                <div className="console-display">
                    <p className="status">{gameState}</p>
                    <p className="message">{message}</p>
                </div>

                <div className="actions">
                    <div className="driving-hint">
                        {carState.isBroken
                            ? <span style={{ color: 'red', fontWeight: 'bold' }}>MALFUNCTION! PRESS 'R' TO REPAIR!</span>
                            : "Use ↑ / ↓ to DRIVE"}
                    </div>
                    {carState.isBroken && <button onClick={carControls.repair} style={{ background: 'red', animation: 'pulse 0.5s infinite' }}>🔧 REPAIR</button>}
                    <button className="close-btn" onClick={onClose}>EXIT</button>
                </div>
            </div>
        </div>
    );
}
