-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null check (role in ('seller', 'admin')) default 'seller',
  branch text,
  currency text default 'Rs',
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seller invitations table
create table public.seller_invitations (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  branch text,
  created_at timestamptz default now(),
  invited_by uuid references public.profiles(id)
);

-- Receipts table
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade not null,
  items jsonb not null default '[]',
  total_amount numeric(12, 2) not null,
  customer_name text,
  notes text,
  is_deleted boolean default false,
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat sessions table
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  messages jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  invitation record;
begin
  -- Try to find invitation for sellers
  select * into invitation from public.seller_invitations where email = new.email;

  insert into public.profiles (id, email, full_name, role, branch, currency)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', invitation.full_name, ''),
    coalesce(new.raw_user_meta_data->>'role', 'seller'),
    coalesce(new.raw_user_meta_data->>'branch', invitation.branch),
    coalesce(new.raw_user_meta_data->>'currency', 'Rs')
  );
  
  -- Clean up invitation if it exists
  if invitation.id is not null then
    delete from public.seller_invitations where id = invitation.id;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.receipts enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.seller_invitations enable row level security;

-- Invitations policies
create policy "Admins can manage invitations" on public.seller_invitations
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Receipts policies
create policy "Sellers can view own receipts" on public.receipts
  for select using (auth.uid() = seller_id);

create policy "Sellers can insert own receipts" on public.receipts
  for insert with check (auth.uid() = seller_id);

create policy "Sellers can update own receipts" on public.receipts
  for update using (auth.uid() = seller_id);

create policy "Admins can view all receipts" on public.receipts
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update all receipts" on public.receipts
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Chat sessions policies
create policy "Users can manage own sessions" on public.chat_sessions
  for all using (auth.uid() = user_id);

-- Items table
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text,
  description text,
  unit text not null default 'pcs',
  quantity numeric(12, 2) not null default 0,
  cost_price numeric(12, 2),
  price numeric(12, 2) not null,
  low_stock_threshold numeric(12, 2) default 0,
  barcode_number text unique,
  barcode_image_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.items enable row level security;

create policy "Admins can manage items" on public.items
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Sellers can view items" on public.items
  for select using (auth.uid() in (select id from public.profiles));

-- Enable realtime for receipts
alter publication supabase_realtime add table public.receipts;
