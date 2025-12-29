
import React from 'react';
import type { DifficultyMode } from '../../hooks/useCarPhysics';

interface DifficultySelectionScreenProps {
    onSelectDifficulty: (mode: DifficultyMode) => void;
}

export const DifficultySelectionScreen: React.FC<DifficultySelectionScreenProps> = ({ onSelectDifficulty }) => {
    return (
        <div className="journey-overlay">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <h1>Select Difficulty</h1>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={() => onSelectDifficulty('easy')}
                        style={{
                            padding: '15px 30px',
                            fontSize: '1.1rem',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🟢 Easy (Unlimited Fuel)
                    </button>
                    <button
                        onClick={() => onSelectDifficulty('normal')}
                        style={{
                            padding: '15px 30px',
                            fontSize: '1.1rem',
                            background: '#FF9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🟠 Normal (Limited Fuel)
                    </button>
                    <button
                        onClick={() => onSelectDifficulty('hard')}
                        style={{
                            padding: '15px 30px',
                            fontSize: '1.1rem',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔴 Hard (Very Limited Fuel)
                    </button>
                </div>
            </div>
        </div>
    );
};
