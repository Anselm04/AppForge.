-- Billing / entitlement tables expected by api/stripe-webhook.js and api/customer-portal.js

create table if not exists public.appforge_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text not null default 'free',
  subscription_status text not null default 'none',
  monthly_build_credits integer not null default 0,
  build_credits_remaining integer not null default 0,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists appforge_entitlements_subscription_idx
  on public.appforge_entitlements (stripe_subscription_id);

alter table public.appforge_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "entitlements_select_own" on public.appforge_entitlements;
create policy "entitlements_select_own" on public.appforge_entitlements
  for select using (auth.uid() = user_id);

-- Service role bypasses RLS for webhook writes.
-- Authenticated users must not insert/update entitlements from the client.
