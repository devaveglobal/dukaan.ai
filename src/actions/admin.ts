"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { Profile, IncompleteSaleReview } from "@/types";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") throw new Error("Forbidden");
  return user;
}

async function findAuthUserByEmail(email: string) {
  const supabaseAdmin = getAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const user = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  return null;
}

export interface SellerAccount {
  id: string;
  email: string;
  full_name: string;
  branch: string;
  created_at: string;
  is_active: boolean;
  setup_status: "active" | "pending";
}

export async function getAllReceipts(filters?: {
  seller_id?: string;
  from?: string;
  to?: string;
  item_name?: string;
}) {
  await requireAdmin();
  const supabase = await createServerClient();

  let query = supabase
    .from("receipts")
    .select("*, seller:profiles(id, full_name, email)")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (filters?.seller_id) query = query.eq("seller_id", filters.seller_id);
  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getAllSellers() {
  await requireAdmin();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "seller")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Profile[];
}

export async function toggleSellerStatus(sellerId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", sellerId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/sellers");
}

export async function adminVoidReceipt(id: string) {
  const user = await requireAdmin();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("receipts")
    .update({ is_deleted: true, voided_by: user.id, voided_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/receipts");
}

export async function inviteSeller(formData: { email: string; full_name: string; branch: string }) {
  // 1. Check if user is admin (using standard client)
  await requireAdmin();

  // 2. Use service role to pre-create user in Auth
  const supabaseAdmin = getAdminClient();
  const seller = {
    email: formData.email.trim().toLowerCase(),
    full_name: formData.full_name.trim(),
    branch: formData.branch.trim(),
  };

  // Create invitation record
  const { error: invError } = await supabaseAdmin
    .from("seller_invitations")
    .upsert([seller], { onConflict: "email" });

  if (invError) throw new Error(invError.message);

  // Pre-create the user in Auth so they are "confirmed" and can use OTP Sign-in directly
  const { error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: seller.email,
    email_confirm: true,
    app_metadata: {
      password_set: false,
    },
    user_metadata: {
      role: "seller",
      full_name: seller.full_name,
      branch: seller.branch
    }
  });

  if (authError && authError.code !== "email_exists" && !authError.message.includes("already registered")) {
    throw new Error(authError.message);
  }

  if (authError?.code === "email_exists") {
    const existingUser = await findAuthUserByEmail(seller.email);
    if (existingUser) {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...existingUser.user_metadata,
          role: "seller",
          full_name: seller.full_name,
          branch: seller.branch,
        },
        app_metadata: {
          ...existingUser.app_metadata,
          password_set: existingUser.app_metadata?.password_set === true,
        },
      });

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: existingUser.id,
          email: seller.email,
          full_name: seller.full_name,
          role: "seller",
          branch: seller.branch,
          currency: "Rs",
        });

      if (profileError) throw new Error(profileError.message);
    }

    await supabaseAdmin.from("seller_invitations").delete().eq("email", seller.email);
  }

  revalidatePath("/admin/sellers");
}

export async function getIncompleteSaleReviews(): Promise<IncompleteSaleReview[]> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("incomplete_sales")
    .select("*, seller:profiles(full_name, email, branch)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IncompleteSaleReview[];
}

export async function resolveIncompleteSale(params: {
  id: string;
  item_id: string;
  quantity: number;
  price: number;
  admin_comment: string;
  seller_id: string;
}) {
  await requireAdmin();
  const supabase = await createServerClient();

  // Create a real sale from the resolved data
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      seller_id: params.seller_id,
      payment_status: "paid",
      total_amount: params.quantity * params.price,
      ai_confidence: 1,
      notes: `Resolved by admin: ${params.admin_comment}`,
    })
    .select()
    .single();
  if (saleError) throw new Error(saleError.message);

  await supabase.from("sale_items").insert({
    sale_id: sale.id,
    item_id: params.item_id,
    item_name: "",
    quantity: params.quantity,
    unit_price: params.price,
    total_price: params.quantity * params.price,
    matched: true,
  });

  // Deduct stock
  void supabase.rpc("decrement_stock", { p_item_id: params.item_id, p_quantity: params.quantity });

  // Mark incomplete_sale as resolved
  const { error } = await supabase
    .from("incomplete_sales")
    .update({
      status: "resolved",
      resolved_sale_id: sale.id,
      admin_comment: params.admin_comment,
      resolved_quantity: params.quantity,
      resolved_price: params.price,
      resolved_item_id: params.item_id,
    })
    .eq("id", params.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reviews");
  return sale;
}

export async function dismissIncompleteSale(id: string) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("incomplete_sales")
    .update({ status: "dismissed" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reviews");
}

export async function getSellerAccounts(): Promise<SellerAccount[]> {
  await requireAdmin();

  const supabaseAdmin = getAdminClient();
  const perPage = 1000;
  const authUsers = [];

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    authUsers.push(...data.users);
    if (data.users.length < perPage) break;
  }

  const sellers = authUsers.filter((user) => user.user_metadata?.role === "seller");
  const sellerIds = sellers.map((user) => user.id);

  const profilesById = new Map<string, Profile>();
  if (sellerIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("id", sellerIds);

    if (error) throw new Error(error.message);
    (data as Profile[] | null)?.forEach((profile) => profilesById.set(profile.id, profile));
  }

  return sellers
    .map((user) => {
      const profile = profilesById.get(user.id);
      const passwordSet = user.app_metadata?.password_set === true;

      return {
        id: user.id,
        email: user.email ?? profile?.email ?? "",
        full_name: profile?.full_name || user.user_metadata?.full_name || "N/A",
        branch: profile?.branch || user.user_metadata?.branch || "General",
        created_at: profile?.created_at ?? user.created_at,
        is_active: profile?.is_active ?? true,
        setup_status: passwordSet ? "active" : "pending",
      } satisfies SellerAccount;
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
