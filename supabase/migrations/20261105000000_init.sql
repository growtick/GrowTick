-- Growtick v1 schema (PRD §04 admin, §06 database & security)
-- Roles: owner = everything incl. users; editor = content + read leads + change lead status;
--        viewer = read leads only. Every admin policy also requires 2FA (aal2).

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'editor', 'viewer');
create type public.lead_status as enum ('new', 'contacted', 'converted', 'closed');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- New auth users get a viewer profile; an owner promotes them.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- helpers
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.has_mfa() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
$$;

create function public.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_mfa() and coalesce(public.current_app_role() = any (roles), false)
$$;

create function public.touch_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- ---------------------------------------------------------------- content
create table public.services (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
  number int not null unique check (number between 1 and 99),
  pillar text not null check (pillar in ('skill-academy','tech-finance','web-digital','creative-b2b','trademark-ip')),
  title text not null check (length(title) <= 80),
  hook text not null check (array_length(regexp_split_to_array(trim(hook), '\s+'), 1) <= 8),
  icon text not null default 'sparkle',
  seo_title text not null,
  seo_description text not null check (length(seo_description) <= 200),
  faqs text[] not null default '{}',
  body text not null default '',
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.faqs (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  sort_order int not null default 0,
  question text not null check (length(question) <= 200),
  answer text not null default '',
  topic text not null default 'general',
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.testimonials (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  name text not null check (length(name) <= 80),
  role text not null default '' check (length(role) <= 120),
  service text references public.services (slug) on update cascade on delete set null,
  rating int check (rating between 1 and 5),
  photo text not null default '',
  quote text not null check (length(quote) <= 1000),
  sort_order int not null default 0,
  sample boolean not null default false,
  consent boolean not null default false,          -- written consent on file
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint published_needs_consent check (not published or consent or sample)
);

create trigger services_touch before update on public.services for each row execute function public.touch_updated();
create trigger faqs_touch before update on public.faqs for each row execute function public.touch_updated();
create trigger testimonials_touch before update on public.testimonials for each row execute function public.touch_updated();

-- ---------------------------------------------------------------- leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 2 and 80),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or length(email) <= 120),
  service text not null check (length(service) <= 60),
  message text check (message is null or length(message) <= 500),
  source text,
  consent_at timestamptz not null,
  status public.lead_status not null default 'new',
  notes text check (notes is null or length(notes) <= 1000),
  email_alert_sent boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index leads_created_idx on public.leads (created_at desc);
create index leads_service_idx on public.leads (service);
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated();

-- Editors may only change status/notes, never contact details.
create function public.leads_guard() returns trigger
language plpgsql as $$
begin
  if public.current_app_role() <> 'owner' and (
     new.name is distinct from old.name or new.phone is distinct from old.phone or
     new.email is distinct from old.email or new.service is distinct from old.service or
     new.message is distinct from old.message or new.created_at is distinct from old.created_at) then
    raise exception 'Only status and notes can be changed';
  end if;
  return new;
end $$;
create trigger leads_guard before update on public.leads for each row
  when (auth.uid() is not null) execute function public.leads_guard();

-- ---------------------------------------------------------------- abuse & metrics (server only)
create table public.rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_ip_idx on public.rate_limits (ip_hash, created_at desc);

-- Atomic "allow this submission?" check: max p_limit per p_window per IP hash.
-- Also purges entries older than a day (privacy notice promises ≤24 h).
create function public.check_rate_limit(p_ip_hash text, p_limit int default 5, p_window interval default '1 hour')
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.rate_limits where created_at < now() - interval '1 day';
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));
  select count(*) into n from public.rate_limits where ip_hash = p_ip_hash and created_at > now() - p_window;
  if n >= p_limit then return false; end if;
  insert into public.rate_limits (ip_hash) values (p_ip_hash);
  return true;
end $$;

create table public.events (
  day date not null default current_date,
  name text not null check (name ~ '^[a-z_]{2,30}$'),
  label text not null default '' check (length(label) <= 80),
  path text not null default '' check (length(path) <= 120),
  count int not null default 0,
  primary key (day, name, label, path)
);
create function public.bump_event(p_name text, p_label text, p_path text) returns void
language sql security definer set search_path = '' as $$
  insert into public.events (day, name, label, path, count) values (current_date, p_name, left(p_label, 80), left(p_path, 120), 1)
  on conflict (day, name, label, path) do update set count = public.events.count + 1;
$$;

-- ---------------------------------------------------------------- activity log
create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  action text not null,
  table_name text not null,
  row_id text,
  before jsonb,
  after jsonb
);
create index activity_log_at_idx on public.activity_log (at desc);

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rid text;
  b jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  a jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  -- New public leads are not "admin activity"; everything else is logged.
  if tg_table_name = 'leads' and tg_op = 'INSERT' then return new; end if;
  rid := coalesce(a, b) ->> (case tg_table_name when 'services' then 'slug' else 'id' end);
  insert into public.activity_log (actor, actor_email, action, table_name, row_id, before, after)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), lower(tg_op), tg_table_name, rid, b, a);
  return coalesce(new, old);
end $$;

create trigger log_services after insert or update or delete on public.services for each row execute function public.log_activity();
create trigger log_faqs after insert or update or delete on public.faqs for each row execute function public.log_activity();
create trigger log_testimonials after insert or update or delete on public.testimonials for each row execute function public.log_activity();
create trigger log_leads after insert or update or delete on public.leads for each row execute function public.log_activity();
create trigger log_profiles after insert or update or delete on public.profiles for each row execute function public.log_activity();

-- Never allow the last owner to be demoted or deleted (PRD: "no single master" — aim for 2+).
create function public.owner_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if (select count(*) from public.profiles where role = 'owner' and id <> old.id) < 1 then
      raise exception 'At least one owner must remain';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger profiles_owner_guard before update or delete on public.profiles
  for each row execute function public.owner_guard();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.faqs enable row level security;
alter table public.testimonials enable row level security;
alter table public.leads enable row level security;
alter table public.activity_log enable row level security;
alter table public.rate_limits enable row level security;
alter table public.events enable row level security;

-- profiles: everyone signed in sees their own row (needed before MFA to show the right screen)
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_owner_read on public.profiles for select to authenticated using (public.has_role('owner'));
create policy profiles_owner_update on public.profiles for update to authenticated using (public.has_role('owner')) with check (public.has_role('owner'));
create policy profiles_owner_delete on public.profiles for delete to authenticated using (public.has_role('owner') and id <> auth.uid());

-- content: owner + editor write; all admin roles read
do $$
declare t text;
begin
  foreach t in array array['services','faqs','testimonials'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.has_role(''owner'',''editor'',''viewer''))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.has_role(''owner'',''editor''))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.has_role(''owner'',''editor'')) with check (public.has_role(''owner'',''editor''))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.has_role(''owner'',''editor''))', t);
  end loop;
end $$;

-- leads: all roles read; owner + editor update (editor limited by leads_guard); owner deletes.
-- No insert policy: public leads are inserted only by /api/lead with the service key.
create policy leads_read on public.leads for select to authenticated using (public.has_role('owner','editor','viewer'));
create policy leads_update on public.leads for update to authenticated using (public.has_role('owner','editor')) with check (public.has_role('owner','editor'));
create policy leads_delete on public.leads for delete to authenticated using (public.has_role('owner'));

create policy activity_read on public.activity_log for select to authenticated using (public.has_role('owner','editor'));
create policy events_read on public.events for select to authenticated using (public.has_role('owner','editor','viewer'));
-- rate_limits: no policies → only the service role can touch it.

-- Lock down function execution from the public API.
revoke execute on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;
revoke execute on function public.bump_event(text, text, text) from public, anon, authenticated;
