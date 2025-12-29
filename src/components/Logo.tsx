import type { HTMLAttributes } from 'react'

interface IconProps extends HTMLAttributes<SVGElement> {
    size?: number
    className?: string
}

export function VaibaamoIcon({ size = 32, className = "", ...props }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <defs>
                <linearGradient id="vibe-gradient" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4F46E5" /> {/* Indigo 600 */}
                    <stop offset="100%" stopColor="#9333EA" /> {/* Purple 600 */}
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Container: Squircle */}
            <rect
                x="2"
                y="2"
                width="28"
                height="28"
                rx="8"
                className="fill-indigo-50"
            />

            {/* The V-Shape */}
            <g filter="url(#glow)">
                {/* Left Arm: The 'Vibe' (Wave) */}
                <path
                    d="M9 10C9 10 9 24 16 24"
                    stroke="url(#vibe-gradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />

                {/* Right Arm: The 'Code' (Binary/Structure) */}
                <path
                    d="M23 10V17L16 24"
                    stroke="url(#vibe-gradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* Spark at the vertex */}
            <circle cx="16" cy="24" r="1.5" fill="white" />
        </svg>
    )
}

export function VaibaamoLogo({ className = "", showText = true }: { className?: string; showText?: boolean }) {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <VaibaamoIcon size={32} className="flex-shrink-0" />
            {showText && (
                <span className="font-bold text-xl tracking-tight text-gray-900">
                    Vaibaamo
                </span>
            )}
        </div>
    )
}
