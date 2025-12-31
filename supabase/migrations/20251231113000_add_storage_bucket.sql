-- Create storage bucket for event media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-media', 'event-media', true) 
ON CONFLICT (id) DO NOTHING;

-- Policy: Public Read
CREATE POLICY "Public Read" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'event-media' );

-- Policy: Auth Upload
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'event-media' AND auth.role() = 'authenticated' );

-- Policy: Auth Update (optional, if users edit their metadata)
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'event-media' AND auth.role() = 'authenticated' );
