-- Create public avatars bucket and policies
-- Bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policies for storage.objects (RLS is enabled by default)
-- Public read access to files in the avatars bucket
create policy "Public read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Allow public uploads to the avatars bucket (no auth required)
create policy "Public upload avatars"
on storage.objects
for insert
to public
with check (bucket_id = 'avatars');