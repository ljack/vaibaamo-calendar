
export type JourneyState = 'LOADING' | 'TRAVELING' | 'ARRIVED' | 'FINISHED' | 'SELECT_CAR' | 'SELECT_DIFFICULTY';

export type CarType = 'red' | 'blue';

export const AVAILABLE_CARS: CarType[] = ['red', 'blue'];

export const ARRIVAL_MESSAGES = [
    "Vibe Coding!",
    "Refactoring the universe...",
    "Deploying on Friday...",
    "Fixing bugs in production...",
    "Adding more AI...",
];

// Car sprite and metadata interface
export interface CarManifest {
    meta: {
        image: string;
        imageWidth: number;
        imageHeight: number;
        frameCount: number;
    };
    frames: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
}

// Car sprite scaling configuration
export const CAR_CONFIGS: Record<CarType, { scale: number }> = {
    red: { scale: 0.15 },
    blue: { scale: 0.08 } // Scaled down further to fit the road nicely
};

export const getCarSpriteUrl = (carType: CarType): string => {
    if (carType === 'red') return '/red_car.webp';
    if (carType === 'blue') return '/blue_car_trimmed_alpha.png';
    return `/car_sprites_${carType}.png`;
};
