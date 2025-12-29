
import React from 'react';
import type { CarType, CarManifest } from './types';
import { AVAILABLE_CARS, CAR_CONFIGS, getCarSpriteUrl } from './types';

interface CarSelectionScreenProps {
    carManifests: Record<string, CarManifest>;
    onSelectCar: (car: CarType) => void;
    onClose: () => void;
}

export const CarSelectionScreen: React.FC<CarSelectionScreenProps> = ({ carManifests, onSelectCar, onClose }) => {
    return (
        <div className="journey-overlay">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Choose Your Vehicle</h1>
                <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {AVAILABLE_CARS.map(car => {
                        const manifest = carManifests[car];
                        const frame = manifest?.frames[1];
                        const scale = CAR_CONFIGS[car].scale;
                        const spriteUrl = getCarSpriteUrl(car);

                        return (
                            <button
                                key={car}
                                onClick={() => onSelectCar(car)}
                                style={{
                                    padding: '30px 40px',
                                    fontSize: '1.2rem',
                                    background: car === 'red' ? '#e74c3c' : '#3498db',
                                    color: 'white',
                                    border: '3px solid ' + (car === 'red' ? '#c0392b' : '#2980b9'),
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'transform 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '15px',
                                    minWidth: '220px',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                <div style={{
                                    height: '100px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {manifest && frame ? (
                                        <div style={{
                                            width: `${Math.round(frame.width * scale * 2.5)}px`,
                                            height: `${Math.round(frame.height * scale * 2.5)}px`,
                                            backgroundImage: `url('${spriteUrl}')`,
                                            backgroundPosition: `-${Math.round(frame.x * scale * 2.5)}px -${Math.round(frame.y * scale * 2.5)}px`,
                                            backgroundSize: `${Math.round(manifest.meta.imageWidth * scale * 2.5)}px ${Math.round(manifest.meta.imageHeight * scale * 2.5)}px`,
                                            backgroundRepeat: 'no-repeat',
                                            imageRendering: 'auto',
                                            transform: 'rotate(0deg)'
                                        }} />
                                    ) : (
                                        <div style={{ fontSize: '3rem' }}>
                                            {car === 'red' ? '🚗' : '🚘'}
                                        </div>
                                    )}
                                </div>
                                <div style={{ textTransform: 'capitalize', fontSize: '1.3rem' }}>
                                    {car} Car
                                </div>
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={onClose}
                    style={{
                        padding: '10px 20px',
                        fontSize: '1rem',
                        background: '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginTop: '20px'
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};
