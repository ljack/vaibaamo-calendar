
import { useState, useEffect, useMemo, useRef } from 'react';
import type { Event } from '../../types';
import { geocodeLocation } from '../../lib/geocode';
import type { CarType, CarManifest, JourneyState } from './types';

interface UseJourneyDataProps {
    events: Event[];
    selectedCar: CarType | null;
    setFinalStats: (stats: any) => void;
    setGameState: (state: JourneyState) => void;
}

export const useJourneyData = ({ events, selectedCar, setFinalStats, setGameState }: UseJourneyDataProps) => {
    const [geocodedEvents, setGeocodedEvents] = useState<any[]>([]);
    const [carManifests, setCarManifests] = useState<Record<string, CarManifest>>({});
    const positionRef = useRef<{ lat: number, lon: number } | null>(null);

    const eventsValid = useMemo(
        () => events.filter((event) => event.location?.trim()),
        [events]
    );

    // 0. Load Car Manifests
    useEffect(() => {
        const loadManifests = async () => {
            const cars = ['red', 'blue'];
            const newManifests: Record<string, CarManifest> = {};
            for (const car of cars) {
                try {
                    const response = await fetch(`/${car}_car.json`);
                    if (response.ok) {
                        const data = await response.json();
                        newManifests[car] = data;
                    }
                } catch (err) {
                    console.error(`[JourneyOverlay] Failed to load ${car} manifest:`, err);
                }
            }
            setCarManifests(prev => ({ ...prev, ...newManifests }));
        };
        loadManifests();
    }, []);

    // 1. Geocode Events
    useEffect(() => {
        if (!selectedCar || eventsValid.length === 0) {
            return;
        }

        const fetchLocations = async () => {
            const results = [];
            const eventsWithLocations = eventsValid.filter(event =>
                event.location &&
                event.location.trim() &&
                event.location.toLowerCase() !== 'ei sijaintia'
            );

            for (const event of eventsWithLocations) {
                try {
                    const location = event.location || '';
                    const coords = await geocodeLocation(location);
                    if (coords) {
                        results.push({ ...event, lat: coords.lat, lon: coords.lon });
                    }
                } catch (error) {
                    console.error('[JourneyOverlay] Geocoding error:', event.location, error);
                }
            }

            if (results.length < 2) {
                setFinalStats({
                    distance: 0,
                    score: 0,
                    reason: 'INSUFFICIENT_EVENTS',
                    message: `Need at least 2 events with locations (found ${results.length})`
                });
                setGameState('FINISHED');
                return;
            }

            setGeocodedEvents(results);
            positionRef.current = { lat: results[0].lat, lon: results[0].lon };
        };
        fetchLocations();
    }, [eventsValid, selectedCar, setFinalStats, setGameState]);

    return {
        geocodedEvents,
        carManifests,
        positionRef
    };
};
