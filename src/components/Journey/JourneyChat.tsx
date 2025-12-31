
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface JourneyChatProps {
    context: {
        route: string[];
        events: any[];
        stats: any;
    };
    onPlayMusic?: (notes: string[]) => void;
}

const LocationPicker = ({ onSelect }: { onSelect: (latlng: L.LatLng) => void }) => {
    useMapEvents({
        click(e: L.LeafletMouseEvent) {
            onSelect(e.latlng);
        },
    });
    return null;
};

const MapController = ({ center }: { center: L.LatLng | null }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 8, { duration: 2 });
        }
    }, [center, map]);
    return null;
};

export const JourneyChat: React.FC<JourneyChatProps> = ({ context, onPlayMusic }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState<L.LatLng | null>(null);
    const [mapFocus, setMapFocus] = useState<L.LatLng | null>(null); // State for AI-driven map movement
    const [routePath, setRoutePath] = useState<L.LatLng[] | null>(null); // State for AI-driven route
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initial Greeting
    useEffect(() => {
        if (messages.length === 0) {
            sendMessage("SYSTEM_INIT", true); // Trigger generic start
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sendMessage = async (text: string, isSystemInit = false) => {
        if (!text.trim() && !isSystemInit) return;

        const newMsg: ChatMessage = { role: 'user', content: text };

        // Don't show system init triggers in UI if possible, or make them look like internal thought
        // Actually, for "SYSTEM_INIT", effectively we want to start empty prompt or "Hello" in prompt but not UI

        let displayMessages = messages;
        if (!isSystemInit) {
            displayMessages = [...messages, newMsg];
            setMessages(displayMessages);
        } else {
            // For init, we don't add a user message, just ask AI to start
            // But we need to send something to the API. 
            // We'll send a hidden prompt in the body as purely 'messages' payload context
        }

        setInput('');
        setLoading(true);

        try {
            // Prepare API messages
            const apiMessages = displayMessages.map(m => ({ role: m.role, content: m.content }));

            if (isSystemInit) {
                apiMessages.push({ role: 'user', content: "Initialize communication. Ask me something interesting." });
            }

            const { data, error } = await supabase.functions.invoke('journey-chat', {
                body: {
                    messages: apiMessages,
                    context: context
                }
            });

            if (error) throw error;

            if (data?.reply) {
                let replyContent = data.reply;
                // Parse for coordinates [[LAT, LON]] with permissive whitespace
                const coordMatch = replyContent.match(/\[\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\]/);

                if (coordMatch) {
                    const lat = parseFloat(coordMatch[1]);
                    const lng = parseFloat(coordMatch[2]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const newFocus = new L.LatLng(lat, lng);
                        setMapFocus(newFocus); // Fly to AI suggested location
                        setSelectedPoint(newFocus); // Also mark it
                    }
                    replyContent = replyContent.replace(coordMatch[0], '').trim();
                }

                // Parse for music [[MUSIC: NOTE1, NOTE2]]
                const musicMatch = replyContent.match(/\[\[\s*MUSIC:\s*([\w\s,#]+)\]\]/);
                if (musicMatch && onPlayMusic) {
                    const notes = musicMatch[1].split(/[,\s]+/).filter((n: string) => n.length > 0);
                    onPlayMusic(notes);
                    replyContent = replyContent.replace(musicMatch[0], '').trim();
                }

                // Parse for route [[ROUTE: [Lat1, Lon1], [Lat2, Lon2], ...]]
                const routeMatch = replyContent.match(/\[\[\s*ROUTE:\s*((?:\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\]\s*,?\s*)+)\]\]/);
                if (routeMatch) {
                    try {
                        // Parse the array string. wrapping in [] to make it valid JSON array of arrays logic
                        // The regex captures inner content like "[60.1, 24.9], [61.5, 23.8]"
                        // We can parse it by wrapping in brackets and using JSON.parse
                        const routeStr = `[${routeMatch[1]}]`;
                        const rawCoords = JSON.parse(routeStr);

                        if (Array.isArray(rawCoords) && rawCoords.length > 0) {
                            const path = rawCoords.map((c: any) => new L.LatLng(c[0], c[1]));
                            setRoutePath(path);

                            // Focus on the start of the route or fit bounds (future enhancement)
                            // For now, fly to the first point
                            if (path.length > 0) {
                                setMapFocus(path[0]);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse route", e);
                    }
                    replyContent = replyContent.replace(routeMatch[0], '').trim();
                }

                setMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
            }

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: "My sensors are offline... (Connection Error)" }]);
        } finally {
            setLoading(false);
        }
    };

    const handleMapClick = async (latlng: L.LatLng) => {
        setSelectedPoint(latlng);
        // Reverse geocode or just indicate point
        const locationStr = `${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)}`;
        sendMessage(`I am pointing at coordinates ${locationStr}. What is there?`);
    };

    return (
        <div style={{
            display: 'flex',
            height: '500px',
            width: '100%',
            maxWidth: '1000px',
            background: '#111',
            border: '1px solid #333',
            marginTop: '20px',
            borderRadius: '10px',
            overflow: 'hidden'
        }}>
            {/* Map Section */}
            <div style={{ flex: 1, borderRight: '1px solid #333' }}>
                <MapContainer
                    center={[65, 26]}
                    zoom={5}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        className='map-tiles'
                    />
                    {/* Dark Mode Filter for Map */}
                    <style>{`
                        .leaflet-tile { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
                    `}</style>
                    <LocationPicker onSelect={handleMapClick} />
                    <MapController center={mapFocus} />
                    {selectedPoint && <Marker position={selectedPoint} />}
                    {routePath && <Polyline positions={routePath} color="red" weight={4} dashArray="10, 10" />}
                </MapContainer>
            </div>

            {/* Chat Section */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
                <div style={{
                    flex: 1,
                    padding: '20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    {messages.map((m, i) => (
                        <div key={i} style={{
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            background: m.role === 'user' ? '#333' : '#1a1a2e',
                            color: m.role === 'user' ? '#fff' : '#FFD700',
                            padding: '10px 15px',
                            borderRadius: '10px',
                            maxWidth: '80%',
                            border: m.role === 'assistant' ? '1px solid #FFD700' : 'none',
                            fontSize: '0.9rem',
                            lineHeight: '1.4'
                        }}>
                            {m.content}
                        </div>
                    ))}
                    {loading && <div style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>AI is thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: '15px', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                        placeholder="Type a message..."
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: '#222',
                            border: '1px solid #444',
                            borderRadius: '5px',
                            color: 'white'
                        }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={loading}
                        style={{
                            padding: '10px 20px',
                            background: '#FFD700',
                            color: 'black',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
