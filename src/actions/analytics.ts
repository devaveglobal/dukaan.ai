"use server";

import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") throw new Error("Forbidden");
  return supabase;
}

// ── KPI Cards ──────────────────────────────────────────────────────────────

export async function getAdminKpis() {
  const supabase = await requireAdmin();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [todayRes, monthRes, weekRes, pendingRes, incompleteRes, sellersRes] = await Promise.all([
    supabase.from("sales").select("total_amount").eq("payment_status", "paid").gte("created_at", todayStart),
    supabase.from("sales").select("total_amount").eq("payment_status", "paid").gte("created_at", monthStart),
    supabase.from("sales").select("total_amount, id").gte("created_at", weekStart),
    supabase.from("pending_payments").select("amount").eq("status", "pending"),
    supabase.from("incomplete_sales").select("id").eq("status", "pending_admin_review"),
    supabase.from("profiles").select("id").eq("role", "seller").eq("is_active", true),
  ]);

  const todayRevenue = todayRes.data?.reduce((s, r) => s + (r.total_amount ?? 0), 0) ?? 0;
  const monthRevenue = monthRes.data?.reduce((s, r) => s + (r.total_amount ?? 0), 0) ?? 0;
  const weekTransactions = weekRes.data?.length ?? 0;
  const weekRevenue = weekRes.data?.reduce((s, r) => s + (r.total_amount ?? 0), 0) ?? 0;
  const pendingTotal = pendingRes.data?.reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0;

  return {
    todayRevenue,
    monthRevenue,
    weekRevenue,
    weekTransactions,
    pendingTotal,
    pendingCount: pendingRes.data?.length ?? 0,
    incompleteCount: incompleteRes.data?.length ?? 0,
    activeSellers: sellersRes.data?.length ?? 0,
    avgSaleValue: weekTransactions > 0 ? weekRevenue / weekTransactions : 0,
  };
}

// ── Revenue by day (last 30 days) ──────────────────────────────────────────

export async function getRevenueByDay(days = 30) {
  const supabase = await requireAdmin();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data } = await supabase
    .from("sales")
    .select("total_amount, payment_status, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  // Group by date
  const map = new Map<string, { revenue: number; transactions: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { revenue: 0, transactions: 0 });
  }

  data?.forEach((s) => {
    const key = s.created_at.slice(0, 10);
    const entry = map.get(key);
    if (entry) {
      entry.transactions += 1;
      if (s.payment_status === "paid") entry.revenue += s.total_amount ?? 0;
    }
  });

  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
}

// ── Revenue by seller ──────────────────────────────────────────────────────

export async function getRevenueBySellerData() {
  const supabase = await requireAdmin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: sales } = await supabase
    .from("sales")
    .select("seller_id, total_amount, payment_status, created_at, seller:profiles(full_name, email)")
    .gte("created_at", monthStart);

  const map = new Map<string, { name: string; revenue: number; transactions: number; pending: number }>();

  sales?.forEach((s: any) => {
    const id = s.seller_id;
    if (!map.has(id)) {
      map.set(id, {
        name: s.seller?.full_name || s.seller?.email || "Unknown",
        revenue: 0,
        transactions: 0,
        pending: 0,
      });
    }
    const entry = map.get(id)!;
    entry.transactions += 1;
    if (s.payment_status === "paid") entry.revenue += s.total_amount ?? 0;
    if (s.payment_status === "pending") entry.pending += s.total_amount ?? 0;
  });

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

// ── Top products ───────────────────────────────────────────────────────────

export async function getTopProducts(limit = 10) {
  const supabase = await requireAdmin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data } = await supabase
    .from("sale_items")
    .select("item_name, quantity, total_price, sale:sales(created_at, payment_status)")
    .gte("sale.created_at", monthStart);

  const map = new Map<string, { name: string; units: number; revenue: number; transactions: number }>();

  data?.forEach((si: any) => {
    if (!si.sale) return;
    const key = si.item_name;
    if (!map.has(key)) map.set(key, { name: key, units: 0, revenue: 0, transactions: 0 });
    const entry = map.get(key)!;
    entry.units += si.quantity ?? 0;
    entry.revenue += si.total_price ?? 0;
    entry.transactions += 1;
  });

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ── Per-seller detail ──────────────────────────────────────────────────────

export async function getSellerDetail(sellerId: string) {
  const supabase = await requireAdmin();

  const [profileRes, salesRes, pendingRes, itemsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", sellerId).single(),
    supabase.from("sales").select("*").eq("seller_id", sellerId).order("created_at", { ascending: false }),
    supabase.from("pending_payments").select("*").eq("seller_id", sellerId).eq("status", "pending"),
    supabase.from("sale_items")
      .select("item_name, quantity, total_price, sale:sales(seller_id, created_at)")
      .eq("sale.seller_id", sellerId),
  ]);

  const sales = salesRes.data ?? [];
  const totalRevenue = sales.filter(s => s.payment_status === "paid").reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const pendingAmount = pendingRes.data?.reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0;

  // Daily revenue for this seller (last 14 days)
  const dailyMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }
  sales.forEach((s) => {
    const key = s.created_at.slice(0, 10);
    if (dailyMap.has(key) && s.payment_status === "paid") {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + (s.total_amount ?? 0));
    }
  });

  // Top items for this seller
  const itemMap = new Map<string, { name: string; units: number; revenue: number }>();
  itemsRes.data?.forEach((si: any) => {
    if (!si.sale || si.sale.seller_id !== sellerId) return;
    if (!itemMap.has(si.item_name)) itemMap.set(si.item_name, { name: si.item_name, units: 0, revenue: 0 });
    const e = itemMap.get(si.item_name)!;
    e.units += si.quantity ?? 0;
    e.revenue += si.total_price ?? 0;
  });

  return {
    profile: profileRes.data,
    totalRevenue,
    totalTransactions: sales.length,
    pendingAmount,
    pendingCount: pendingRes.data?.length ?? 0,
    recentSales: sales.slice(0, 10),
    dailyRevenue: Array.from(dailyMap.entries()).map(([date, revenue]) => ({ date, revenue })),
    topItems: Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

// ── Pending payments list ──────────────────────────────────────────────────

export async function getAllPendingPayments() {
  const supabase = await requireAdmin();
  const { data } = await supabase
    .from("pending_payments")
    .select("*, seller:profiles(full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ── Incomplete sales list ──────────────────────────────────────────────────

export async function getAllIncompleteSales() {
  const supabase = await requireAdmin();
  const { data } = await supabase
    .from("incomplete_sales")
    .select("*, seller:profiles(full_name, email)")
    .eq("status", "pending_admin_review")
    .order("created_at", { ascending: false });
  return data ?? [];
}
