
import React from 'react';

export const JourneyControls: React.FC = () => {
    return (
        <div style={{
            position: 'absolute',
            bottom: 30,
            left: 30,
            color: 'rgba(255,255,255,0.7)',
            zIndex: 1000,
            fontSize: '0.9rem',
            pointerEvents: 'none'
        }}>
            <p>Controls:</p>
            <p>⬆️ Accelerate</p>
            <p>⬇️ Brake/Reverse</p>
            <p>⬅️ ➡️ Turn</p>
            <p>C: Autocruise</p>
        </div>
    );
};
