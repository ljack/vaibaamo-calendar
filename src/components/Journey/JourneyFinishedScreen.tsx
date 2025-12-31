
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { PoiType } from '../../lib/journeyUtils';
import { playSpaceTheme, playNote } from '../../lib/audioUtils';

import { PianoKeyboard } from './PianoKeyboard';
import { PIANO_KEYS } from './PianoConfig';
import { JourneyChat } from './JourneyChat';
import type { JourneyChatRef } from './JourneyChat';

export interface FinalStats {
    distance: number;
    score: number;
    reason: 'COMPLETED' | 'OUT_OF_FUEL' | 'INSUFFICIENT_EVENTS';
    fuel?: number;
    efficiency?: string;
    message?: string;
    isDemo?: boolean;
    collectedEvents?: { type: PoiType; message: string; timestamp: number }[];
    routePlaces?: string[];
}

interface JourneyFinishedScreenProps {
    finalStats: FinalStats;
    onClose: () => void;
}

export const JourneyFinishedScreen: React.FC<JourneyFinishedScreenProps> = ({ finalStats, onClose }) => {
    const [story, setStory] = useState<string | null>(null);
    const [loadingStory, setLoadingStory] = useState(false);
    const [activeFreq, setActiveFreq] = useState<number>(0);
    const [showChat, setShowChat] = useState(false);

    const [stopMusicRef, setStopMusicRef] = useState<(() => void) | undefined>(undefined);

    useEffect(() => {
        if (story) {
            // Include callback to visualize notes on piano
            const stop = playSpaceTheme((freq) => setActiveFreq(freq));
            setStopMusicRef(() => stop);
            // Cleanup function for this effect specifically
            return () => {
                if (stop) stop();
            };
        }
    }, [story]);

    // Cleanup on unmount (redundant due to effect return but good for safety)
    useEffect(() => {
        return () => {
            if (stopMusicRef) stopMusicRef();
        };
    }, []);

    useEffect(() => {
        if (finalStats.reason === 'COMPLETED' && finalStats.collectedEvents && finalStats.collectedEvents.length > 0 && !story && !loadingStory) {
            setLoadingStory(true);
            const fetchStory = async () => {
                try {
                    const { data, error } = await supabase.functions.invoke('generate-journey-story', {
                        body: {
                            events: finalStats.collectedEvents,
                            route: finalStats.routePlaces
                        }
                    });
                    if (error) {
                        console.error('Error fetching story:', error);
                    } else if (data?.story) {
                        setStory(data.story);
                    }
                } catch (err) {
                    console.error('Failed to fetch story:', err);
                } finally {
                    setLoadingStory(false);
                }
            };
            fetchStory();
        }
    }, [finalStats, story, loadingStory]);

    // Track AI playback timers to allow interruption
    const melodyTimersRef = useRef<number[]>([]);

    const ENHARMONIC_MAP: Record<string, string> = {
        'Db': 'C#',
        'D#': 'Eb',
        'F#': 'Gb',
        'G#': 'Ab',
        'A#': 'Bb'
    };

    const playMelody = (notes: string[]) => {
        // Stop background theme if playing
        if (stopMusicRef) {
            stopMusicRef();
            setStopMusicRef(undefined); // Clear ref so we don't try to stop again
        }

        // Clear any previous melody timers
        melodyTimersRef.current.forEach(timer => window.clearTimeout(timer));
        melodyTimersRef.current = [];

        let delay = 0;
        notes.forEach(rawNote => {
            // Normalize note (handle basic enharmonics)
            let note = rawNote;
            // specific octaves
            Object.entries(ENHARMONIC_MAP).forEach(([from, to]) => {
                if (note.includes(from)) {
                    note = note.replace(from, to);
                }
            });

            const keyConfig = PIANO_KEYS.find(k => k.note === note);
            if (keyConfig) {
                const timerId = window.setTimeout(() => {
                    playNote(keyConfig.freq, 0.4);
                    setActiveFreq(keyConfig.freq);
                    setTimeout(() => setActiveFreq(0), 300);
                }, delay);
                melodyTimersRef.current.push(timerId);
                delay += 500; // Half second spacing
            }
        });
    };

    // Note tracking for "Jam Session"
    const noteBufferRef = useRef<{ note: string, time: number }[]>([]);
    const noteTimerRef = useRef<number | null>(null);
    const chatRef = useRef<JourneyChatRef>(null);

    const handlePianoPlay = (freq: number) => {
        // If user starts playing, STOP the AI's current jamming immediately
        if (melodyTimersRef.current.length > 0) {
            melodyTimersRef.current.forEach(timer => window.clearTimeout(timer));
            melodyTimersRef.current = [];
            setActiveFreq(0); // Reset visual key press
        }

        // Play the sound (now with space-synth default)
        playNote(freq, 0.5);
        setActiveFreq(freq);
        setTimeout(() => setActiveFreq(0), 300);

        // Record the note
        const keyConfig = PIANO_KEYS.find(k => k.freq === freq);
        if (keyConfig) {
            noteBufferRef.current.push({ note: keyConfig.note, time: Date.now() });

            // Reset timer
            if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);

            // If user stops playing for 2 seconds, submit the melody to AI
            noteTimerRef.current = window.setTimeout(() => {
                if (noteBufferRef.current.length > 0 && chatRef.current) {
                    const notesPlayed = noteBufferRef.current.map(n => n.note).join(', ');
                    const msg = `I just played this melody on the piano: [[MUSIC: ${notesPlayed}]]`;

                    // If chat is not open, maybe we should open it? 
                    // For now, let's only send if chat is open or send and notify?
                    // Let's force open chat if they are jamming!
                    if (!showChat) setShowChat(true);

                    // Slightly delay sending to ensure UI is ready
                    window.setTimeout(() => {
                        chatRef.current?.sendMessage(msg);
                    }, 100);

                    noteBufferRef.current = []; // Clear buffer
                }
            }, 2000);
        }
    };

    if (finalStats?.reason === 'COMPLETED') {
        return (
            <div className="journey-overlay">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    justifyContent: 'flex-start', // Top align to fit scroll
                    alignItems: 'center',
                    height: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px',
                    overflowY: 'auto'
                }}>
                    <h1 style={{ fontSize: '3rem', margin: '20px 0 0 0' }}>🎉 JOURNEY COMPLETE!</h1>

                    {!showChat && (
                        <>
                            <div style={{
                                background: 'rgba(0,0,0,0.7)',
                                padding: '20px',
                                borderRadius: '10px',
                                textAlign: 'center',
                                minWidth: '400px'
                            }}>
                                <p style={{ fontSize: '1.5rem', margin: '5px 0' }}>📍 Distance: <strong>{finalStats.distance.toFixed(1)} km</strong></p>
                                <p style={{ fontSize: '1.5rem', margin: '5px 0' }}>⭐ Score: <strong>{Math.round(finalStats.score)}</strong></p>
                                <p style={{ fontSize: '1.5rem', margin: '5px 0' }}>⚡ Fuel Remaining: <strong>{finalStats.fuel?.toFixed(1)}%</strong></p>
                                <p style={{ fontSize: '1.3rem', margin: '5px 0', color: '#FFD700' }}>🏆 Efficiency: <strong>{finalStats.efficiency}</strong> pts/km</p>
                            </div>

                            <PianoKeyboard activeFreq={activeFreq} onPlayNote={handlePianoPlay} />

                            {finalStats.isDemo && (
                                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                    <p style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '5px' }}>You reached Nuorgam! Check out the real adventure:</p>
                                    <a
                                        href="https://kaldoaiviultratrail.fi/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#FFD700',
                                            fontSize: '1.5rem',
                                            fontWeight: 'bold',
                                            textDecoration: 'none',
                                            borderBottom: '2px solid #FFD700',
                                            paddingBottom: '2px'
                                        }}
                                    >
                                        🏔️ Kaldoaivi Ultra Trail
                                    </a>
                                </div>
                            )}

                            {/* Star Wars Story Section */}
                            {(loadingStory || story) && (
                                <div style={{
                                    width: '100%',
                                    height: '300px', // Reduced height
                                    perspective: '400px',
                                    overflow: 'hidden',
                                    background: '#000',
                                    border: '2px solid #FFE81F',
                                    borderRadius: '10px',
                                    position: 'relative',
                                    marginTop: '10px'
                                }}>
                                    {loadingStory && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            color: '#FFE81F',
                                            fontSize: '1.5rem',
                                            textAlign: 'center'
                                        }}>
                                            <p>Computing Hyperdrive Coordinates...</p>
                                            <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>Simulating Writer's Block...</p>
                                        </div>
                                    )}

                                    {story && !loadingStory && (
                                        <div className="crawl-container">
                                            <div className="crawl">
                                                <div className="title">
                                                    <p>Episode I</p>
                                                    <h1>THE FINNISH ADVENTURE</h1>
                                                </div>
                                                {story.split('\n').map((para, i) => (
                                                    <p key={i}>{para}</p>
                                                ))}
                                            </div>
                                            <style>{`
                                                .crawl-container {
                                                    display: flex;
                                                    justify-content: center;
                                                    position: relative;
                                                    height: 100%;
                                                    color: #FFE81F;
                                                    font-family: "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif;
                                                    font-size: 200%; 
                                                    font-weight: 600;
                                                    letter-spacing: 2px;
                                                    line-height: 150%;
                                                    text-align: justify;
                                                    transform-origin: 50% 100%; 
                                                    perspective: 300px;
                                                }
                                                .crawl {
                                                    position: relative;
                                                    top: 0;
                                                    animation: crawl 45s linear infinite; 
                                                    transform: rotateX(25deg) translateZ(0); /* More tilt */
                                                    width: 80%;
                                                }
                                                .title {
                                                    text-align: center;
                                                    margin-bottom: 50px;
                                                }
                                                .title h1 {
                                                    margin: 0 0 50px;
                                                    text-transform: uppercase;
                                                }
                                                @keyframes crawl {
                                                    0% {
                                                        top: 100%; /* Start below */
                                                        transform: rotateX(25deg) translateZ(0);
                                                        opacity: 1;
                                                    }
                                                    80% {
                                                        opacity: 1;
                                                    }
                                                    100% { 
                                                        top: -1500px; /* End far away */
                                                        transform: rotateX(25deg) translateZ(-500px); /* Recede */
                                                        opacity: 0;
                                                    }
                                                }
                                            `}</style>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '20px', paddingBottom: '20px' }}>
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
                                    Finish
                                </button>
                                <button
                                    onClick={() => setShowChat(true)}
                                    style={{
                                        padding: '15px 40px',
                                        fontSize: '1.2rem',
                                        background: '#2196F3', // Blue
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <span>💬</span> Chat with Ship AI
                                </button>
                            </div>
                        </>
                    )}

                    {showChat && (
                        <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
                                <h2 style={{ color: 'white' }}>Ship Intelligence Interface</h2>
                                <button
                                    onClick={() => setShowChat(false)}
                                    style={{ background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '5px 10px' }}
                                >
                                    Back to Stats
                                </button>
                            </div>
                            <JourneyChat
                                ref={chatRef}
                                context={{
                                    route: finalStats.routePlaces || [],
                                    events: finalStats.collectedEvents || [],
                                    stats: { distance: finalStats.distance, score: finalStats.score }
                                }}
                                onPlayMusic={playMelody}
                            />
                            <div style={{ marginTop: '20px' }}>
                                <PianoKeyboard activeFreq={activeFreq} onPlayNote={handlePianoPlay} />
                            </div>
                        </div>
                    )}

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
        // Fallback
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
                        Close
                    </button>
                </div>
            </div>
        );
    }
};
