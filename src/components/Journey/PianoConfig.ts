export interface KeyConfig {
    note: string;
    freq: number;
    type: 'white' | 'black';
}

// Range: C3 to F4 to cover the song's notes
export const PIANO_KEYS: KeyConfig[] = [
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
