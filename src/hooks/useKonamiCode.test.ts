import { renderHook, act } from '@testing-library/react';
import { useKonamiCode } from './useKonamiCode';
import { describe, it, expect } from 'vitest';

describe('useKonamiCode', () => {
    it('should return false initially', () => {
        const { result } = renderHook(() => useKonamiCode());
        expect(result.current).toBe(false);
    });

    it('should return true after correct sequence', () => {
        const { result } = renderHook(() => useKonamiCode());

        const sequence = [
            'ArrowUp', 'ArrowUp',
            'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight',
            'ArrowLeft', 'ArrowRight',
            'b', 'a'
        ];

        act(() => {
            sequence.forEach(key => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key }));
            });
        });

        expect(result.current).toBe(true);
    });

    it('should reset on wrong key', () => {
        const { result } = renderHook(() => useKonamiCode());

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // Wrong!
        });

        expect(result.current).toBe(false);

        // Try full sequence again to ensure it reset
        const sequence = [
            'ArrowUp', 'ArrowUp',
            'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight',
            'ArrowLeft', 'ArrowRight',
            'b', 'a'
        ];

        act(() => {
            sequence.forEach(key => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key }));
            });
        });

        expect(result.current).toBe(true);
    });
});
