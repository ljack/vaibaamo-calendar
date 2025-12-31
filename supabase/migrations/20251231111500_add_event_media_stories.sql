-- Add rich text and media fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS plan_markdown text,
ADD COLUMN IF NOT EXISTS recap_markdown text,
ADD COLUMN IF NOT EXISTS media_assets jsonb DEFAULT '[]'::jsonb;
