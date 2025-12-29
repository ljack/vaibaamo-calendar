# Vaibaamo Calendar - Copilot Instructions

## Project Overview

Vaibaamo Calendar is a modern event management application built with React 19, TypeScript, Vite, and Supabase. It features WebAuthn passkeys authentication, event management with CRUD operations, interactive Leaflet maps, and role-based access control.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, RLS)
- **Testing**: Vitest (unit), Playwright (E2E), Testing Library
- **Maps**: Leaflet for interactive event location mapping

## Project Structure

```
src/
├── pages/              # Page components (Login, EventsList, CreateEvent, EventDetails, EditEvent)
├── components/         # Reusable UI components (Layout, EventsMap, UpdateNotification, etc.)
├── contexts/           # React Context providers (AuthContext for auth state)
├── lib/                # Utility functions and services (supabase, auth utilities)
├── hooks/              # Custom React hooks
├── test/               # Test setup and mocks
└── types.ts            # TypeScript interfaces (Profile, Event, Participant)

tests/                  # Playwright E2E tests
supabase/migrations/    # Database migration SQL files
docs/                   # Project documentation
public/                 # Static assets (includes version.json)
scripts/                # Utility scripts (generate-version.js, sync-events.js)
```

## Development Commands

- `npm run dev` - Start Vite dev server (also generates version.json)
- `npm run build` - Build TypeScript and Vite production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm test` - Run Vitest unit tests
- `npm test -- --coverage` - Run tests with coverage (target: 90%+)
- `npm run test:integration` - Run Playwright E2E tests
- `npm run sync-events` - Sync event data via script

## Coding Conventions

### Style
- **Indentation**: 4 spaces (match existing files)
- **TypeScript**: Strict mode enabled, avoid `any` types
- **Naming**: 
  - Components: `PascalCase`
  - Hooks/utilities: `camelCase`
  - Test files: `*.test.ts` or `*.test.tsx`

### Component Structure
- Destructure props in function signature
- Custom hooks separate in `src/hooks/`
- Co-locate unit tests with components

### Authentication
- Use `AuthContext` for global auth state (`session`, `user`, `isAdmin`, `loading`)
- Import `requireUser()` from `lib/requireUser.ts` to guard authenticated routes
- Always use `getSupabase()` not the exported `supabase` instance (enables test mocking)
- Supabase SSR integration handles session persistence and auto-refresh

### Database & Permissions
- Tables: `profiles`, `events`, `participants`
- Use Row Level Security (RLS) policies in Supabase
- Admin status checked via `profiles.role` column
- For sensitive data (e.g., attendee emails), use Supabase RPCs with permission checks

## Testing Guidelines

### Unit Tests (Vitest)
- Use React Testing Library for component tests
- Mock Supabase client via `src/test/mocks/supabase.ts`
- Mock AuthContext or AuthProvider for auth-dependent components
- Maintain 90%+ code coverage
- Run `npm test -- --coverage` before pushing UI or logic changes

### E2E Tests (Playwright)
- Place in `tests/` directory
- Use clear, scenario-based names
- Run with `npm run test:integration`

## Environment Variables

Required (in `.env` or `.env.local`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key

Optional:
- `VITE_SUPABASE_DEBUG_AUTH` - Set to "true" for auth debug logging

## Deployment

- Deployed via Vercel
- Use `vercel ls` to list deployments
- Use `vercel inspect <deployment>` and `vercel logs <deployment>` for debugging
- Preview protection bypass rules: see `docs/vercel_deployment_rules.md`

## Commit Guidelines

- Short, imperative, sentence-case messages (e.g., "Add event maps feature")
- Include test results and screenshots for UI changes in PRs
- Note any Supabase migrations or RPC changes in PR descriptions

## Key Patterns

1. **Auth Guard**: Use `requireUser()` to block unauthenticated access
2. **Supabase Access**: Call `getSupabase()` not direct `supabase` instance
3. **Type Safety**: Use interfaces from `types.ts`, avoid `any`
4. **Routing**: Pages defined in `App.tsx`, use React Router outlet pattern in `Layout.tsx`
5. **Styling**: Tailwind CSS 4 via `@tailwindcss/vite` plugin (no CSS imports needed)

## Special Features

- **Konami Code Easter Egg**: ↑↑↓↓←→←→BA triggers JourneyOverlay (car physics mini-game)
  - Uses `useKonamiCode.ts` and `useCarPhysics.ts` hooks
  - Renders `JourneyCollage.tsx` component
