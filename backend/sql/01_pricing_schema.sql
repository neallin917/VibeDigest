-- Create a 'profiles' table to manage user credits and subscriptions
create type subscription_tier as enum ('free', 'pro');

create table public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  stripe_customer_id text unique,
  tier subscription_tier not null default 'free',
  usage_count int not null default 0,
  usage_limit int not null default 3, -- 3 for free, 100 for pro
  extra_credits int not null default 0, -- Purchased top-ups
  period_end timestamptz, -- When the monthly usage resets
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Turn on Row Level Security
alter table public.profiles enable row level security;

-- Create policies
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

-- Function to handle new user signup (Trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, tier, usage_limit)
  values (new.id, 'free', 3);
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
