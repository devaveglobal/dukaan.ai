"use server";

import { createClient } from "@/lib/supabase/server";
import { extractSaleData } from "@/lib/ai-extractor";
import { persistSale, savePendingContext, loadPendingContext, clearPendingContext } from "@/lib/sale-persister";
import { ChatMessage, ExtractedSaleData } from "@/types";

const CONVERSATION_SYSTEM_PROMPT = `You are a smart, friendly AI sales assistant for a retail/mart business.

RULES:
1. Confirm recorded sales naturally and briefly (1-2 sentences max)
2. Respond in the SAME language the seller used (English, Urdu, Roman Urdu)
3. Never show JSON, IDs, or technical details
4. If asking a follow-up, ask ONE question only — softly, not forcefully
5. Never block the seller or demand an answer

CONTEXT ACTIONS you will receive:
- "sale_recorded": confirm what was saved
- "credit_recorded": confirm credit/udhaar was noted
- "incomplete_logged": item not in catalog, tell admin will review
- "incomplete_sentence_asking": seller gave incomplete info, ask ONE gentle follow-up
- "incomplete_sentence_abandoned": seller moved on, previous sale sent to review, confirm new sale
- "query_answered": answer the question from stats provided
- "none": general chat, respond naturally

RESPONSE EXAMPLES:
- sale_recorded: "Got it! Recorded 5 Coca Cola for Rs 250. ✓"
- credit_recorded: "Noted. 2 Pepsi for Ali saved as pending payment."
- incomplete_logged: "Saved! Note: '[item]' isn't in the catalog yet — admin will add it."
- incomplete_sentence_asking: "Sure! Which item did you sell for Rs 200?" (soft, one question)
- incomplete_sentence_abandoned: "No problem! Previous sale sent for review. [confirm new sale]"`;

interface ChatContext {
  messages: ChatMessage[];
  userMessage: string;
  role: "seller" | "admin";
  imageItemName?: string | null;
}

export interface ChatResponse {
  reply: string;
  action_taken?: "sale_recorded" | "credit_recorded" | "incomplete_logged" | "query_answered" | "none";
  sale_id?: string;
  pending_payment_id?: string;
}

/**
 * Determines if the current message is a direct answer to a pending follow-up.
 *
 * A message is considered a "follow-up answer" if:
 * - It has sale intent (log_sale / credit_sale), OR
 * - It provides item/quantity/price info that fills the pending context's missing fields
 *
 * A message is considered "abandoned" (new unrelated topic) ONLY if:
 * - It is a completely new, self-contained sale with ALL fields present (item + quantity + price)
 *   AND it shares no item/quantity overlap with the pending context
 */
function isFollowUpAnswer(
  current: ExtractedSaleData,
  pending: ExtractedSaleData,
  rawMessage: string
): boolean {
  const isSaleIntent = current.intent === "log_sale" || current.intent === "credit_sale";
  if (!isSaleIntent) return false;

  // If current message is self-contained and complete with a clear item name,
  // check if it could be answering the pending context's missing fields
  const pendingMissing = pending.missing_fields ?? [];

  // Pending was missing item → current provides an item → it's an answer
  if (pendingMissing.includes("item") && current.items.length > 0 && current.items[0].raw_name.trim()) {
    return true;
  }

  // Pending had an item but was missing price/quantity → current provides those
  if (!pendingMissing.includes("item") && pending.items.length > 0) {
    const currentHasPrice = current.items[0]?.unit_price != null || current.items[0]?.total_price != null || current.total_amount != null;
    const currentHasQty = current.items[0]?.quantity != null;
    if (pendingMissing.includes("price") && currentHasPrice) return true;
    if (pendingMissing.includes("quantity") && currentHasQty) return true;
  }

  // Short messages (≤ 6 words) during an active pending context are almost always follow-up answers
  const wordCount = rawMessage.trim().split(/\s+/).length;
  if (wordCount <= 6 && isSaleIntent) return true;

  return false;
}

export async function processChatMessage(ctx: ChatContext): Promise<ChatResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { messages, userMessage, role, imageItemName } = ctx;
  const sessionId = `${user.id}-${new Date().toDateString()}`;

  // ── Step 1: Extract structured data ──────────────────────────────────────
  const extractionMessage = imageItemName
    ? `${userMessage} [detected item from image: ${imageItemName}]`
    : userMessage;
  const extracted = await extractSaleData(extractionMessage);

  // ── Step 2: Load pending context ──────────────────────────────────────────
  const pendingCtx = await loadPendingContext(user.id, sessionId);
  const pendingExtracted = pendingCtx?.extracted as ExtractedSaleData | undefined;
  const hasPending = !!pendingExtracted;

  let persistResult = null;
  let actionContext = "";

  const isSaleIntent = extracted.intent === "log_sale" || extracted.intent === "credit_sale";

  // ── Step 3: State machine ─────────────────────────────────────────────────

  if (hasPending) {
    // We have an unresolved pending context from a previous message.
    // Decide: is this message a follow-up answer, or is the seller abandoning it?

    const isAnswer = isFollowUpAnswer(extracted, pendingExtracted!, userMessage);

    if (isAnswer) {
      // ── CASE A: Seller is completing the pending sale ──────────────────
      // Merge pending + current to build a complete sale record
      const merged: ExtractedSaleData = mergePendingWithAnswer(pendingExtracted!, extracted);
      await clearPendingContext(user.id, sessionId);

      // If merged is still incomplete (e.g. still missing price), keep asking
      if (!merged.is_complete && merged.missing_fields.length > 0) {
        await savePendingContext(user.id, sessionId, {
          extracted: merged,
          raw_message: `${pendingCtx!.raw_message} / ${userMessage}`,
          asked_followup: true,
        });
        actionContext = JSON.stringify({
          action: "incomplete_sentence_asking",
          missing_fields: merged.missing_fields,
          known_item: merged.items[0]?.raw_name,
          known_quantity: merged.items[0]?.quantity,
          known_price: merged.total_amount ?? merged.items[0]?.total_price,
        });
      } else {
        // Complete — persist it
        try {
          persistResult = await persistSale(merged, `${pendingCtx!.raw_message} / ${userMessage}`, user.id);
          actionContext = buildSaleContext(persistResult, merged, "sale_recorded");
        } catch {
          actionContext = JSON.stringify({ action: "error" });
        }
      }
    } else {
      // ── CASE B: Seller abandoned the pending context, starting fresh ───
      // Only NOW do we flush the old pending to reviews
      await supabase.from("incomplete_sales").insert({
        seller_id: user.id,
        raw_message: (pendingCtx!.raw_message as string) ?? "",
        extracted_data: pendingExtracted as unknown as Record<string, unknown>,
        status: "pending_admin_review",
      });
      await clearPendingContext(user.id, sessionId);

      // Process the new message as a fresh sale
      if (isSaleIntent) {
        const isNewIncomplete = isMissingCriticalFields(extracted);
        if (isNewIncomplete) {
          await savePendingContext(user.id, sessionId, {
            extracted,
            raw_message: userMessage,
            asked_followup: true,
          });
          actionContext = JSON.stringify({
            action: "incomplete_sentence_asking",
            missing_fields: extracted.missing_fields,
            known_item: extracted.items[0]?.raw_name,
            known_quantity: extracted.items[0]?.quantity,
            known_price: extracted.total_amount ?? extracted.items[0]?.total_price,
          });
        } else {
          try {
            persistResult = await persistSale(extracted, userMessage, user.id);
            actionContext = buildSaleContext(persistResult, extracted, "incomplete_sentence_abandoned");
          } catch {
            actionContext = JSON.stringify({ action: "error" });
          }
        }
      } else {
        actionContext = JSON.stringify({ action: "none" });
      }
    }

  } else if (isSaleIntent) {
    // ── CASE C: No pending context — fresh sale message ───────────────────
    const isIncomplete = isMissingCriticalFields(extracted);

    if (isIncomplete) {
      // Save as pending, ask follow-up — do NOT persist yet
      await savePendingContext(user.id, sessionId, {
        extracted,
        raw_message: userMessage,
        asked_followup: true,
      });
      actionContext = JSON.stringify({
        action: "incomplete_sentence_asking",
        missing_fields: extracted.missing_fields,
        known_item: extracted.items[0]?.raw_name,
        known_quantity: extracted.items[0]?.quantity,
        known_price: extracted.total_amount ?? extracted.items[0]?.total_price,
      });
    } else {
      // Complete sale — persist immediately
      try {
        persistResult = await persistSale(extracted, userMessage, user.id);
        actionContext = buildSaleContext(persistResult, extracted, "sale_recorded");
      } catch {
        actionContext = JSON.stringify({ action: "error" });
      }
    }

  } else if (extracted.intent === "query") {
    // ── CASE D: Query ─────────────────────────────────────────────────────
    const { data: stats } = await supabase
      .from("sales")
      .select("total_amount, payment_status, created_at")
      .eq("seller_id", user.id)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());

    const todayTotal = stats
      ?.filter((s) => s.payment_status === "paid")
      .reduce((sum, s) => sum + (s.total_amount ?? 0), 0) ?? 0;

    actionContext = JSON.stringify({
      action: "query_answered",
      today_sales_total: todayTotal,
      today_transaction_count: stats?.length ?? 0,
      role,
    });
  } else {
    actionContext = JSON.stringify({ action: "none" });
  }

  // ── Step 4: Generate conversational reply ─────────────────────────────────
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "AI Sales Assistant",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-haiku",
      max_tokens: 200,
      temperature: 0.4,
      messages: [
        { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
        ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: `Seller: "${userMessage}"\nContext: ${actionContext}` },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message ?? "AI response failed");
  }

  const result = await response.json();
  const reply = result.choices[0].message.content as string;

  // ── Step 5: Persist conversation messages ─────────────────────────────────
  const newMessages = [
    ...messages,
    { id: crypto.randomUUID(), role: "user" as const, content: userMessage, created_at: new Date().toISOString() },
    { id: crypto.randomUUID(), role: "assistant" as const, content: reply, created_at: new Date().toISOString() },
  ];

  void supabase.from("ai_conversations").upsert(
    { user_id: user.id, session_id: sessionId, messages: newMessages, updated_at: new Date().toISOString() },
    { onConflict: "user_id,session_id" }
  );

  return {
    reply,
    action_taken: persistResult
      ? persistResult.type === "incomplete" ? "incomplete_logged"
        : persistResult.type === "credit_sale" ? "credit_recorded"
        : "sale_recorded"
      : extracted.intent === "query" ? "query_answered" : "none",
    sale_id: persistResult?.sale?.id,
    pending_payment_id: persistResult?.pending_payment?.id,
  };
}

/**
 * A sale is "missing critical fields" if we cannot persist it meaningfully.
 * We need at minimum: an item name.
 * Price/quantity can be filled from catalog or assumed — but item name is non-negotiable.
 */
function isMissingCriticalFields(extracted: ExtractedSaleData): boolean {
  const hasItem = extracted.items.length > 0 && extracted.items[0].raw_name.trim().length > 0;
  if (!hasItem) return true;

  // If item is present but both quantity AND price are missing, ask for more info
  const hasQuantity = extracted.items[0].quantity != null;
  const hasPrice = extracted.items[0].unit_price != null
    || extracted.items[0].total_price != null
    || extracted.total_amount != null;

  // We can infer price from catalog, so only block if quantity is also missing
  // (catalog lookup happens in persistSale — we trust it to fill price)
  if (!hasQuantity && !hasPrice) return true;

  return false;
}

/**
 * Merges a pending (incomplete) extracted sale with the seller's follow-up answer.
 * The follow-up answer fills in whatever was missing.
 */
function mergePendingWithAnswer(
  pending: ExtractedSaleData,
  answer: ExtractedSaleData
): ExtractedSaleData {
  // Build merged items: prefer answer's items if they have a real name,
  // otherwise keep pending's items and patch in price/quantity from answer
  let mergedItems = pending.items;

  if (answer.items.length > 0 && answer.items[0].raw_name.trim()) {
    // Answer provided item name — use answer's items as base, fill gaps from pending
    mergedItems = answer.items.map((ai, idx) => {
      const pi = pending.items[idx];
      return {
        ...ai,
        quantity: ai.quantity ?? pi?.quantity,
        unit_price: ai.unit_price ?? pi?.unit_price,
        total_price: ai.total_price ?? pi?.total_price,
      };
    });
  } else {
    // Answer didn't provide item name — patch pending items with answer's price/qty
    mergedItems = pending.items.map((pi, idx) => {
      const ai = answer.items[idx];
      return {
        ...pi,
        quantity: pi.quantity ?? ai?.quantity ?? answer.items[0]?.quantity,
        unit_price: pi.unit_price ?? ai?.unit_price ?? answer.items[0]?.unit_price,
        total_price: pi.total_price ?? ai?.total_price ?? answer.total_amount,
      };
    });
  }

  const merged: ExtractedSaleData = {
    intent: pending.intent === "unknown" ? answer.intent : pending.intent,
    items: mergedItems,
    customer_name: answer.customer_name ?? pending.customer_name,
    payment_status: answer.payment_status ?? pending.payment_status,
    total_amount: answer.total_amount ?? pending.total_amount,
    confidence: Math.max(answer.confidence, pending.confidence ?? 0),
    is_complete: false,
    missing_fields: [],
  };

  // Recompute missing fields on the merged result
  const missing: string[] = [];
  const hasItem = merged.items.length > 0 && merged.items[0].raw_name.trim().length > 0;
  if (!hasItem) missing.push("item");

  const hasQty = merged.items[0]?.quantity != null;
  const hasPrice = merged.items[0]?.unit_price != null
    || merged.items[0]?.total_price != null
    || merged.total_amount != null;

  if (!hasQty) missing.push("quantity");
  if (!hasPrice) missing.push("price");

  merged.missing_fields = missing;
  merged.is_complete = missing.length === 0;

  return merged;
}

function buildSaleContext(
  persistResult: Awaited<ReturnType<typeof persistSale>>,
  extracted: ExtractedSaleData,
  defaultAction: string
) {
  if (persistResult.type === "incomplete") {
    return JSON.stringify({
      action: "incomplete_logged",
      unmatched_items: persistResult.unmatched_items,
      reason: "items_not_in_catalog",
    });
  }

  const itemSummary = extracted.items
    .filter((i) => i.raw_name.trim())
    .map((i) => {
      const qty = i.quantity ? `${i.quantity}x ` : "";
      const price = i.total_price ? ` for Rs ${i.total_price}` : "";
      return `${qty}${i.raw_name}${price}`;
    }).join(", ");

  return JSON.stringify({
    action: persistResult.type === "credit_sale" ? "credit_recorded" : defaultAction,
    items_summary: itemSummary,
    customer: extracted.customer_name,
    total: persistResult.sale?.total_amount,
    payment_status: extracted.payment_status,
    unmatched_items: persistResult.unmatched_items,
  });
}

export async function loadConversation(userId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const sessionId = `${userId}-${new Date().toDateString()}`;
  const { data } = await supabase
    .from("ai_conversations")
    .select("messages")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .single();
  return (data?.messages as ChatMessage[]) ?? [];
}
