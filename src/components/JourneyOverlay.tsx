
import { useState, useEffect } from 'react';
import type { Event } from '../types';
import type { DifficultyMode } from '../hooks/useCarPhysics';
import type { JourneyState, CarType } from './Journey/types';
import { useJourneyData } from './Journey/useJourneyData';
import { CarSelectionScreen } from './Journey/CarSelectionScreen';
import { DifficultySelectionScreen } from './Journey/DifficultySelectionScreen';
import type { FinalStats } from './Journey/JourneyFinishedScreen';
import { JourneyFinishedScreen } from './Journey/JourneyFinishedScreen';
import { JourneyMap } from './Journey/JourneyMap';
import './JourneyOverlay.css';

type JourneyOverlayProps = {
    events: Event[];
    onClose: () => void;
};

export default function JourneyOverlay({ events, onClose }: JourneyOverlayProps) {
    // Parse URL parameters for direct journey start
    const urlParams = new URLSearchParams(window.location.search);
    const urlCar = urlParams.get('car') as CarType | null;
    const urlDifficulty = urlParams.get('difficulty') as DifficultyMode | null;

    const initialCar = (urlCar || null) as CarType | null;
    const initialDifficulty = (urlDifficulty || null) as DifficultyMode | null;

    // State
    const [selectedCar, setSelectedCar] = useState<CarType | null>(initialCar);
    const [difficulty, setDifficulty] = useState<DifficultyMode | null>(initialDifficulty);
    const [gameState, setGameState] = useState<JourneyState>(
        initialCar && initialDifficulty ? 'LOADING' : 'SELECT_CAR'
    );
    const [finalStats, setFinalStats] = useState<FinalStats | null>(null);

    // Data Hook
    const { geocodedEvents, carManifests } = useJourneyData({
        events,
        selectedCar,
        setFinalStats,
        setGameState
    });

    // Advance to difficulty selection after car is selected
    useEffect(() => {
        if (selectedCar && gameState === 'SELECT_CAR') {
            setGameState('SELECT_DIFFICULTY');
        }
    }, [selectedCar, gameState]);

    // Start traveling after difficulty is selected or when URL params are ready
    useEffect(() => {
        if (difficulty && selectedCar && geocodedEvents.length > 0) {
            if (gameState === 'SELECT_DIFFICULTY' || gameState === 'LOADING') {
                setGameState('TRAVELING');
            }
        }
    }, [difficulty, selectedCar, geocodedEvents.length, gameState]);

    // Handle Finish from Map
    const handleFinish = (stats: any) => {
        setFinalStats(stats);
        setGameState('FINISHED');
    };

    // Render based on state
    if (gameState === 'SELECT_CAR') {
        return (
            <CarSelectionScreen
                carManifests={carManifests}
                onSelectCar={setSelectedCar}
                onClose={onClose}
            />
        );
    }

    if (gameState === 'SELECT_DIFFICULTY') {
        return <DifficultySelectionScreen onSelectDifficulty={setDifficulty} />;
    }

    if (gameState === 'LOADING') {
        return <div className="journey-overlay"><h1>Initializing GPS...</h1></div>;
    }

    if (gameState === 'TRAVELING' && selectedCar && difficulty) {
        return (
            <div className="journey-overlay">
                <JourneyMap
                    geocodedEvents={geocodedEvents}
                    selectedCar={selectedCar}
                    difficulty={difficulty}
                    carManifests={carManifests}
                    onFinish={handleFinish}
                    onClose={onClose}
                />
            </div>
        );
    }

    if (gameState === 'FINISHED' && finalStats) {
        return <JourneyFinishedScreen finalStats={finalStats} onClose={onClose} />;
    }

    // Fallback/Loading state
    return <div className="journey-overlay"><h1>Prepare for Journey...</h1></div>;
}
