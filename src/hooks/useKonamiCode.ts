import { useEffect, useState, useRef } from 'react';

const KONAMI_CODE = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
];

export function useKonamiCode() {
    const [triggered, setTriggered] = useState(false);
    const index = useRef(0);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (triggered) return;

            if (event.key === KONAMI_CODE[index.current]) {
                if (index.current === KONAMI_CODE.length - 1) {
                    setTriggered(true);
                } else {
                    index.current += 1;
                }
            } else {
                // If the key matches the first key of the sequence, restart from 1
                // Otherwise reset to 0
                if (event.key === KONAMI_CODE[0]) {
                    index.current = 1;
                } else {
                    index.current = 0;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [triggered]);

    return triggered;
}
