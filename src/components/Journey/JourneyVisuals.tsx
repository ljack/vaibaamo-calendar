
import React from 'react';

interface JourneyVisualsProps {
    visualEvent: { image: string; active: boolean; title?: string } | null;
}

export const JourneyVisuals: React.FC<JourneyVisualsProps> = ({ visualEvent }) => {
    if (!visualEvent || !visualEvent.active) return null;

    return (
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
                width: '300px',
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
    );
};
