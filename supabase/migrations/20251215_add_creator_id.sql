-- Add creator_id to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);

-- Update RLS policies to allow creator to update their own events

-- Policy: Creators can update their own events
CREATE POLICY "Creators can update their own events"
ON events
FOR UPDATE
USING (
  auth.uid() = creator_id
  OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Policy: Authenticated users can insert events (if they are admin OR we want to allow users to create? 
-- Current logic in CreateEvent.tsx restricts UI to admins.
-- But let's allow the INSERT at DB level for authenticated users, IF we want to relax it later. 
-- For now, let's keep the INSERT restricted to admins as per previous setup, BUT make sure creator_id is set.)

-- Ensure previous policies are still valid or update them if needed.
-- We previously had "Admins can create events".
-- Let's stick with that for now, but `creator_id` will be saved naturally if passed.

-- We also need to ensure that when an Admin creates an event, the creator_id is respected if they are the one inserting.
