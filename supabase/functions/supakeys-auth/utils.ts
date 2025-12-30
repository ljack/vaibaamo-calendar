
export interface RequestBody {
    endpoint: string;
    data: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
}

// Balance between security (short window) and UX (enough time to complete ceremony)
export const CHALLENGE_TTL_MINUTES = 5;
export const SUPPORTED_ALGORITHMS = [-7, -257];
export const RATE_LIMITS = { ip: { maxAttempts: 5, windowMinutes: 1 }, email: { maxAttempts: 10, windowMinutes: 1 } };

export function success<T>(data: T): ApiResponse<T> {
    return { success: true, data };
}

export function error(code: string, message: string): ApiResponse {
    return { success: false, error: { code, message } };
}

export function getOrigin(request: Request): string {
    const origin = request.headers.get('origin');
    if (origin) return origin;
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
}

export function getClientIP(request: Request): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        '0.0.0.0';
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

export function generateWebAuthnUserId(existingUserId?: string): string {
    if (existingUserId) {
        // Return UUID directly to match Legacy implementation (which encodes the UUID string to bytes)
        return existingUserId;
    }
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return uint8ArrayToBase64Url(bytes);
}
