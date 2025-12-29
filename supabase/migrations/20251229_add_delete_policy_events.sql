create policy "Creators and Admins can delete events"
on "public"."events"
as permissive
for delete
to public
using (
  (auth.uid() = creator_id) OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
);
