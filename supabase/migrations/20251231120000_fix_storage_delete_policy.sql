-- Policy: Auth Delete (allow authenticated users to delete files)
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'event-media' AND auth.role() = 'authenticated' );
