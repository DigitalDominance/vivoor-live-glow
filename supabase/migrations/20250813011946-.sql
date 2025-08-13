-- Create a public avatars bucket for profile images
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow public read access to avatars
create policy if not exists "Public read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Allow public uploads to avatars (no auth required)
-- Note: This enables anonymous uploads; we can tighten to authenticated users later
create policy if not exists "Public upload avatars"
on storage.objects
for insert
to public
with check (bucket_id = 'avatars');