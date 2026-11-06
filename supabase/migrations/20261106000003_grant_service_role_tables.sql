-- Server routes and the admin panel use the service role (it bypasses RLS), but the init
-- migration never granted it table privileges, so /api/lead could not write leads.
-- Grant only what the code actually uses. rate_limits needs no grant: it is only
-- touched inside check_rate_limit(), which is security definer.
grant select, insert, update, delete on table public.leads to service_role;
grant select, insert, update on table public.profiles to service_role;
grant select, insert on table public.activity_log to service_role;
grant select on table public.events to service_role;
-- activity_log uses an identity column; inserts need its sequence.
grant usage, select on sequence public.activity_log_id_seq to service_role;
