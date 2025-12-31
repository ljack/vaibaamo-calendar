
import React from 'react';

import { PIANO_KEYS } from './PianoConfig';


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
                {PIANO_KEYS.map((key) => {
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
                {PIANO_KEYS.map((key, index) => {
                    if (key.type === 'black') {
                        const isActive = Math.abs(key.freq - activeFreq) < 1;

                        // Determine position. C# is between C and D.
                        const whiteKeysBefore = PIANO_KEYS.slice(0, index).filter(k => k.type === 'white').length;

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
