
import React from 'react';

export interface FinalStats {
    distance: number;
    score: number;
    reason: 'COMPLETED' | 'OUT_OF_FUEL' | 'INSUFFICIENT_EVENTS';
    fuel?: number;
    efficiency?: string;
    message?: string;
}

interface JourneyFinishedScreenProps {
    finalStats: FinalStats;
    onClose: () => void;
}

export const JourneyFinishedScreen: React.FC<JourneyFinishedScreenProps> = ({ finalStats, onClose }) => {
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
