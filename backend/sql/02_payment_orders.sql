-- Create a 'payment_orders' table to unify Stripe and Crypto records
create table if not exists public.payment_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  provider text not null, -- 'stripe' or 'coinbase'
  provider_payment_id text, -- session_id or charge_code
  amount_fiat numeric, -- USD value at time of creation, e.g., 20.00
  currency_fiat text default 'USD',
  amount_crypto numeric, -- Populated via webhook if crypto
  currency_crypto text, -- 'USDC', etc.
  status text default 'pending', -- pending, completed, failed
  metadata jsonb, -- Store exchange rate, network info, product_id here
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.payment_orders enable row level security;

-- Policies
create policy "Users can view their own orders" on public.payment_orders
  for select using (auth.uid() = user_id);

-- Optional: Index on provider_payment_id for fast webhook lookups
create index if not exists idx_payment_orders_provider_id on public.payment_orders(provider_payment_id);
