-- The init migration revoked EXECUTE on these functions from public/anon/authenticated,
-- but never granted it back to service_role, so /api/lead (rate limit) and /api/event
-- (analytics) were denied. Server routes use the service role, so grant it explicitly.
grant execute on function public.check_rate_limit(text, int, interval) to service_role;
grant execute on function public.bump_event(text, text, text) to service_role;
