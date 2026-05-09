"use server";

import { createClient } from "@/lib/supabase/server";
import { ExtractedSaleData, Sale, PendingPayment } from "@/types";
import { matchProducts } from "@/lib/product-matcher";

export interface PersistResult {
  sale?: Sale;
  pending_payment?: PendingPayment;
  incomplete_id?: string;
  type: "sale" | "credit_sale" | "incomplete";
  unmatched_items: string[];   // items not found in DB catalog at all
  matched_items: string[];     // items successfully matched
}

export async function persistSale(
  extracted: ExtractedSaleData,
  rawMessage: string,
  sellerId: string
): Promise<PersistResult> {
  const supabase = await createClient();

  // Filter out empty item names (incomplete sentence with no item)
  const validItems = extracted.items.filter((i) => i.raw_name.trim().length > 0);

  // If no valid item names at all → pure incomplete sentence, log and return
  if (validItems.length === 0 && extracted.intent !== "query") {
    const { data: incomplete } = await supabase
      .from("incomplete_sales")
      .insert({
        seller_id: sellerId,
        raw_message: rawMessage,
        extracted_data: extracted as unknown as Record<string, unknown>,
        status: "pending_admin_review",
      })
      .select("id")
      .single();

    return { type: "incomplete", unmatched_items: [], matched_items: [], incomplete_id: incomplete?.id };
  }

  // Batch match all valid item names against DB catalog
  const rawNames = validItems.map((i) => i.raw_name);
  const matchMap = rawNames.length > 0 ? await matchProducts(rawNames) : new Map();

  const unmatched: string[] = []; // not in DB catalog at all
  const matched: string[] = [];

  const resolvedItems = validItems.map((item) => {
    const match = matchMap.get(item.raw_name);

    // Score < 0.3 means genuinely not in catalog (not a language/typo issue)
    if (!match || match.score < 0.3) {
      unmatched.push(item.raw_name);
      return { ...item, matched_item_id: null, matched_item_name: null };
    }

    matched.push(match.item.name);
    return {
      ...item,
      matched_item_id: match.item.id,
      matched_item_name: match.item.name,
      // Fill price from DB if seller didn't provide it
      unit_price: item.unit_price ?? match.item.price,
      total_price: item.total_price ?? (item.quantity != null
        ? item.quantity * (item.unit_price ?? match.item.price)
        : null),
    };
  });

  // ALL items are not in catalog → log as incomplete for admin review, don't create a sale
  const allUnmatched = unmatched.length === validItems.length;
  if (allUnmatched) {
    const { data: incomplete } = await supabase
      .from("incomplete_sales")
      .insert({
        seller_id: sellerId,
        raw_message: rawMessage,
        extracted_data: { ...extracted, unmatched_items: unmatched } as unknown as Record<string, unknown>,
        status: "pending_admin_review",
      })
      .select("id")
      .single();

    return { type: "incomplete", unmatched_items: unmatched, matched_items: [], incomplete_id: incomplete?.id };
  }

  // At least some items matched — create the sale
  const total = extracted.total_amount
    ?? resolvedItems.reduce((sum, i) => sum + (i.total_price ?? 0), 0);

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      seller_id: sellerId,
      customer_name: extracted.customer_name,
      payment_status: extracted.payment_status,
      total_amount: total,
      raw_message: rawMessage,
      ai_confidence: extracted.confidence,
      notes: unmatched.length > 0 ? `Items not in catalog: ${unmatched.join(", ")}` : null,
    })
    .select()
    .single();

  if (saleError || !sale) throw new Error(saleError?.message ?? "Failed to create sale");

  // Insert sale items
  const saleItemRows = resolvedItems.map((item) => ({
    sale_id: sale.id,
    item_id: item.matched_item_id ?? null,
    item_name: item.matched_item_name ?? item.raw_name,
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price ?? 0,
    total_price: item.total_price ?? 0,
    matched: !!item.matched_item_id,
  }));

  await supabase.from("sale_items").insert(saleItemRows);

  // Log unmatched items separately for admin review (partial sale — some items not in catalog)
  if (unmatched.length > 0) {
    await supabase.from("incomplete_sales").insert({
      seller_id: sellerId,
      raw_message: rawMessage,
      extracted_data: {
        ...extracted,
        unmatched_items: unmatched,
        reason: "items_not_in_catalog",
      } as unknown as Record<string, unknown>,
      status: "pending_admin_review",
      resolved_sale_id: sale.id,
    });
  }

  // Create pending payment record for credit sales
  let pending_payment: PendingPayment | undefined;
  if (extracted.payment_status === "pending" || extracted.payment_status === "partial") {
    const { data: pp } = await supabase
      .from("pending_payments")
      .insert({
        sale_id: sale.id,
        seller_id: sellerId,
        customer_name: extracted.customer_name,
        amount: total,
        status: extracted.payment_status,
      })
      .select()
      .single();
    pending_payment = pp ?? undefined;
  }

  // Deduct stock — fire and forget
  for (const item of resolvedItems) {
    if (item.matched_item_id && item.quantity) {
      void supabase.rpc("decrement_stock", {
        p_item_id: item.matched_item_id,
        p_quantity: item.quantity,
      });
    }
  }

  return {
    sale: sale as Sale,
    pending_payment,
    type: extracted.payment_status === "paid" ? "sale" : "credit_sale",
    unmatched_items: unmatched,
    matched_items: matched,
  };
}

// Save a pending context (incomplete sentence waiting for follow-up)
export async function savePendingContext(
  sellerId: string,
  sessionId: string,
  context: Record<string, unknown>
) {
  const supabase = await createClient();
  await supabase.from("ai_conversations").upsert(
    {
      user_id: sellerId,
      session_id: sessionId,
      messages: [],
      context,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_id" }
  );
}

// Load pending context for a session
export async function loadPendingContext(
  sellerId: string,
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("context")
    .eq("user_id", sellerId)
    .eq("session_id", sessionId)
    .single();
  const ctx = data?.context as Record<string, unknown> | null;
  if (!ctx || Object.keys(ctx).length === 0) return null;
  return ctx;
}

// Clear pending context after it's been resolved or abandoned
export async function clearPendingContext(sellerId: string, sessionId: string) {
  const supabase = await createClient();
  await supabase
    .from("ai_conversations")
    .update({ context: {}, updated_at: new Date().toISOString() })
    .eq("user_id", sellerId)
    .eq("session_id", sessionId);
}
