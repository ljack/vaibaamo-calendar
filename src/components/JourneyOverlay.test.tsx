import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import JourneyOverlay from './JourneyOverlay';
import { useState, useEffect } from 'react';

// Mock dependencies
vi.mock('../lib/geocode', () => ({
    geocodeLocation: vi.fn(),
}));

vi.mock('../lib/journeyUtils', () => ({
    getDistance: vi.fn(() => 10), // Default distance
    generateNearbyPOI: vi.fn(() => ({ message: 'Test POI', type: 'REINDEER' })),
    generateCurvedPath: vi.fn(() => [{ lat: 10, lon: 10 }, { lat: 10.1, lon: 10.1 }]),
    getCardinalDirection: vi.fn(() => 'N'),
    getPoiImage: vi.fn(() => 'test.png'),
    POI_DEFINITIONS: [{ message: "Test POI", type: 'REINDEER' }]
}));

vi.mock('../hooks/useCarPhysics', () => ({
    useCarPhysics: vi.fn(),
}));

// Mock Leaflet loader
const mockMap = {
    setView: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: vi.fn(),
    panTo: vi.fn(),
    getMaxZoom: vi.fn().mockReturnValue(20),
    getContainer: vi.fn().mockReturnValue(document.createElement('div')),
    latLngToLayerPoint: vi.fn().mockReturnValue({ x: 0, y: 0 }),
};

const mockMarker = {
    bindPopup: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(),
    getElement: vi.fn(() => document.createElement('div')),
};

const mockPolyline = {
    addTo: vi.fn().mockReturnThis(),
};

const mockL = {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    marker: vi.fn(() => mockMarker),
    polyline: vi.fn(() => mockPolyline),
    divIcon: vi.fn(() => 'div-icon'),
    canvas: vi.fn(),
};

vi.mock('../lib/leafletLoader', () => ({
    loadLeaflet: vi.fn(() => Promise.resolve(mockL)),
}));

import { geocodeLocation } from '../lib/geocode';
import { useCarPhysics } from '../hooks/useCarPhysics';

describe('JourneyOverlay', () => {
    const mockEvents = [
        {
            id: '1',
            title: 'Event 1',
            location: 'Loc 1',
            start_time: '2023-01-01',
            end_time: '2023-01-01',
            description: 'Desc 1',
            max_participants: 10,
            created_at: '2023-01-01',
        },
        {
            id: '2',
            title: 'Event 2',
            location: 'Loc 2',
            start_time: '2023-01-02',
            end_time: '2023-01-02',
            description: 'Desc 2',
            max_participants: 10,
            created_at: '2023-01-01',
        },
    ];
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks
        (geocodeLocation as any).mockResolvedValue({ lat: 10, lon: 10 });
        (useCarPhysics as any).mockReturnValue([
            { speed: 100, fuel: 100, distanceTraveled: 0, score: 0, isBroken: false }, // default carState
            { accelerate: vi.fn(), brake: vi.fn(), repair: vi.fn() } // cardControls
        ]);

        // Mock fetch for car manifests
        const mockFetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    meta: { image: 'test.png', imageWidth: 100, imageHeight: 100, frameCount: 2 },
                    frames: [{ x: 0, y: 0, width: 50, height: 50 }, { x: 50, y: 0, width: 50, height: 50 }]
                }),
            })
        );
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('renders car selection screen initially', async () => {
        render(<JourneyOverlay events={mockEvents as any} onClose={mockOnClose} />);

        await waitFor(() => {
            expect(screen.getByText('Choose Your Vehicle')).toBeInTheDocument();
        });

        expect(screen.getByText('red Car')).toBeInTheDocument();
        expect(screen.getByText('blue Car')).toBeInTheDocument();
    });

    it('allows car selection and proceeds to difficulty selection', async () => {
        render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        await waitFor(() => expect(screen.getByText('Choose Your Vehicle')).toBeInTheDocument());
        fireEvent.click(screen.getByText('red Car'));

        await waitFor(() => {
            expect(screen.getByText('Select Difficulty')).toBeInTheDocument();
        });
    });

    it('initializes map and starts traveling after selections', async () => {
        render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        await waitFor(() => expect(screen.getByText('Choose Your Vehicle')).toBeInTheDocument());
        fireEvent.click(screen.getByText('red Car'));

        await waitFor(() => expect(screen.getByText('Select Difficulty')).toBeInTheDocument());
        fireEvent.click(screen.getByText(/Normal/i));

        await waitFor(() => {
            expect(geocodeLocation).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(mockL.map).toHaveBeenCalled();
        });
    });

    it('handles out of fuel game over state', async () => {
        (useCarPhysics as any).mockReturnValue([
            { speed: 0, fuel: 0, distanceTraveled: 10, score: 50, isBroken: false },
            { accelerate: vi.fn(), brake: vi.fn(), repair: vi.fn() }
        ]);

        render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        await waitFor(() => expect(screen.getByText('Choose Your Vehicle')).toBeInTheDocument());
        fireEvent.click(screen.getByText('red Car'));
        await waitFor(() => expect(screen.getByText('Select Difficulty')).toBeInTheDocument());
        fireEvent.click(screen.getByText(/Normal/i));

        await waitFor(() => {
            expect(screen.getByText('⛽ OUT OF FUEL!')).toBeInTheDocument();
        });
    });

    it('renders completion screen when journey is not available (insufficient events)', async () => {
        (geocodeLocation as any).mockResolvedValue(null);
        render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        await waitFor(() => expect(screen.getByText('Choose Your Vehicle')).toBeInTheDocument());
        fireEvent.click(screen.getByText('red Car'));

        await waitFor(() => {
            expect(screen.getByText('⚠️ Journey Not Available')).toBeInTheDocument();
        });
    });

    it.skip('renders completion screen when journey finishes (Victory)', async () => {
        vi.useFakeTimers();
        const { getDistance } = await import('../lib/journeyUtils');

        // Mock distance to decrease to 0 to simulate arrival
        (getDistance as any).mockReturnValue(0);

        // Fake hook to simulate physics loop and trigger re-renders
        // We use the top-level useState/useEffect imports now

        const useFakeCarPhysics = () => {
            const [state, setState] = useState({
                speed: 100,
                fuel: 100,
                distanceTraveled: 10,
                score: 0,
                isBroken: false
            });

            useEffect(() => {
                const timer = setInterval(() => {
                    setState(prev => ({
                        ...prev,
                        distanceTraveled: prev.distanceTraveled + 0.1
                    }));
                }, 100);
                return () => clearInterval(timer);
            }, []);

            return [state, { accelerate: vi.fn(), brake: vi.fn(), repair: vi.fn() }];
        };

        (useCarPhysics as any).mockImplementation(useFakeCarPhysics);

        render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        // Start Journey
        await waitFor(() => fireEvent.click(screen.getByText('red Car')));
        await waitFor(() => fireEvent.click(screen.getByText(/Normal/i)));

        // Wait for Map Init
        await waitFor(() => {
            expect(mockL.map).toHaveBeenCalled();
        });

        // 1. Loop runs -> Arrives immediately.
        await act(async () => {
            vi.advanceTimersByTime(500);
        });

        // 2. Wait for arrival timeout (3000ms)
        await act(async () => {
            vi.advanceTimersByTime(3500);
        });

        // 3. Travel to Event 2
        await act(async () => {
            vi.advanceTimersByTime(500);
        });

        // 4. Wait for potential cleanup/finish
        await act(async () => {
            vi.advanceTimersByTime(3500);
        });

        await waitFor(() => {
            expect(screen.getByText('🎉 JOURNEY COMPLETE!')).toBeInTheDocument();
        }, { timeout: 5000 });

        expect(screen.getByText('Efficiency:')).toBeInTheDocument();

        vi.useRealTimers();
    }, 10000);

    it('handles blue car selection and rendering', async () => {
        render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);
        await waitFor(() => fireEvent.click(screen.getByText('blue Car')));
        await waitFor(() => expect(screen.getByText('Select Difficulty')).toBeInTheDocument());

        fireEvent.click(screen.getByText(/Normal/i));

        await waitFor(() => {
            expect(mockL.map).toHaveBeenCalled();
        });

        // Verify blue car specific logic call or divIcon usage
        expect(mockL.divIcon).toHaveBeenCalledWith(expect.objectContaining({
            html: expect.stringContaining('blue_car')
        }));
    });

    it('handles interaction with map and updates marker', async () => {
        // Use variable to control object identity changes
        let currentState = { speed: 100, fuel: 100, distanceTraveled: 0, score: 0, isBroken: false };
        const stableControls = { accelerate: vi.fn(), brake: vi.fn(), repair: vi.fn() };

        (useCarPhysics as any).mockImplementation(() => [
            currentState,
            stableControls
        ]);

        const { rerender } = render(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        await waitFor(() => expect(screen.getByText('Choose Your Vehicle')).toBeInTheDocument());
        fireEvent.click(screen.getByText('red Car'));

        await waitFor(() => expect(screen.getByText('Select Difficulty')).toBeInTheDocument());
        fireEvent.click(screen.getByText(/Normal/i));

        await waitFor(() => {
            expect(mockL.map).toHaveBeenCalled();
        });

        // Update state to trigger effect on re-render
        currentState = { ...currentState };

        // Force re-render to trigger the game loop effect again now that map is ready
        rerender(<JourneyOverlay events={mockEvents} onClose={mockOnClose} />);

        await waitFor(() => {
            expect(mockMarker.setLatLng).toHaveBeenCalled();
        });
    });
});
