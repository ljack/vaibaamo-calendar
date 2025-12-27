# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + TypeScript + Vite calendar event management application integrated with Supabase for authentication and data persistence. The app includes event creation, editing, details viewing, and a map-based event discovery interface using Leaflet.

## Development Commands

### Build & Run
- `npm run dev` - Start Vite dev server with HMR (also generates version file)
- `npm run build` - Build for production (TypeScript type-check + Vite bundle)
- `npm run preview` - Preview production build locally

### Testing
- `npm test` - Run Vitest unit tests (via `vitest run`)
- `npm run test:integration` - Run Playwright end-to-end tests
- `npm run test -- tests/specific-test.test.ts` - Run a single test file (with Vitest)

### Linting & Quality
- `npm run lint` - Run ESLint across the codebase

### Utilities
- `npm run sync-events` - Run event sync script (see scripts/sync-events.js)

## Architecture

### Core Structure
```
src/
├── App.tsx                 # Router setup, page routing
├── main.tsx               # React 19 + ReactDOM render
├── types.ts               # TypeScript interfaces (Profile, Event, Participant)
├── contexts/              # React Context providers (auth state)
├── pages/                 # Page components (Login, EventsList, CreateEvent, etc.)
├── components/            # Reusable UI components
├── lib/                   # Utility functions & services
├── hooks/                 # Custom React hooks
├── test/                  # Test setup and mocks
└── vite-env.d.ts         # Vite client type declarations
```

### Authentication & State Management

**AuthContext** (src/contexts/AuthContext.tsx) is the central auth provider:
- Manages `session`, `user`, `isAdmin`, and `loading` state globally
- Provides `signOut()` and `checkSession()` utility functions
- Uses Supabase SSR integration with session persistence and auto-refresh
- Handles auth state recovery on window focus/visibility changes
- Includes debug logging when `VITE_SUPABASE_DEBUG_AUTH=true`

**Key auth utilities:**
- `src/lib/supabase.ts` - Singleton Supabase client instance (must be ONE globally)
- `src/lib/authBootstrap.ts` - Initial auth session setup logic
- `src/lib/authEvents.ts` - Auth state change listener subscription
- `src/lib/fetchWithSupabaseAuth.ts` - Fetch wrapper that injects Supabase auth header

### API & Service Layer

**Supabase Integration:**
- Tables: `profiles`, `events`, `participants`
- Auth: Email/password + third-party providers via Supabase Auth
- Realtime subscriptions available via Supabase

**Permission Pattern:**
- `src/lib/requireUser.ts` - Guard function to check if user is authenticated before allowing actions
- Admin status checked via `profiles.role` column on every auth state change

### Components

Key components:
- **Layout.tsx** - Main layout wrapper with Konami code easter egg (JourneyOverlay)
- **EventsMap.tsx** - Leaflet-based interactive map for event discovery
- **UpdateNotification.tsx** - Toast-style notifications
- **JourneyCollapse.tsx** / **JourneyOverlay.tsx** - Hidden easter egg journey mini-game

### Testing

**Test Setup:**
- Vitest configured with jsdom environment (src/test/setup.ts)
- React Testing Library for component tests
- Mock Supabase client in src/test/mocks/supabase.ts
- Coverage via @vitest/coverage-v8 (reporters: text, json, html)
- Playwright for integration tests (separate from unit tests)

**Test Patterns:**
- Component tests use render() from @testing-library/react
- Auth-dependent components use mocked AuthContext or AuthProvider
- Supabase queries mocked in vi.mock() blocks

### Styling & UI

- **Tailwind CSS 4** via @tailwindcss/vite plugin (no CSS imports needed)
- **Leaflet** for mapping (src/lib/leafletLoader.ts handles async CDN loading)
- React Router 7 for page routing
- React 19 with automatic JSX transform

## Configuration Files

- **vite.config.ts** - Vite + React plugin config, Vitest environment setup
- **tsconfig.app.json** - TypeScript strict mode enabled, ES2022 target
- **tsconfig.json** - Root tsconfig with references to app/node tsconfigs
- **eslint.config.js** - Flat config with React Hooks, React Refresh, TypeScript ESLint
- **package.json** - Vite 7, React 19, Supabase SSR, Tailwind 4, TypeScript ~5.9.3

## Environment Variables

Required (in `.env.local` or `.env`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key

Optional:
- `VITE_SUPABASE_DEBUG_AUTH` - Set to "true" to enable auth debug logging

## Key Patterns & Conventions

1. **Auth Guard**: Import `requireUser()` from lib/requireUser.ts to block unauthenticated access
2. **Using Supabase**: Always call `getSupabase()` not the exported `supabase` instance directly (allows for test mocking)
3. **TypeScript Strict**: No `any` types unless absolutely necessary; use proper interfaces from types.ts
4. **Component Structure**: Props destructured in function signature; custom hooks separate in src/hooks/
5. **Testing**: Unit tests co-located with components (.test.ts/.test.tsx); integration tests in tests/ directory
6. **Page Routes**: Defined in App.tsx; use React Router outlet pattern in Layout.tsx

## Known Easter Eggs

- **Konami Code**: Press ↑ ↑ ↓ ↓ ← → ← → B A on the page to trigger the JourneyOverlay (car physics game mini-game)
  - Uses src/hooks/useKonamiCode.ts and src/hooks/useCarPhysics.ts
  - Renders JourneyCollage.tsx component when activated
