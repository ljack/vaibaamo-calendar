
import React from 'react';

interface KeyConfig {
    note: string;
    freq: number;
    type: 'white' | 'black';
}

// Range: C3 to F4 to cover the song's notes
const KEYS: KeyConfig[] = [
    { note: 'C3', freq: 130.81, type: 'white' },
    { note: 'C#3', freq: 138.59, type: 'black' },
    { note: 'D3', freq: 146.83, type: 'white' },
    { note: 'Eb3', freq: 155.56, type: 'black' },
    { note: 'E3', freq: 164.81, type: 'white' },
    { note: 'F3', freq: 174.61, type: 'white' },
    { note: 'Gb3', freq: 185.00, type: 'black' },
    { note: 'G3', freq: 196.00, type: 'white' },
    { note: 'Ab3', freq: 207.65, type: 'black' },
    { note: 'A3', freq: 220.00, type: 'white' },
    { note: 'Bb3', freq: 233.08, type: 'black' },
    { note: 'B3', freq: 246.94, type: 'white' },
    { note: 'C4', freq: 261.63, type: 'white' },
    { note: 'C#4', freq: 277.18, type: 'black' },
    { note: 'D4', freq: 293.66, type: 'white' },
    { note: 'Eb4', freq: 311.13, type: 'black' },
    { note: 'E4', freq: 329.63, type: 'white' },
    { note: 'F4', freq: 349.23, type: 'white' }
];

interface PianoKeyboardProps {
    activeFreq: number;
    onPlayNote: (freq: number) => void;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ activeFreq, onPlayNote }) => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            background: '#111',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            position: 'relative',
            marginTop: '30px'
        }}>
            <style>{`
                .piano-key {
                    transition: transform 0.1s, background-color 0.1s;
                }
                .piano-key:active {
                    transform: translateY(2px);
                }
                .key-white {
                    width: 40px;
                    height: 140px;
                    background: white;
                    border: 1px solid #333;
                    border-radius: 0 0 5px 5px;
                    z-index: 1;
                    cursor: pointer;
                }
                .key-white.active {
                    background: #FFE81F;
                    box-shadow: 0 0 20px #FFE81F;
                }
                .key-black {
                    width: 24px;
                    height: 90px;
                    background: #111;
                    border: 1px solid #000;
                    border-radius: 0 0 3px 3px;
                    z-index: 2;
                    margin-left: -12px;
                    margin-right: -12px;
                    cursor: pointer;
                    position: absolute; 
                }
            `}</style>
            <div style={{ position: 'relative', height: '140px', width: 'auto', display: 'flex' }}>
                {KEYS.map((key) => {
                    const isActive = Math.abs(key.freq - activeFreq) < 1;

                    if (key.type === 'white') {
                        return (
                            <div
                                key={key.note}
                                className={`piano-key key-white ${isActive ? 'active' : ''}`}
                                onMouseDown={() => onPlayNote(key.freq)}
                                style={{
                                    background: isActive ? '#FFE81F' : 'white'
                                }}
                            />
                        );
                    }
                    return null;
                })}

                {/* Render Black Keys Overlay */}
                {KEYS.map((key, index) => {
                    if (key.type === 'black') {
                        const isActive = Math.abs(key.freq - activeFreq) < 1;

                        // Determine position. C# is between C and D.
                        const whiteKeysBefore = KEYS.slice(0, index).filter(k => k.type === 'white').length;

                        // Each white key is 40px (+2px border approx? No standard is 42 here).
                        // 40px width + 2px border = 42px per key block? 
                        // Styles say border 1px, width 40. Total box model width depends on box-sizing.
                        // Assuming standard, width is 40 + 2 = 42.
                        const leftPos = (whiteKeysBefore * 42) - 14; // Center on the crack

                        return (
                            <div
                                key={key.note}
                                className={`piano-key key-black`}
                                onMouseDown={() => onPlayNote(key.freq)}
                                style={{
                                    left: `${leftPos}px`,
                                    position: 'absolute',
                                    top: 0,
                                    background: isActive ? '#FFE81F' : '#111',
                                    boxShadow: isActive ? '0 0 15px #FFE81F' : 'none'
                                }}
                            />
                        );
                    }
                    return null;
                })}
            </div>
        </div>
    );
};
