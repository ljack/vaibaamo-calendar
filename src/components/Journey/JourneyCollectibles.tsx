
import React from 'react';
import type { PoiType } from '../../lib/journeyUtils';

interface CollectibleEvent {
    type: PoiType;
    message: string;
    timestamp: number;
    location: { lat: number; lon: number };
}

interface JourneyCollectiblesProps {
    collectedEvents: CollectibleEvent[];
    getPoiImage: (type: PoiType) => string;
}

export const JourneyCollectibles: React.FC<JourneyCollectiblesProps> = ({ collectedEvents, getPoiImage }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 80,
            right: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 1900,
            pointerEvents: 'none'
        }}>
            {collectedEvents.map((evt, i) => (
                <div key={i} className="collectible-item" style={{
                    width: '40px',
                    height: '40px',
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(255,255,255,0.3)',
                    animation: 'fadeIn 0.5s ease-out',
                    pointerEvents: 'auto',
                    cursor: 'help',
                    position: 'relative'
                }}>
                    <img
                        src={getPoiImage(evt.type)}
                        alt={evt.type}
                        style={{
                            width: '28px',
                            height: '28px',
                            imageRendering: 'pixelated'
                        }}
                    />
                    <div className="collectible-tooltip">
                        <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                            {evt.type.replace('_', ' ')}
                        </div>
                        <div style={{ marginBottom: '6px', fontSize: '0.9rem', lineHeight: '1.2' }}>
                            {evt.message}
                        </div>
                        <div style={{ color: '#aaa', fontSize: '0.7rem', borderTop: '1px solid #444', paddingTop: '4px' }}>
                            📍 {evt.location.lat.toFixed(3)}, {evt.location.lon.toFixed(3)}
                        </div>
                    </div>
                </div>
            ))}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0); }
                    to { opacity: 1; transform: scale(1); }
                }
                .collectible-tooltip {
                    visibility: hidden;
                    opacity: 0;
                    position: absolute;
                    right: 50px;
                    top: 50%;
                    transform: translateY(-50%) translateX(10px);
                    background: rgba(10, 10, 15, 0.95);
                    border: 1px solid #FFD700;
                    padding: 12px;
                    border-radius: 8px;
                    width: 200px;
                    color: white;
                    z-index: 2000;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    pointer-events: none;
                }
                .collectible-item:hover {
                    border-color: #FFD700 !important;
                    background: rgba(255, 215, 0, 0.2) !important;
                    transform: scale(1.1);
                    transition: all 0.2s ease;
                }
                .collectible-item:hover .collectible-tooltip {
                    visibility: visible;
                    opacity: 1;
                    transform: translateY(-50%) translateX(0);
                }
            `}</style>
        </div>
    );
};
