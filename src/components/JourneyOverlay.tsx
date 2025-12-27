import { useEffect, useState, useRef, useMemo } from 'react';
import type { Event } from '../types';
import { geocodeLocation } from '../lib/geocode';
import { getDistance, generateNearbyPOI, generateCurvedPath } from '../lib/journeyUtils';
import { useCarPhysics } from '../hooks/useCarPhysics';
import { loadLeaflet } from '../lib/leafletLoader';
import JourneyCollage from './JourneyCollage';
import 'leaflet/dist/leaflet.css';
import './JourneyOverlay.css';

type JourneyOverlayProps = {
    events: Event[];
    onClose: () => void;
};

type JourneyState = 'LOADING' | 'TRAVELING' | 'ARRIVED' | 'FINISHED';

const ARRIVAL_MESSAGES = [
    "Vibe Coding!",
    "Refactoring the universe...",
    "Deploying on Friday...",
    "Fixing bugs in production...",
    "Adding more AI...",
];

export default function JourneyOverlay({ events, onClose }: JourneyOverlayProps) {
    const [geocodedEvents, setGeocodedEvents] = useState<any[]>([]);
    const [gameState, setGameState] = useState<JourneyState>('LOADING');
    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [message, setMessage] = useState('');

    // Physics engine
    const [carState, carControls] = useCarPhysics();

    // Sprite Animation
    const spriteFrameRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    // Map refs
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const carMarkerRef = useRef<any>(null);
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

    // 1. Geocode Events
    useEffect(() => {
        const fetchLocations = async () => {
            const results = [];
            for (const event of eventsValid) {
                if (event.location) {
                    const coords = await geocodeLocation(event.location);
                    if (coords) {
                        results.push({ ...event, lat: coords.lat, lon: coords.lon });
                    }
                }
            }

            if (results.length < 2) {
                // Not enough events for a journey
                setGameState('FINISHED');
                return;
            }

            setGeocodedEvents(results);
            // Start at first event
            positionRef.current = { lat: results[0].lat, lon: results[0].lon };
            setGameState('TRAVELING');
        };
        fetchLocations();
    }, [eventsValid]);

    // 2. Initialize Map (Leaflet)
    useEffect(() => {
        if (!mapContainerRef.current || !geocodedEvents.length) return;

        const initMap = async () => {
            if (mapInstanceRef.current || !mapContainerRef.current) return;

            const L = await loadLeaflet();
            LRef.current = L;

            const startPos = geocodedEvents[0];
            const map = L.map(mapContainerRef.current, {
                zoomControl: false,
                attributionControl: false,
                keyboard: false // We use keyboard for driving
            }).setView([startPos.lat, startPos.lon], 6); // Z6: Region/Country level for 550km/h travel

            // Dark vibes map style (CartoDB Dark Matter)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);

            // Add markers for all events
            geocodedEvents.forEach(evt => {
                L.marker([evt.lat, evt.lon])
                    .bindPopup(evt.title)
                    .addTo(map);
            });

            // Car Marker (Using Sprite)
            // Sprite is 1024x1024.
            // Row 0 has variable width frames. Max width ~242px (60.5px scaled). Max Height ~366px (91.5px scaled).
            // Container size: 64x96.
            const carIcon = L.divIcon({
                html: `<div class="car-sprite frame-0" style="transform: rotate(90deg);"></div>`,
                className: 'car-icon-marker',
                iconSize: [64, 96],
                iconAnchor: [32, 48]
            });
            carMarkerRef.current = L.marker([startPos.lat, startPos.lon], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);

            // Generate Curved Route
            const rawPoints = geocodedEvents.map(e => ({ lat: e.lat, lon: e.lon }));
            const curvedPath = generateCurvedPath(rawPoints, 20);
            pathRef.current = curvedPath;
            pathNodeIndexRef.current = 1;

            const latlngs: [number, number][] = curvedPath.map(p => [p.lat, p.lon]);

            // LAYER 1: Yellow Edges (Widest)
            roadEdgeRef.current = L.polyline(latlngs, {
                color: '#f5d547', // Yellow
                weight: 54,       // Wide enough to form edges (+4px on each side of Asphalt?) No, significantly wider.
                // If road is 50px, edges should be maybe +4px each side = 58px?
                // User image has dashed yellow lines? No, solid yellow side lines, dashed yellow side lines?
                // Image: Solid Yellow Side Lines.
                // Let's make it 60px wide yellow line.
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);

            // LAYER 2: Asphalt (Middle)
            roadBaseRef.current = L.polyline(latlngs, {
                color: '#333', // Dark Grey Asphalt
                weight: 50,    // 5px narrower on each side = yellow borders
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);

            // LAYER 3: Center Marking (White Dashed)
            roadDashRef.current = L.polyline(latlngs, {
                color: '#fff', // White center
                weight: 2,
                opacity: 1,
                dashArray: '20, 30', // Long dashes
                lineCap: 'butt'
            }).addTo(map);

            mapInstanceRef.current = map;
        };

        initMap();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        }
    }, [geocodedEvents]); // Only re-init if events change. gameState changes shouldn't kill the map.

    // 3. Game Loop using Physics
    useEffect(() => {
        if (gameState !== 'TRAVELING' || !positionRef.current || !mapInstanceRef.current) return;

        const targetIndex = currentEventIndex + 1;
        if (targetIndex >= geocodedEvents.length) {
            setGameState('FINISHED');
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

            carMarkerRef.current.setLatLng([positionRef.current.lat, positionRef.current.lon]);
            mapInstanceRef.current.panTo([positionRef.current.lat, positionRef.current.lon], { animate: false });

            // Update Icon HTML for frame and rotation
            const iconEl = carMarkerRef.current.getElement();
            if (iconEl) {
                const inner = iconEl.querySelector('.car-sprite');
                if (inner) {
                    // Update class for frame
                    inner.className = `car-sprite ${carState.isBroken ? 'broken-' : 'frame-'}${spriteFrameRef.current}`;
                    // Update rotation
                    inner.style.transform = `rotate(${rotation}deg)`;
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


    if (gameState === 'LOADING') {
        return <div className="journey-overlay"><h1>Initializing GPS...</h1></div>
    }

    if (gameState === 'FINISHED') {
        return (
            <div className="journey-overlay">
                <JourneyCollage onClose={onClose} />
            </div>
        );
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
                        <span className="label">DIST</span>
                        <span className="value">{carState.distanceTraveled.toFixed(1)}</span>
                        <span className="unit">km</span>
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
