-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  avatar_url text,
  role text default 'user',
  email text,
  updated_at timestamp with time zone
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for events
create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  location text,
  max_participants int,
  creator_id uuid references profiles default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table events enable row level security;

create policy "Events are viewable by everyone." on events
  for select using (true);

create policy "Admins can create events." on events
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update events." on events
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Creators can update events." on events
  for update using (
    auth.uid() = creator_id
  );

-- Create a table for participants
create table participants (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events not null,
  user_id uuid references profiles not null,
  status text default 'registered',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(event_id, user_id)
);

alter table participants enable row level security;

create policy "Participants are viewable by everyone." on participants
  for select using (true);

create policy "Authenticated users can register." on participants
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own status." on participants
  for update using (auth.uid() = user_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
