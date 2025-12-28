-- Create passkeys table to store WebAuthn credentials
create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] default '{}',
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- Table to store temporary challenges for WebAuthn ceremonies
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users, -- can be null for login
  challenge text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '5 minutes')
);

-- Index for faster lookups during login
create index if not exists passkeys_credential_id_idx on public.passkeys (credential_id);
create index if not exists passkeys_user_id_idx on public.passkeys (user_id);

-- Enable RLS
alter table public.passkeys enable row level security;
alter table public.webauthn_challenges enable row level security;

-- Policies for passkeys
create policy "Users can view their own passkeys"
  on public.passkeys for select
  using (auth.uid() = user_id);

create policy "Users can delete their own passkeys"
  on public.passkeys for delete
  using (auth.uid() = user_id);

-- Only service role can manage challenges and passkeys via Edge Function
