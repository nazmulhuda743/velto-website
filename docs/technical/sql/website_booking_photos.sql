-- Optional customer photos on a booking (src/app/api/bookings/photos, src/app/go/photo/[id]).
-- Private bucket: no storage.objects policy mentions it, so only the service role (the website
-- server) can write or sign it. Staff open photos through the links in the Ops task, which
-- redirect to signed URLs valid for ten minutes. Idempotent; safe to re-run.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-photos', 'booking-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Upload limit per IP: the 'photo' bucket of the shared website limiter (website_otp.sql).
alter table public.website_otp_rate_limits drop constraint if exists website_otp_rate_limits_bucket_check;
alter table public.website_otp_rate_limits add constraint website_otp_rate_limits_bucket_check
  check (bucket in ('phone', 'ip', 'global', 'verify', 'photo'));

commit;

-- Then re-run the website_otp_rate_limit function from website_otp.sql (it knows the 'photo' limit).
