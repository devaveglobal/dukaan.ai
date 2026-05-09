-- ============================================================
-- Run this in Supabase SQL Editor (migration, not full reset)
-- ============================================================

-- Product aliases for fuzzy/semantic matching
create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade not null,
  alias text not null,
  created_at timestamptz default now()
);
create index if not exists idx_product_aliases_alias on public.product_aliases(lower(alias));
create index if not exists idx_product_aliases_item on public.product_aliases(item_id);

alter table public.product_aliases enable row level security;
create policy "All authenticated can read aliases" on public.product_aliases
  for select using (auth.uid() is not null);
create policy "Admins manage aliases" on public.product_aliases
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Sales table (confirmed transactions)
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade not null,
  customer_name text,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'pending', 'partial')),
  total_amount numeric(12,2) not null default 0,
  notes text,
  raw_message text,
  ai_confidence numeric(4,3) default 1.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sale items (line items per sale)
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,
  quantity numeric(12,2) default 1,
  unit_price numeric(12,2) default 0,
  total_price numeric(12,2) default 0,
  matched boolean default true
);

-- Pending payments (credit/udhaar)
create table if not exists public.pending_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  customer_name text,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'partial')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Incomplete sales (unresolved / unknown products)
create table if not exists public.incomplete_sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade not null,
  raw_message text not null,
  extracted_data jsonb default '{}',
  status text not null default 'pending_admin_review' check (status in ('pending_admin_review', 'resolved', 'dismissed')),
  resolved_sale_id uuid references public.sales(id),
  created_at timestamptz default now()
);

-- AI conversations (full history per session)
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id text not null,
  messages jsonb not null default '[]',
  context jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_ai_conversations_user_session on public.ai_conversations(user_id, session_id);

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.pending_payments enable row level security;
alter table public.incomplete_sales enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.audit_logs enable row level security;

-- Sales policies
create policy "Sellers view own sales" on public.sales for select using (auth.uid() = seller_id);
create policy "Sellers insert own sales" on public.sales for insert with check (auth.uid() = seller_id);
create policy "Sellers update own sales" on public.sales for update using (auth.uid() = seller_id);
create policy "Admins manage all sales" on public.sales for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Sale items policies
create policy "Sellers view own sale items" on public.sale_items for select using (
  exists (select 1 from public.sales where id = sale_id and seller_id = auth.uid())
);
create policy "Sellers insert own sale items" on public.sale_items for insert with check (
  exists (select 1 from public.sales where id = sale_id and seller_id = auth.uid())
);
create policy "Admins manage all sale items" on public.sale_items for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Pending payments policies
create policy "Sellers view own pending" on public.pending_payments for select using (auth.uid() = seller_id);
create policy "Sellers insert own pending" on public.pending_payments for insert with check (auth.uid() = seller_id);
create policy "Admins manage all pending" on public.pending_payments for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Incomplete sales policies
create policy "Sellers view own incomplete" on public.incomplete_sales for select using (auth.uid() = seller_id);
create policy "Sellers insert own incomplete" on public.incomplete_sales for insert with check (auth.uid() = seller_id);
create policy "Admins manage all incomplete" on public.incomplete_sales for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- AI conversations policies
create policy "Users manage own conversations" on public.ai_conversations for all using (auth.uid() = user_id);

-- Audit logs policies
create policy "Admins view audit logs" on public.audit_logs for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Stock decrement function (called after each sale)
create or replace function public.decrement_stock(p_item_id uuid, p_quantity numeric)
returns void language sql as $$
  update public.items
  set quantity = greatest(0, quantity - p_quantity),
      updated_at = now()
  where id = p_item_id;
$$;

-- Unique constraint for ai_conversations upsert
alter table public.ai_conversations
  drop constraint if exists ai_conversations_user_session_unique;
alter table public.ai_conversations
  add constraint ai_conversations_user_session_unique unique (user_id, session_id);
create extension if not exists pg_trgm;

create or replace function public.search_items(search_term text)
returns table (
  id uuid, name text, sku text, unit text, price numeric,
  quantity numeric, similarity_score real
) language sql stable as $$
  select
    i.id, i.name, i.sku, i.unit, i.price, i.quantity,
    greatest(
      similarity(lower(i.name), lower(search_term)),
      coalesce((select max(similarity(lower(a.alias), lower(search_term)))
                from public.product_aliases a where a.item_id = i.id), 0)
    ) as similarity_score
  from public.items i
  where
    similarity(lower(i.name), lower(search_term)) > 0.15
    or exists (
      select 1 from public.product_aliases a
      where a.item_id = i.id and similarity(lower(a.alias), lower(search_term)) > 0.15
    )
    or lower(i.name) like '%' || lower(search_term) || '%'
    or lower(i.sku) = lower(search_term)
  order by similarity_score desc
  limit 5;
$$;
