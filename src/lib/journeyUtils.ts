

export type Point = { x: number; y: number };
export type GeoPoint = { lat: number; lon: number };

// Simple Haversine distance
export function getDistance(p1: GeoPoint, p2: GeoPoint): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(p2.lat - p1.lat);
    const dLon = deg2rad(p2.lon - p1.lon);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(p1.lat)) *
        Math.cos(deg2rad(p2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// Interpolate between two geo points
export function interpolatePosition(start: GeoPoint, end: GeoPoint, progress: number): GeoPoint {
    return {
        lat: start.lat + (end.lat - start.lat) * progress,
        lon: start.lon + (end.lon - start.lon) * progress,
    };
}

// Normalize coordinates to 0-1 range for a bounding box
export function normalizeCoordinates(
    events: { lat: number; lon: number }[]
): { lat: number; lon: number; normalizedX: number; normalizedY: number }[] {
    if (events.length === 0) return [];

    const lats = events.map((e) => e.lat);
    const lons = events.map((e) => e.lon);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;

    // Avoid division by zero
    const safeLatRange = latRange === 0 ? 1 : latRange;
    const safeLonRange = lonRange === 0 ? 1 : lonRange;

    return events.map((event) => ({
        ...event,
        normalizedX: (event.lon - minLon) / safeLonRange,
        // Invert Y because screen coordinates: top is 0, but higest latitude is "up"
        normalizedY: 1 - (event.lat - minLat) / safeLatRange,
    }));
}


// Basic spline interpolation for smoother paths
export const generateCurvedPath = (points: { lat: number, lon: number }[], resolution: number = 10): { lat: number, lon: number }[] => {
    if (points.length < 2) return points;
    const curvedPoints: { lat: number, lon: number }[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let t = 0; t < 1; t += 1 / resolution) {
            // Catmull-Rom spline
            const t2 = t * t;
            const t3 = t2 * t;

            const lat = 0.5 * (
                (2 * p1.lat) +
                (-p0.lat + p2.lat) * t +
                (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
                (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3
            );

            const lon = 0.5 * (
                (2 * p1.lon) +
                (-p0.lon + p2.lon) * t +
                (2 * p0.lon - 5 * p1.lon + 4 * p2.lon - p3.lon) * t2 +
                (-p0.lon + 3 * p1.lon - 3 * p2.lon + p3.lon) * t3
            );
            curvedPoints.push({ lat, lon });
        }
    }
    curvedPoints.push(points[points.length - 1]);
    return curvedPoints;
};

export const POI_TYPES = [
    "Old Gas Station", "Abandoned Barn", "Scenic Overlook", "Roadside Diner",
    "Mysterious Monolith", "Herd of Reindeer", "Aurora Borealis", "Speed Trap!",
    "Hitchhiker (Ignore!)", "Radio Silence Zone"
];

export const generateNearbyPOI = () => {
    return POI_TYPES[Math.floor(Math.random() * POI_TYPES.length)];
}
