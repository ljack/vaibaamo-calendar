
# LOC Refactor Plan

## Objective
Refactor source files to ensure they are under 400 Lines of Code (LOC) to improve maintainability and readability.

## Metrics
**Before Refactor:**
- `src/components/JourneyOverlay.tsx`: 873 LOC
- `supabase/functions/passkey-auth/index.ts`: 456 LOC
- `src/pages/EventsList.test.tsx`: 582 LOC
- `src/contexts/AuthContext.test.tsx`: 525 LOC

**Target:**
- All files < 400 LOC.

## Plan

### 1. Refactor `src/components/JourneyOverlay.tsx`
This is the largest file and most complex component.

**Strategy:** Breakdown into smaller components and hooks.
- **Extract Types**: Move interfaces (`JourneyOverlayProps`, `JourneyState`, `CarManifest`, `CarType`) and constants (`AVAILABLE_CARS`) to `src/components/Journey/types.ts`.
- **Extract Hooks**:
    - `useJourneyState`: Manage the complex game state.
    - `useMapIntegration`: Handle Leaflet map initialization, upgrading, and marker management.
    - `useCarResources`: Handle loading sprites and configuring car visuals.
- **Extract Components**:
    - `src/components/Journey/CarSelection.tsx`: The UI for selecting a car.
    - `src/components/Journey/JourneyMap.tsx`: The map container and its immediate controls.
    - `src/components/Journey/JourneyStats.tsx`: (If applicable) The overlay showing distance, time, etc.

### 2. Refactor `supabase/functions/passkey-auth/index.ts`
This Deno Edge Function handles multiple operations (registration options, verification, login options, login verification).

**Strategy:** Split logic into modules.
- **`utils.ts`**: Helper functions (`success`, `error`, `getOrigin`, `getClientIP`), encoding utilities, and shared constants.
- **`handlers/registration.ts`**: `handleRegisterOptions` and `handleRegisterVerify`.
- **`handlers/auth.ts`**: `handleLoginOptions` and `handleLoginVerify`.
- **`index.ts`**: Keep as a lightweight router that delegates to these handlers.

### 3. Refactor Test Files
Large test files are often acceptable, but can be split for better organization.
- **`src/pages/EventsList.test.tsx`**: Split into `EventsList.auth.test.tsx` (auth/session logic) and `EventsList.func.test.tsx` (fetching, rendering, interactions).
- **`src/contexts/AuthContext.test.tsx`**: Split by functionality if possible, or extract test helpers.

## Verification
- Run `npm run test` and `npm run test:integration` after every major refactor step.
- Check LOC using `wc -l`.
