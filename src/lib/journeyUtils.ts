

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
