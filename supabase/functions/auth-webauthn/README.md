# Service: Legacy Passkey Authentication (`auth-webauthn`)

This Edge Function provides the **original** passkey authentication implementation for Vaibaamo Calendar. It is maintained for backward compatibility with existing credentials and serves as the default "Passkey" login option in the UI.

## Architecture & Design

This service implements the WebAuthn Reliance Party (RP) logic using a monolithic structure within `index.ts`. It manually routes HTTP requests to specific logic blocks.

### Core Components
*   **Routing**: Handles paths like `/register-options`, `/register-verify`, `/login-options`, `/login-verify`.
*   **Database**: Stores credentials in the `public.passkeys` table.
*   **User Identity**: Uses the raw Supabase User UUID (`auth.users.id`) as the WebAuthn User Handle.

### Cross-System Compatibility
To support a unified login experience, the `login-verify` endpoint has been enhanced to perform a **Dual-Table Lookup**:
1.  **Primary Lookup**: Checks `public.passkeys` (Legacy credentials).
2.  **Fallback Lookup**: If not found, checks `public.passkey_credentials` (Supakeys credentials).

This allows the "Standard" login button/flow to successfully authenticate users who registered via the newer Supakeys flow.

## Implementation Details

### Data Model (`public.passkeys`)
*   `user_id`: UUID (References `auth.users`)
*   `credential_id`: String (Base64URL encoded)
*   `public_key`: String (**Base64** encoded - *Note: different from Supakeys*)
*   `counter`: Integer
*   `transports`: Array

### Key Dependencies
*   **Runtime**: Deno
*   **HTTP Server**: `std@0.168.0/http/server.ts`
*   **Database Client**: `@supabase/supabase-js@2.39.7`
*   **WebAuthn Library**: `@simplewebauthn/server@10.0.0` (Note: Older version than Supakeys)

## API Endpoints

*   `POST /register-options`: Generates challenge for new passkey.
*   `POST /register-verify`: Verifies registration and saves to `public.passkeys`.
*   `POST /login-options`: Generates challenge for login.
*   `POST /login-verify`: authentication verification (Dual-table lookup).
*   `POST /list-passkeys`: Returns user's legacy passkeys.
*   `POST /remove-passkey`: Deletes specific legacy passkey.

## Known Limitations
*   Stores public keys in standard Base64, requiring conversion logic when validating against modern formats.
*   Monolithic file structure makes it harder to extend compared to the modular `passkey-auth`.
