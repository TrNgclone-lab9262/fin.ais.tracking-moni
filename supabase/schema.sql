-- ============================================================================
-- HOME MONI & PHU DONG SKYONE — SUPABASE POSTGRESQL + RLS + REALTIME SCHEMA
-- Copy and run this script once in your Supabase Dashboard -> SQL Editor.
-- Idempotent: safe to re-run when upgrading tables or policies.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. HOUSEHOLDS & INVITE CODE PAIRING
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Tổ Ấm Home Moni',
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'PARTNER')),
  member_slot text not null check (member_slot in ('HUSBAND', 'WIFE')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create index if not exists idx_household_members_user on public.household_members(user_id);

-- 1B. USER PROFILES (Linked directly to auth.users & households)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  avatar_url text,
  member_slot text not null default 'HUSBAND' check (member_slot in ('HUSBAND', 'WIFE')),
  household_id uuid references public.households(id) on delete set null,
  role text check (role in ('OWNER', 'PARTNER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_household_id on public.profiles(household_id);

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Idempotent backfill for existing auth users & household members
insert into public.profiles (id, email, display_name, member_slot, household_id, role)
select
  u.id,
  u.email,
  coalesce(nullif(hm.display_name, ''), split_part(coalesce(u.email, ''), '@', 1), ''),
  coalesce(hm.member_slot, 'HUSBAND'),
  hm.household_id,
  hm.role
from auth.users u
left join public.household_members hm on hm.user_id = u.id
on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      household_id = coalesce(public.profiles.household_id, excluded.household_id),
      role = coalesce(public.profiles.role, excluded.role);

-- Non-recursive SECURITY DEFINER helpers for RLS
create or replace function public.current_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.household_id from public.profiles p where p.id = auth.uid() limit 1),
    (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1)
  );
$$;

create or replace function public.current_user_household_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid() limit 1),
    (select hm.role from public.household_members hm where hm.user_id = auth.uid() limit 1)
  );
$$;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.household_id = p_household_id
  );
$$;

-- Helper: generate clean 8-character invite code (e.g. MONI-7K9P)
create or replace function public.generate_household_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := 'MONI-';
  i int;
begin
  for i in 1..4 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$;

-- RPC: Create household & enroll creator as OWNER
create or replace function public.create_household(
  p_name text default 'Tổ Ấm Home Moni',
  p_member_slot text default 'HUSBAND',
  p_display_name text default ''
)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.households;
  v_code text;
  v_household public.households;
  v_slot text;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập trước khi tạo Tổ ấm.';
  end if;

  if p_member_slot not in ('HUSBAND', 'WIFE') then
    v_slot := 'HUSBAND';
  else
    v_slot := p_member_slot;
  end if;

  -- If already in a household, return it
  select h.* into v_existing
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where hm.user_id = v_uid
  limit 1;

  if v_existing.id is not null then
    return v_existing;
  end if;

  loop
    v_code := public.generate_household_invite_code();
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  insert into public.households (name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Tổ Ấm Home Moni'), v_code, v_uid)
  returning * into v_household;

  insert into public.household_members (household_id, user_id, role, member_slot, display_name)
  values (
    v_household.id,
    v_uid,
    'OWNER',
    v_slot,
    coalesce(nullif(trim(p_display_name), ''), case when v_slot = 'HUSBAND' then 'Anh Chuột' else 'Bé Mèo' end)
  );

  insert into public.profiles (id, email, display_name, member_slot, household_id, role, updated_at)
  values (
    v_uid,
    (select u.email from auth.users u where u.id = v_uid),
    coalesce(nullif(trim(p_display_name), ''), case when v_slot = 'HUSBAND' then 'Anh Chuột' else 'Bé Mèo' end),
    v_slot,
    v_household.id,
    'OWNER',
    now()
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        member_slot = excluded.member_slot,
        household_id = excluded.household_id,
        role = excluded.role,
        updated_at = now();

  return v_household;
end;
$$;

-- RPC: Join household using invite code
create or replace function public.join_household_by_code(
  p_invite_code text,
  p_member_slot text default 'WIFE',
  p_display_name text default ''
)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_code text := upper(trim(coalesce(p_invite_code, '')));
  v_household public.households;
  v_member_count int;
  v_slot text;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập trước khi tham gia Tổ ấm.';
  end if;

  if length(v_clean_code) < 4 then
    raise exception 'Mã mời gia đình không hợp lệ.';
  end if;

  select * into v_household
  from public.households
  where invite_code = v_clean_code
  limit 1;

  if v_household.id is null then
    raise exception 'Không tìm thấy Tổ ấm nào khớp mã mời "%".', v_clean_code;
  end if;

  if exists (
    select 1 from public.household_members
    where user_id = v_uid and household_id = v_household.id
  ) then
    return v_household;
  end if;

  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'Tài khoản này đang thuộc một Tổ ấm khác. Hãy rời Tổ ấm hiện tại trước.';
  end if;

  select count(*) into v_member_count
  from public.household_members
  where household_id = v_household.id;

  if v_member_count >= 4 then
    raise exception 'Tổ ấm đã đạt giới hạn thiết bị/thành viên tối đa.';
  end if;

  v_slot := case when p_member_slot in ('HUSBAND', 'WIFE') then p_member_slot else 'WIFE' end;

  insert into public.household_members (household_id, user_id, role, member_slot, display_name)
  values (
    v_household.id,
    v_uid,
    'PARTNER',
    v_slot,
    coalesce(nullif(trim(p_display_name), ''), case when v_slot = 'HUSBAND' then 'Anh Chuột' else 'Bé Mèo' end)
  );

  insert into public.profiles (id, email, display_name, member_slot, household_id, role, updated_at)
  values (
    v_uid,
    (select u.email from auth.users u where u.id = v_uid),
    coalesce(nullif(trim(p_display_name), ''), case when v_slot = 'HUSBAND' then 'Anh Chuột' else 'Bé Mèo' end),
    v_slot,
    v_household.id,
    'PARTNER',
    now()
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        member_slot = excluded.member_slot,
        household_id = excluded.household_id,
        role = excluded.role,
        updated_at = now();

  return v_household;
end;
$$;

-- RPC: Owner rotates invite code
create or replace function public.regenerate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_code text;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = v_uid and role = 'OWNER'
  ) then
    raise exception 'Chỉ chủ Tổ ấm mới có quyền đổi mã mời.';
  end if;

  loop
    v_new_code := public.generate_household_invite_code();
    exit when not exists (select 1 from public.households where invite_code = v_new_code);
  end loop;

  update public.households set invite_code = v_new_code where id = p_household_id;
  return v_new_code;
end;
$$;

-- RPC: Leave household safely
create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_remaining int;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  delete from public.household_members
  where household_id = p_household_id and user_id = v_uid;

  update public.profiles
  set household_id = null,
      role = null,
      updated_at = now()
  where id = v_uid and household_id = p_household_id;

  select count(*) into v_remaining
  from public.household_members
  where household_id = p_household_id;

  if v_remaining = 0 then
    delete from public.households where id = p_household_id;
  end if;
end;
$$;

-- 2. SCOPED FINANCIAL & SKYONE ENTITY TABLES
create table if not exists public.categories (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('INCOME', 'EXPENSE')),
  color text not null,
  icon text,
  is_default boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.accounts (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('BANK', 'CASH', 'E_WALLET', 'CREDIT_CARD')),
  owner text not null check (owner in ('HUSBAND', 'WIFE', 'SHARED')),
  is_salary_account boolean not null default false,
  credit_limit numeric not null default 0,
  statement_day int,
  due_day int,
  initial_balance numeric not null default 0,
  current_balance numeric not null default 0,
  account_number text,
  color text,
  icon text,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.transactions (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  amount numeric not null,
  date text not null,
  type text not null check (type in ('INCOME', 'EXPENSE', 'TRANSFER')),
  category_id text,
  account_id text not null,
  to_account_id text,
  member_id text not null check (member_id in ('HUSBAND', 'WIFE', 'SHARED')),
  scope text not null check (scope in ('FAMILY', 'PERSONAL')),
  note text,
  tag text default 'NORMAL',
  created_at text not null,
  updated_at text not null,
  primary key (household_id, id)
);

create index if not exists idx_transactions_hh_date on public.transactions(household_id, date desc);

create table if not exists public.category_budgets (
  household_id uuid not null references public.households(id) on delete cascade,
  category_id text not null,
  month text not null,
  limit_amount numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, category_id, month)
);

create table if not exists public.savings_goals (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline text,
  icon text,
  is_completed boolean not null default false,
  member_id text not null default 'SHARED',
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.debts (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('BORROW', 'LEND')),
  total_amount numeric not null,
  paid_amount numeric not null default 0,
  interest_rate numeric not null default 0,
  start_date text not null,
  due_date text not null,
  status text not null check (status in ('ACTIVE', 'PAID')),
  member_id text not null default 'SHARED',
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.investments (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('GOLD', 'SAVINGS', 'STOCK', 'OTHER')),
  amount numeric not null,
  current_value numeric,
  expected_profit_rate numeric not null default 0,
  start_date text not null,
  status text not null check (status in ('ACTIVE', 'CLOSED')),
  member_id text not null default 'SHARED',
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.recurring_rules (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null,
  amount numeric not null,
  type text not null check (type in ('INCOME', 'EXPENSE', 'TRANSFER')),
  category_id text not null,
  account_id text not null,
  to_account_id text,
  member_id text not null check (member_id in ('HUSBAND', 'WIFE', 'SHARED')),
  scope text not null check (scope in ('FAMILY', 'PERSONAL')),
  day_of_month int not null,
  is_active boolean not null default true,
  last_applied_month text,
  note text,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.skyone_loans (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null default 'skyone_default',
  contract_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.household_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  theme_color text not null default 'blue',
  currency text not null default 'VND',
  notifications_enabled boolean not null default true,
  husband_name text not null default 'Anh Chuột',
  wife_name text not null default 'Bé Mèo',
  shared_split_ratio_husband numeric not null default 50,
  updated_at timestamptz not null default now()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.category_budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.debts enable row level security;
alter table public.investments enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.skyone_loans enable row level security;
alter table public.household_settings enable row level security;

-- Profiles policies: self + paired household members only; household_id & role protected via RPC
drop policy if exists profiles_select_same_household on public.profiles;
create policy profiles_select_same_household on public.profiles
  for select using (
    auth.uid() = id
    or (
      household_id is not null
      and household_id = public.current_user_household_id()
    )
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (
    auth.uid() = id
    and household_id is null
    and role is null
  );

drop policy if exists profiles_update_self_safe on public.profiles;
create policy profiles_update_self_safe on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and household_id is not distinct from public.current_user_household_id()
    and role is not distinct from public.current_user_household_role()
  );

-- Households & Members policies (queries only allowed for members; join/create happen via SECURITY DEFINER RPC)
drop policy if exists households_member_select on public.households;
create policy households_member_select on public.households
  for select using (public.is_household_member(id));

drop policy if exists households_owner_update on public.households;
create policy households_owner_update on public.households
  for update using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = id and hm.user_id = auth.uid() and hm.role = 'OWNER'
    )
  );

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select using (public.is_household_member(household_id));

-- Scoped data tables policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories',
    'accounts',
    'transactions',
    'category_budgets',
    'savings_goals',
    'debts',
    'investments',
    'recurring_rules',
    'skyone_loans',
    'household_settings'
  ]
  loop
    execute format('drop policy if exists %I_member_all on public.%I;', t, t);
    execute format(
      'create policy %I_member_all on public.%I for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));',
      t,
      t
    );
  end loop;
end $$;

-- 4. ENABLE SUPABASE REALTIME PUBLICATION
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'households',
    'household_members',
    'categories',
    'accounts',
    'transactions',
    'category_budgets',
    'savings_goals',
    'debts',
    'investments',
    'recurring_rules',
    'skyone_loans',
    'household_settings'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end $$;
