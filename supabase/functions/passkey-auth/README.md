# Service: Supakeys Authentication (`passkey-auth`)

This Edge Function powers the **Supakeys** integration, a modern passkey implementation designed for enhanced device support and future-proofing. It operates alongside the legacy system, providing a distinct registration and management flow.

## Architecture & Design

This service uses a **Modular Architecture** to separate concerns:
*   `index.ts`: Entry point and router.
*   `handlers.ts`: Core business logic for registration, login, and management.
*   `utils.ts`: Shared utilities for encoding, decoding, and rate limiting.

### Identity Separation Strategy
A critical design decision was made to ensure browser password managers (like Google Password Manager) treat Supakeys distinct from Legacy passkeys:

*   **Legacy User Handle**: `uuid` (e.g., `123e4567-e89b-12d3-a456-426614174000`)
*   **Supakeys User Handle**: `uuid-supakeys` (e.g., `123e4567-e89b-12d3-a456-426614174000-supakeys`)

By appending the `-supakeys` suffix to the WebAuthn User ID during registration, we force the browser to store these as a separate "account" entry for the same RP ID. This prevents the browser from merging keys and allows the UI to show distinct "Standard" vs "Supakeys" options.

## Implementation Details

### Data Model (`public.passkey_credentials`)
*   `user_id`: UUID (References `auth.users`)
*   `webauthn_user_id`: String (The suffixed ID described above)
*   `credential_id`: String
*   `public_key`: String (**Base64URL** encoded - *Standard compliant*)
*   `authenticator_name`: String (e.g., "iCloud Keychain")
*   `device_type`: String

### Key Dependencies
*   **Runtime**: Deno
*   **Database Client**: `@supabase/supabase-js@2.49.0` (Newer version)
*   **WebAuthn Library**: `@simplewebauthn/server@11.0.0` (Newer version)

## API Endpoints (`handlers.ts`)

*   `register-start`: Checks for existing users, generates consistent `-supakeys` handle.
*   `register-finish`: Verifies attestation, creates user if missing, links to `public.passkey_credentials`.
*   `login-start`: Initiates authentication.
*   `login-finish`: Verifies assertion, updates counters.
*   `list-passkeys`: Fetches Supakeys-specific credentials.
*   `remove-passkey`: Deletes Supakeys credentials.
*   `update-passkey`: Renames passkeys.

## Security
*   **Rate Limiting**: Implemented via `check_passkey_rate_limit` RPC in `utils.ts`.
*   **Audit Logging**: Detailed `log_passkey_audit_event` calls for all major actions.
