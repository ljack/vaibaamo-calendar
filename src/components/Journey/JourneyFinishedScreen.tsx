
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PoiType } from '../../lib/journeyUtils';
import { playSpaceTheme, playNote } from '../../lib/audioUtils';
import { PianoKeyboard } from './PianoKeyboard';

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

    useEffect(() => {
        let stopMusic: (() => void) | undefined;
        if (story) {
            stopMusic = playSpaceTheme((freq) => setActiveFreq(freq));
        }
        return () => {
            if (stopMusic) stopMusic();
        }
    }, [story]);

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

    const handlePianoPlay = (freq: number) => {
        playNote(freq, 0.5);
        setActiveFreq(freq);
        // Reset active key after a short delay for visual feedback if manually pressed
        setTimeout(() => setActiveFreq(0), 300);
    };

    if (finalStats?.reason === 'COMPLETED') {
        return (
            <div className="journey-overlay">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px', // Reduced gap to fit piano
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px',
                    overflowY: 'auto' // Allow scrolling if height is too small
                }}>
                    <h1 style={{ fontSize: '3rem', margin: 0 }}>🎉 JOURNEY COMPLETE!</h1>
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
