# Environment Variables & Security (Vite + Supabase)

This document outlines the strict naming conventions and security practices for handling environment variables in the Vaibaamo Calendar application.

## 1. Client-Side (Browser)

The frontend is built with **Vite**. Variables meant for the browser **MUST** be prefixed with `VITE_`.

### Required Variables
These variables are safe to expose in the browser bundle.

| Variable Name | Description | Visibility |
|--------------|-------------|------------|
| `VITE_SUPABASE_URL` | The Supabase project URL (e.g., `https://xyz.supabase.co`) | **Public** |
| `VITE_SUPABASE_ANON_KEY` | The Supabase Anonymous API Key | **Public** |

> **🚫 AVOID**: Do NOT use `NEXT_PUBLIC_` prefixes. This is a Next.js convention and is not standard for Vite.

### Usage in Code
Access these variables via `import.meta.env`:

```typescript
// src/lib/supabase.ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY")
}
```

## 2. Server-Side (Backend & Scripts)

Backend scripts (e.g., Node.js scripts in `scripts/`, Edge Functions, or Vercel Functions) **MUST** use variables **WITHOUT** the `VITE_` prefix.

### Required Variables
These variables are for server-side use only.

| Variable Name | Description | Visibility |
|--------------|-------------|------------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` | Server-Side |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** Admin key. Bypasses RLS. | **SECRET (Enable "Automatically expose System Environment Variables" in Vercel)** |

> **⚠️ CRITICAL SECURITY WARNING**: 
> *   **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
> *   **NEVER** assign `SUPABASE_SERVICE_ROLE_KEY` to a `VITE_*` variable.
> *   **NEVER** commit `.env` files containing secrets.

### Usage in Code (Node.js)
Access these variables via `process.env`:

```javascript
// scripts/sync-events.js
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing server env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}
```

## 3. Local Development (`.env.local`)

Create a `.env.local` file in the project root for local development. This file is git-ignored.

```bash
# Client (Vite)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"

# Server (Scripts/Backend)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## 4. Deployment (Vercel)

Configure these variables in **Vercel Project Settings > Environment Variables**:

1.  **VITE_SUPABASE_URL**: Set for Production, Preview, Development.
2.  **VITE_SUPABASE_ANON_KEY**: Set for Production, Preview, Development.
3.  **SUPABASE_URL**: Set for Production, Preview, Development (for backend use).
4.  **SUPABASE_SERVICE_ROLE_KEY**: Set for Production, Preview, Development.

*Note: You may need to redeploy the application after changing environment variables for them to take effect in the build.*
