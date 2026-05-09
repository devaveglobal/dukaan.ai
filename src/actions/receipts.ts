"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Receipt, ReceiptItem } from "@/types";

export async function createReceipt(data: {
  items: ReceiptItem[];
  total_amount: number;
  customer_name?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: receipt, error } = await supabase
    .from("receipts")
    .insert({ ...data, seller_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  return receipt as Receipt;
}

export async function updateReceipt(
  id: string,
  data: Partial<Pick<Receipt, "items" | "total_amount" | "customer_name" | "notes">>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // 24-hour edit window
  const { data: existing } = await supabase
    .from("receipts")
    .select("created_at, seller_id")
    .eq("id", id)
    .single();

  if (!existing) throw new Error("Receipt not found");
  if (existing.seller_id !== user.id) throw new Error("Forbidden");

  const hoursSince = (Date.now() - new Date(existing.created_at).getTime()) / 36e5;
  if (hoursSince > 24) throw new Error("Edit window expired (24 hours)");

  const { data: receipt, error } = await supabase
    .from("receipts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
  return receipt as Receipt;
}

export async function deleteReceipt(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("receipts")
    .update({ is_deleted: true })
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
}

export async function getMyReceipts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("seller_id", user.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Receipt[];
}
