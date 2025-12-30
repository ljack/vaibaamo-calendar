
import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any


interface JourneyHUDProps {
    carState: any; // Using any for now to match usage, ideally strict type
    bearing: number;
    distanceTraveled: number;
    getCardinalDirection: (angle: number) => string;
}

export const JourneyHUD: React.FC<JourneyHUDProps> = ({ carState, bearing, distanceTraveled, getCardinalDirection }) => {
    return (
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
    );
};
