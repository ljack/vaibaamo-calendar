import { useEffect, useState, useMemo } from 'react';
import type { Event } from '../types';
import { geocodeLocation } from '../lib/geocode';
import { normalizeCoordinates } from '../lib/journeyUtils';
import './JourneyOverlay.css'; // We will create this CSS file

type JourneyOverlayProps = {
    events: Event[];
    onClose: () => void;
};

type JourneyState = 'LOADING' | 'TRAVELING' | 'ARRIVED' | 'FINISHED';

const CAR_EMOJIS = ['🚗', '🚙', '🏎️', '🚐', '🚌'];
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
    const [progress, setProgress] = useState(0);
    const [carEmoji, setCarEmoji] = useState(CAR_EMOJIS[0]);
    const [message, setMessage] = useState('');

    // Audio refs could go here if we had sounds

    // Filter events with location
    const eventsValid = useMemo(
        () => events.filter((event) => event.location?.trim()),
        [events]
    )

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

            // If we have less than 2 events, we can't really do a journey
            if (results.length < 2) {
                // Fallback or just show one
            }

            const normalized = normalizeCoordinates(results);
            setGeocodedEvents(normalized);
            setGameState('TRAVELING');
        };
        fetchLocations();
    }, [eventsValid]);

    // Game Loop
    useEffect(() => {
        if (gameState !== 'TRAVELING') return;
        if (geocodedEvents.length < 2) return;

        let animationFrameId: number;
        const speed = 0.005; // Progression speed per frame

        const animate = () => {
            setProgress((prev) => {
                const next = prev + speed;
                if (next >= 1) {
                    setGameState('ARRIVED');
                    setMessage(ARRIVAL_MESSAGES[Math.floor(Math.random() * ARRIVAL_MESSAGES.length)]);
                    setTimeout(() => {
                        if (currentEventIndex < geocodedEvents.length - 2) {
                            setCurrentEventIndex(current => current + 1);
                            setGameState('TRAVELING');
                            setMessage('');
                            return 0; // Reset progress
                        } else {
                            setGameState('FINISHED');
                        }
                    }, 3000); // Wait 3 seconds at event
                    return 1;
                }
                return next;
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState, geocodedEvents, currentEventIndex]);


    const handleAction = (action: string) => {
        // visual feedback
        setMessage(`Action: ${action}!`);
        setTimeout(() => setMessage(''), 1000);

        if (action === "New Car") {
            setCarEmoji(CAR_EMOJIS[Math.floor(Math.random() * CAR_EMOJIS.length)])
        }
    }

    if (gameState === 'LOADING') {
        return <div className="journey-overlay"><h1>Loading Map...</h1></div>
    }

    if (geocodedEvents.length === 0) {
        return <div className="journey-overlay"><h1>No events with locations found!</h1><button onClick={onClose}>Close</button></div>
    }

    // Calculate Car Position
    const start = geocodedEvents[currentEventIndex];
    const end = geocodedEvents[currentEventIndex + 1] || start;

    // Interpolate normalized coordinates for rendering on screen
    const carX = start.normalizedX + (end.normalizedX - start.normalizedX) * progress;
    const carY = start.normalizedY + (end.normalizedY - start.normalizedY) * progress;

    // Convert to percentage for CSS
    const carLeft = `${(carX * 80) + 10}%`; // 10% padding
    const carTop = `${(carY * 80) + 10}%`;

    return (
        <div className="journey-overlay">
            <div className="journey-map">
                {geocodedEvents.map((evt, idx) => (
                    <div
                        key={evt.id}
                        className={`map-node ${idx === currentEventIndex ? 'active' : ''}`}
                        style={{
                            left: `${(evt.normalizedX * 80) + 10}%`,
                            top: `${(evt.normalizedY * 80) + 10}%`
                        }}
                    >
                        📍
                        <span className="node-label">{evt.title}</span>
                    </div>
                ))}

                <div
                    className="car-marker"
                    style={{ left: carLeft, top: carTop }}
                >
                    {carEmoji}
                </div>
            </div>

            <div className="journey-controls">
                <div className="console">
                    <h2>VAIB-A-AMO JOURNEY</h2>
                    <p>{gameState === 'ARRIVED' ? `ARRIVED AT ${geocodedEvents[currentEventIndex + 1]?.title}` : 'TRAVELING...'}</p>
                    <p className="message">{message}</p>
                </div>
                <div className="actions">
                    <button onClick={() => handleAction("Piss Break")}>🚽 Piss Break</button>
                    <button onClick={() => handleAction("Charge EV")}>⚡ Charge EV</button>
                    <button onClick={() => handleAction("Diesel")}>⛽ Buy Diesel</button>
                    <button onClick={() => handleAction("New Car")}>🔄 Change Car</button>
                </div>
                <button className="close-btn" onClick={onClose}>EXIT JOURNEY</button>
            </div>

            {gameState === 'FINISHED' && (
                <div className="victory-modal">
                    <h1>JOURNEY COMPLETE</h1>
                    <p>You have vibed with all events.</p>
                    <button onClick={onClose}>Close</button>
                </div>
            )}
        </div>
    );
}
