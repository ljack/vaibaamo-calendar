
import React from 'react';

interface JourneyMessagesProps {
    message: string;
    showIdleWarning: boolean;
    idleCountdown: number;
}

export const JourneyMessages: React.FC<JourneyMessagesProps> = ({ message, showIdleWarning, idleCountdown }) => {
    return (
        <>
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
                    <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>Auto-Pilot in: <strong>{idleCountdown}s</strong></p>
                    <p style={{ fontSize: '1.2rem', margin: '10px 0', opacity: 0.9 }}>Press ⬆️ to Accelerate</p>
                    <p style={{ fontSize: '1.5rem', margin: '10px 0' }}>Press <strong>"C"</strong> for Autocruise</p>
                    <style>{`
                        @keyframes pulse {
                            0% { transform: translate(-50%, -50%) scale(1); }
                            50% { transform: translate(-50%, -50%) scale(1.05); }
                            10% { transform: translate(-50%, -50%) scale(1); }
                        }
                    `}</style>
                </div>
            )}
        </>
    );
};
