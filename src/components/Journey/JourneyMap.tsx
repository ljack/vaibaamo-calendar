
import React from 'react';
import { JourneyHUD } from './JourneyHUD';
import { JourneyVisuals } from './JourneyVisuals';
import { JourneyCollectibles } from './JourneyCollectibles';
import { JourneyControls } from './JourneyControls';
import { JourneyMessages } from './JourneyMessages';
import { useJourneyMapLogic } from './useJourneyMapLogic';
import type { DifficultyMode } from '../../hooks/useCarPhysics';
import type { CarType, CarManifest } from './types';
import { getCardinalDirection, getPoiImage } from '../../lib/journeyUtils';
import 'leaflet/dist/leaflet.css';
import '../JourneyOverlay.css';

interface JourneyMapProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocodedEvents: any[];
    selectedCar: CarType;
    difficulty: DifficultyMode;
    carManifests: Record<string, CarManifest>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFinish: (stats: any) => void;
    onClose: () => void;
    demoMode?: boolean;
}

export const JourneyMap: React.FC<JourneyMapProps> = ({
    geocodedEvents,
    selectedCar,
    difficulty,
    carManifests,
    onFinish,
    onClose,
    demoMode = false
}) => {
    const {
        mapContainerRef,
        carState,
        bearing,
        distanceTraveled,
        message,
        visualEvent,
        showIdleWarning,
        idleCountdown,
        collectedEvents
    } = useJourneyMapLogic({
        geocodedEvents,
        selectedCar,
        difficulty,
        carManifests,
        onFinish,
        demoMode
    });

    return (
        <div className="journey-map">
            {/* Map Container */}
            <div
                ref={mapContainerRef}
                className="journey-map-container"
                style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
            />

            {/* Visual Event Overlay */}
            <JourneyVisuals visualEvent={visualEvent} />

            {/* Collectibles */}
            <JourneyCollectibles collectedEvents={collectedEvents} getPoiImage={getPoiImage} />

            {/* Dashboard / HUD */}
            <JourneyHUD
                carState={carState}
                bearing={bearing}
                distanceTraveled={distanceTraveled}
                getCardinalDirection={getCardinalDirection}
            />

            {/* Controls Help */}
            <JourneyControls />

            {/* Exit Button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    zIndex: 2000,
                    background: 'rgba(255, 68, 68, 0.8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                }}
            >
                EXIT
            </button>

            {/* Messages & Warnings */}
            <JourneyMessages
                message={message}
                showIdleWarning={showIdleWarning}
                idleCountdown={idleCountdown}
            />
        </div>
    );
};
