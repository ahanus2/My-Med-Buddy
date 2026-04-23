insert into storage.buckets (id, name, public)
values ('medical-record-files', 'medical-record-files', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own medical files" on storage.objects;
create policy "Users can read their own medical files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'medical-record-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their own medical files" on storage.objects;
create policy "Users can upload their own medical files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'medical-record-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own medical files" on storage.objects;
create policy "Users can update their own medical files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'medical-record-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'medical-record-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own medical files" on storage.objects;
create policy "Users can delete their own medical files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'medical-record-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
