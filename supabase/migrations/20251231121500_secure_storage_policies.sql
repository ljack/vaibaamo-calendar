-- Drop existing policies to replace them with strict ownership checks
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- Policy: Auth Upload (User can only upload files where they are the owner)
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
  bucket_id = 'event-media' 
  AND auth.role() = 'authenticated' 
  AND (storage.foldername(name))[1] != 'private' -- Optional: specific folder restrictions if needed
);

-- Policy: Auth Update (User can only update their own files)
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'event-media' AND owner = auth.uid() );

-- Policy: Auth Delete (User can only delete their own files)
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'event-media' AND owner = auth.uid() );
