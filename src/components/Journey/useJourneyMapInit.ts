
import { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { loadLeaflet } from '../../lib/leafletLoader';
import { generateCurvedPath } from '../../lib/journeyUtils';
import type { CarType, CarManifest } from './types';
import { CAR_CONFIGS, getCarSpriteUrl } from './types';

interface UseJourneyMapInitProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocodedEvents: any[];
    selectedCar: CarType;
    carManifests: Record<string, CarManifest>;
    positionRef: React.MutableRefObject<{ lat: number; lon: number } | null>;
}

export const useJourneyMapInit = ({
    geocodedEvents,
    selectedCar,
    carManifests,
    positionRef
}: UseJourneyMapInitProps) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapInstanceRef = useRef<any>(null);
    const mapInitializedRef = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const carMarkerRef = useRef<any>(null);
    const isZoomingRef = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roadEdgeRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roadBaseRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roadDashRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LRef = useRef<any>(null);

    const pathRef = useRef<{ lat: number; lon: number }[]>([]);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        if (!mapContainerRef.current || geocodedEvents.length === 0 || mapInitializedRef.current) return;

        const initMap = async () => {
            if (!mapContainerRef.current) return;
            try {
                const L = await loadLeaflet();
                LRef.current = L;

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }

                const startPos = positionRef.current || geocodedEvents[0];
                const map = L.map(mapContainerRef.current, {
                    zoomControl: false,
                    attributionControl: false,
                    keyboard: false
                }).setView([startPos.lat, startPos.lon], 6);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);

                geocodedEvents.forEach(evt => {
                    L.marker([evt.lat, evt.lon])
                        .bindPopup(evt.title)
                        .addTo(map);
                });

                const carSpriteUrl = getCarSpriteUrl(selectedCar);
                const isManifestCar = selectedCar === 'red' || selectedCar === 'blue';
                const manifest = carManifests[selectedCar];
                const initialFrame = isManifestCar && manifest ? manifest.frames[1] : null;
                const carScale = CAR_CONFIGS[selectedCar]?.scale || 0.15;

                const carIcon = L.divIcon({
                    html: `<div class="car-sprite car-${selectedCar} ${isManifestCar ? 'frame-1' : 'frame-0'}" style="
                        transform: rotate(90deg);
                        background-image: url('${carSpriteUrl}');
                        ${isManifestCar && manifest ? `
                            width: ${Math.round((initialFrame?.width || 241) * carScale)}px;
                            height: ${Math.round((initialFrame?.height || 290) * carScale)}px;
                            background-position: -${Math.round((initialFrame?.x || 0) * carScale)}px -${Math.round((initialFrame?.y || 0) * carScale)}px;
                            background-size: ${Math.round(manifest.meta.imageWidth * carScale)}px ${Math.round(manifest.meta.imageHeight * carScale)}px;
                        ` : ''}
                    "></div>`,
                    className: 'car-icon-marker',
                    iconSize: isManifestCar && initialFrame ? [Math.round(initialFrame.width * carScale), Math.round(initialFrame.height * carScale)] : [64, 96],
                    iconAnchor: isManifestCar && initialFrame ? [Math.round(initialFrame.width / 2 * carScale), Math.round(initialFrame.height / 2 * carScale)] : [32, 48]
                });
                carMarkerRef.current = L.marker([startPos.lat, startPos.lon], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);

                const rawPoints = geocodedEvents.map(e => ({ lat: e.lat, lon: e.lon }));
                const curvedPath = generateCurvedPath(rawPoints, 20);
                pathRef.current = curvedPath;

                const latlngs: [number, number][] = curvedPath.map(p => [p.lat, p.lon]);
                const canvasRenderer = L.canvas();
                const roadOptions = { renderer: canvasRenderer, interactive: false, smoothFactor: 0, noClip: true };

                roadEdgeRef.current = L.polyline(latlngs, { ...roadOptions, color: '#f5d547', weight: 44, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                roadBaseRef.current = L.polyline(latlngs, { ...roadOptions, color: '#1a1a1a', weight: 40, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                roadDashRef.current = L.polyline(latlngs, { ...roadOptions, color: '#fff', weight: 1.5, opacity: 0.6, dashArray: '20, 30', lineCap: 'butt' }).addTo(map);
                L.polyline(latlngs, { ...roadOptions, color: '#000', weight: 50, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }).addTo(map);

                mapInstanceRef.current = map;
                mapInitializedRef.current = true;
                setIsMapReady(true);

                map.on('zoomstart', () => { isZoomingRef.current = true; });
                map.on('zoomend', () => { isZoomingRef.current = false; });
            } catch (error) {
                console.error('[JourneyMap] Map initialization error:', error);
            }
        };

        if (geocodedEvents.length > 0) {
            initMap();
        }
    }, [geocodedEvents, selectedCar, carManifests, positionRef]);

    // Cleanup Map
    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                mapInitializedRef.current = false;
            }
        };
    }, []);

    return {
        mapContainerRef,
        mapInstanceRef,
        carMarkerRef,
        isZoomingRef,
        pathRef,
        isMapReady
    };
};
