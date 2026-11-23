-- ============================================================================
-- HOME MONI & PHU DONG SKYONE (v1.9+) — COMPLETE SUPABASE POSTGRESQL SCHEMA
-- Copy and run this script in Supabase Dashboard -> SQL Editor.
-- 100% Idempotent & Backwards-Compatible: safe on both fresh & legacy DBs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. CORE TABLES: HOUSEHOLDS, HOUSEHOLD_MEMBERS, PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Tổ Ấm Home Moni',
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'PARTNER')),
  member_slot text NOT NULL CHECK (member_slot IN ('HUSBAND', 'WIFE')),
  display_name text NOT NULL DEFAULT '',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  member_slot text NOT NULL DEFAULT 'HUSBAND' CHECK (member_slot IN ('HUSBAND', 'WIFE')),
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  role text CHECK (role IN ('OWNER', 'PARTNER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Tổ Ấm Home Moni';
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'PARTNER';
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS member_slot text NOT NULL DEFAULT 'HUSBAND';
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_slot text NOT NULL DEFAULT 'HUSBAND';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_household_id ON public.profiles(household_id);

-- ============================================================================
-- 2. SCOPED DATA TABLES (4 SUB-APPS: FINANCE, SKYONE, GOLD, INTERIOR)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  color text NOT NULL,
  icon text,
  is_default boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.accounts (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('BANK', 'CASH', 'E_WALLET', 'CREDIT_CARD')),
  owner text NOT NULL CHECK (owner IN ('HUSBAND', 'WIFE', 'SHARED')),
  is_salary_account boolean NOT NULL DEFAULT false,
  credit_limit numeric NOT NULL DEFAULT 0,
  statement_day int,
  due_day int,
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  account_number text,
  color text,
  icon text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  amount numeric NOT NULL,
  date text NOT NULL,
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  category_id text,
  account_id text NOT NULL,
  to_account_id text,
  member_id text NOT NULL CHECK (member_id IN ('HUSBAND', 'WIFE', 'SHARED')),
  scope text NOT NULL CHECK (scope IN ('FAMILY', 'PERSONAL')),
  note text,
  tag text DEFAULT 'NORMAL',
  created_at text NOT NULL DEFAULT (now()::text),
  updated_at text NOT NULL DEFAULT (now()::text),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.category_budgets (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id text NOT NULL,
  month text NOT NULL,
  limit_amount numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS public.savings_goals (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline text,
  icon text,
  is_completed boolean NOT NULL DEFAULT false,
  member_id text NOT NULL DEFAULT 'SHARED',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.debts (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('BORROW', 'LEND')),
  total_amount numeric NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  start_date text NOT NULL,
  due_date text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'PAID')),
  member_id text NOT NULL DEFAULT 'SHARED',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.investments (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('GOLD', 'SAVINGS', 'STOCK', 'OTHER')),
  amount numeric NOT NULL,
  current_value numeric,
  expected_profit_rate numeric NOT NULL DEFAULT 0,
  start_date text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'CLOSED')),
  member_id text NOT NULL DEFAULT 'SHARED',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.recurring_rules (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  category_id text NOT NULL,
  account_id text NOT NULL,
  to_account_id text,
  member_id text NOT NULL CHECK (member_id IN ('HUSBAND', 'WIFE', 'SHARED')),
  scope text NOT NULL CHECK (scope IN ('FAMILY', 'PERSONAL')),
  day_of_month int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_applied_month text,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.skyone_loans (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT 'skyone_default',
  contract_data jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.gold_portfolios (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT 'gold_default',
  portfolio_data jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.interior_studios (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  id text NOT NULL DEFAULT 'interior_a12a07',
  studio_data jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.household_settings (
  household_id uuid PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  theme_color text NOT NULL DEFAULT 'blue',
  currency text NOT NULL DEFAULT 'VND',
  notifications_enabled boolean NOT NULL DEFAULT true,
  husband_name text NOT NULL DEFAULT 'Anh Chuột',
  wife_name text NOT NULL DEFAULT 'Bé Mèo',
  shared_split_ratio_husband numeric NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. SAFE LEGACY COLUMN UPGRADES (INCLUDES household_id + NEW COLUMNS + UNIQUE INDEXES)
-- Ensures legacy single-user DBs never fail with 42703 or 42P10 on upsert
-- ============================================================================

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_salary_account boolean NOT NULL DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS statement_day int;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS due_day int;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS initial_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_id text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS to_account_id text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tag text DEFAULT 'NORMAL';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at text NOT NULL DEFAULT (now()::text);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at text NOT NULL DEFAULT (now()::text);

ALTER TABLE public.category_budgets ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.category_budgets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS current_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS deadline text;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS member_id text NOT NULL DEFAULT 'SHARED';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS interest_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS member_id text NOT NULL DEFAULT 'SHARED';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS current_value numeric;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS expected_profit_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS member_id text NOT NULL DEFAULT 'SHARED';
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS to_account_id text;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS last_applied_month text;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.recurring_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.skyone_loans ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.skyone_loans ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
ALTER TABLE public.skyone_loans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.gold_portfolios ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.gold_portfolios ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
ALTER TABLE public.gold_portfolios ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.interior_studios ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.interior_studios ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
ALTER TABLE public.interior_studios ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT 'blue';
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'VND';
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS husband_name text NOT NULL DEFAULT 'Anh Chuột';
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS wife_name text NOT NULL DEFAULT 'Bé Mèo';
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS shared_split_ratio_husband numeric NOT NULL DEFAULT 50;
ALTER TABLE public.household_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill legacy rows with NULL household_id if table previously used user_id
DO $$
DECLARE
  t text;
  has_user_id boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories',
    'accounts',
    'transactions',
    'category_budgets',
    'savings_goals',
    'debts',
    'investments',
    'recurring_rules',
    'skyone_loans',
    'gold_portfolios',
    'interior_studios',
    'household_settings'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) INTO has_user_id;

    IF has_user_id THEN
      EXECUTE format(
        'UPDATE public.%I tbl SET household_id = hm.household_id FROM public.household_members hm WHERE tbl.household_id IS NULL AND tbl.user_id = hm.user_id;',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Unique indexes matching EVERY onConflict target used by supabaseService.ts
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_hh_id ON public.categories(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_hh_id ON public.accounts(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_hh_id ON public.transactions(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_budgets_hh_cat_month ON public.category_budgets(household_id, category_id, month);
CREATE UNIQUE INDEX IF NOT EXISTS uq_savings_goals_hh_id ON public.savings_goals(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_debts_hh_id ON public.debts(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_investments_hh_id ON public.investments(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recurring_rules_hh_id ON public.recurring_rules(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skyone_loans_hh_id ON public.skyone_loans(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gold_portfolios_hh_id ON public.gold_portfolios(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_studios_hh_id ON public.interior_studios(household_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_settings_hh ON public.household_settings(household_id);

CREATE INDEX IF NOT EXISTS idx_transactions_hh_date ON public.transactions(household_id, date DESC);

-- ============================================================================
-- 4. PROFILE AUTO-PROVISION TRIGGER & EXISTING USER BACKFILL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot text;
  v_name text;
BEGIN
  v_slot := CASE
    WHEN upper(coalesce(NEW.raw_user_meta_data ->> 'member_slot', '')) IN ('HUSBAND', 'WIFE')
      THEN upper(NEW.raw_user_meta_data ->> 'member_slot')
    ELSE 'HUSBAND'
  END;

  v_name := coalesce(
    nullif(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(NEW.email, ''), '@', 1),
    ''
  );

  INSERT INTO public.profiles (id, email, display_name, member_slot)
  VALUES (NEW.id, NEW.email, v_name, v_slot)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = CASE
          WHEN nullif(trim(public.profiles.display_name), '') IS NULL THEN EXCLUDED.display_name
          ELSE public.profiles.display_name
        END,
        member_slot = coalesce(nullif(public.profiles.member_slot, ''), EXCLUDED.member_slot),
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

INSERT INTO public.profiles (id, email, display_name, member_slot, household_id, role)
SELECT
  u.id,
  u.email,
  coalesce(nullif(hm.display_name, ''), split_part(coalesce(u.email, ''), '@', 1), ''),
  coalesce(hm.member_slot, 'HUSBAND'),
  hm.household_id,
  hm.role
FROM auth.users u
LEFT JOIN public.household_members hm ON hm.user_id = u.id
ON CONFLICT (id) DO UPDATE
  SET email = coalesce(EXCLUDED.email, public.profiles.email),
      household_id = coalesce(public.profiles.household_id, EXCLUDED.household_id),
      role = coalesce(public.profiles.role, EXCLUDED.role);

-- ============================================================================
-- 5. NON-RECURSIVE RLS HELPERS & HOUSEHOLD PAIRING RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT p.household_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_household_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT hm.role FROM public.household_members hm WHERE hm.user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = p_household_id
      AND hm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.household_id = p_household_id
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_household_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := 'MONI-';
  i int;
BEGIN
  FOR i IN 1..4 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_household(
  p_name text DEFAULT 'Tổ Ấm Home Moni',
  p_member_slot text DEFAULT 'HUSBAND',
  p_display_name text DEFAULT ''
)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.households;
  v_code text;
  v_household public.households;
  v_slot text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập trước khi tạo Tổ ấm.';
  END IF;

  v_slot := CASE WHEN p_member_slot IN ('HUSBAND', 'WIFE') THEN p_member_slot ELSE 'HUSBAND' END;

  SELECT h.* INTO v_existing
  FROM public.households h
  JOIN public.household_members hm ON hm.household_id = h.id
  WHERE hm.user_id = v_uid
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  LOOP
    v_code := public.generate_household_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = v_code);
  END LOOP;

  INSERT INTO public.households (name, invite_code, created_by)
  VALUES (coalesce(nullif(trim(p_name), ''), 'Tổ Ấm Home Moni'), v_code, v_uid)
  RETURNING * INTO v_household;

  INSERT INTO public.household_members (household_id, user_id, role, member_slot, display_name)
  VALUES (
    v_household.id,
    v_uid,
    'OWNER',
    v_slot,
    coalesce(nullif(trim(p_display_name), ''), CASE WHEN v_slot = 'HUSBAND' THEN 'Anh Chuột' ELSE 'Bé Mèo' END)
  );

  INSERT INTO public.profiles (id, email, display_name, member_slot, household_id, role, updated_at)
  VALUES (
    v_uid,
    (SELECT u.email FROM auth.users u WHERE u.id = v_uid),
    coalesce(nullif(trim(p_display_name), ''), CASE WHEN v_slot = 'HUSBAND' THEN 'Anh Chuột' ELSE 'Bé Mèo' END),
    v_slot,
    v_household.id,
    'OWNER',
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        member_slot = EXCLUDED.member_slot,
        household_id = EXCLUDED.household_id,
        role = EXCLUDED.role,
        updated_at = now();

  RETURN v_household;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_household_by_code(
  p_invite_code text,
  p_member_slot text DEFAULT 'WIFE',
  p_display_name text DEFAULT ''
)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_code text := upper(trim(coalesce(p_invite_code, '')));
  v_household public.households;
  v_member_count int;
  v_slot text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập trước khi tham gia Tổ ấm.';
  END IF;

  IF length(v_clean_code) < 4 THEN
    RAISE EXCEPTION 'Mã mời gia đình không hợp lệ.';
  END IF;

  SELECT * INTO v_household
  FROM public.households
  WHERE invite_code = v_clean_code
  LIMIT 1;

  IF v_household.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy Tổ ấm nào khớp mã mời "%".', v_clean_code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = v_uid AND household_id = v_household.id
  ) THEN
    RETURN v_household;
  END IF;

  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Tài khoản này đang thuộc một Tổ ấm khác. Hãy rời Tổ ấm hiện tại trước.';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.household_members
  WHERE household_id = v_household.id;

  IF v_member_count >= 4 THEN
    RAISE EXCEPTION 'Tổ ấm đã đạt giới hạn thiết bị/thành viên tối đa.';
  END IF;

  v_slot := CASE WHEN p_member_slot IN ('HUSBAND', 'WIFE') THEN p_member_slot ELSE 'WIFE' END;

  INSERT INTO public.household_members (household_id, user_id, role, member_slot, display_name)
  VALUES (
    v_household.id,
    v_uid,
    'PARTNER',
    v_slot,
    coalesce(nullif(trim(p_display_name), ''), CASE WHEN v_slot = 'HUSBAND' THEN 'Anh Chuột' ELSE 'Bé Mèo' END)
  );

  INSERT INTO public.profiles (id, email, display_name, member_slot, household_id, role, updated_at)
  VALUES (
    v_uid,
    (SELECT u.email FROM auth.users u WHERE u.id = v_uid),
    coalesce(nullif(trim(p_display_name), ''), CASE WHEN v_slot = 'HUSBAND' THEN 'Anh Chuột' ELSE 'Bé Mèo' END),
    v_slot,
    v_household.id,
    'PARTNER',
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        member_slot = EXCLUDED.member_slot,
        household_id = EXCLUDED.household_id,
        role = EXCLUDED.role,
        updated_at = now();

  RETURN v_household;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_invite_code(p_household_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = v_uid AND role = 'OWNER'
  ) THEN
    RAISE EXCEPTION 'Chỉ chủ Tổ ấm mới có quyền đổi mã mời.';
  END IF;

  LOOP
    v_new_code := public.generate_household_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = v_new_code);
  END LOOP;

  UPDATE public.households SET invite_code = v_new_code WHERE id = p_household_id;
  RETURN v_new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_household(p_household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_remaining int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = v_uid;

  UPDATE public.profiles
  SET household_id = NULL,
      role = NULL,
      updated_at = now()
  WHERE id = v_uid AND household_id = p_household_id;

  SELECT count(*) INTO v_remaining
  FROM public.household_members
  WHERE household_id = p_household_id;

  IF v_remaining = 0 THEN
    DELETE FROM public.households WHERE id = p_household_id;
  END IF;
END;
$$;

-- ============================================================================
-- 6. OPTIMISTIC CONCURRENCY TRIGGER FOR JSONB SUB-APP TABLES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bump_jsonb_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.revision := coalesce(OLD.revision, 1) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_revision_skyone_loans ON public.skyone_loans;
CREATE TRIGGER trg_bump_revision_skyone_loans
  BEFORE UPDATE ON public.skyone_loans
  FOR EACH ROW EXECUTE FUNCTION public.bump_jsonb_revision();

DROP TRIGGER IF EXISTS trg_bump_revision_gold_portfolios ON public.gold_portfolios;
CREATE TRIGGER trg_bump_revision_gold_portfolios
  BEFORE UPDATE ON public.gold_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.bump_jsonb_revision();

DROP TRIGGER IF EXISTS trg_bump_revision_interior_studios ON public.interior_studios;
CREATE TRIGGER trg_bump_revision_interior_studios
  BEFORE UPDATE ON public.interior_studios
  FOR EACH ROW EXECUTE FUNCTION public.bump_jsonb_revision();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) — STRICTLY SCOPED TO AUTHENTICATED
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skyone_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_same_household ON public.profiles;
CREATE POLICY profiles_select_same_household ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR (
      household_id IS NOT NULL
      AND household_id = public.current_user_household_id()
    )
  );

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND household_id IS NULL
    AND role IS NULL
  );

DROP POLICY IF EXISTS profiles_update_self_safe ON public.profiles;
CREATE POLICY profiles_update_self_safe ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND household_id IS NOT DISTINCT FROM public.current_user_household_id()
    AND role IS NOT DISTINCT FROM public.current_user_household_role()
  );

DROP POLICY IF EXISTS households_member_select ON public.households;
CREATE POLICY households_member_select ON public.households
  FOR SELECT TO authenticated
  USING (public.is_household_member(id));

DROP POLICY IF EXISTS households_owner_update ON public.households;
CREATE POLICY households_owner_update ON public.households
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = id AND hm.user_id = auth.uid() AND hm.role = 'OWNER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = id AND hm.user_id = auth.uid() AND hm.role = 'OWNER'
    )
  );

DROP POLICY IF EXISTS household_members_select ON public.household_members;
CREATE POLICY household_members_select ON public.household_members
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories',
    'accounts',
    'transactions',
    'category_budgets',
    'savings_goals',
    'debts',
    'investments',
    'recurring_rules',
    'skyone_loans',
    'gold_portfolios',
    'interior_studios',
    'household_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_member_all ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_member_all ON public.%I FOR ALL TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));',
      t,
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- 8. EXPLICIT GRANTS FOR AUTHENTICATED & REVOKE ANON ON RPCS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.households,
  public.household_members,
  public.categories,
  public.accounts,
  public.transactions,
  public.category_budgets,
  public.savings_goals,
  public.debts,
  public.investments,
  public.recurring_rules,
  public.skyone_loans,
  public.gold_portfolios,
  public.interior_studios,
  public.household_settings
TO authenticated;

REVOKE ALL ON FUNCTION public.create_household(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_household_by_code(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_invite_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_household(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_household_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_household_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_household_role() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_household(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_household_role() TO authenticated;

-- ============================================================================
-- 9. SUPABASE REALTIME PUBLICATION & REPLICA IDENTITY FULL
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
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
    'gold_portfolios',
    'interior_studios',
    'household_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 10. PRIVATE SUPABASE STORAGE BUCKET (SNAG PHOTOS & 3D GLB MODELS)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'household-media',
  'household-media',
  false,
  15728640,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS household_media_member_select ON storage.objects;
CREATE POLICY household_media_member_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'household-media'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS household_media_member_insert ON storage.objects;
CREATE POLICY household_media_member_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'household-media'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS household_media_member_update ON storage.objects;
CREATE POLICY household_media_member_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'household-media'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_household_member(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'household-media'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS household_media_member_delete ON storage.objects;
CREATE POLICY household_media_member_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'household-media'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- 11. IMMEDIATE POSTGREST SCHEMA CACHE RELOAD
-- ============================================================================
NOTIFY pgrst, 'reload schema';
