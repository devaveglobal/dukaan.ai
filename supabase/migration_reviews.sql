-- ============================================================
-- Run this in Supabase SQL Editor
-- Adds admin resolution columns to incomplete_sales
-- ============================================================

alter table public.incomplete_sales
  add column if not exists admin_comment text,
  add column if not exists resolved_quantity numeric(12,2),
  add column if not exists resolved_price numeric(12,2),
  add column if not exists resolved_item_id uuid references public.items(id);
