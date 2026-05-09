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
}

export interface ChatResponse {
  reply: string;
  action_taken?: "sale_recorded" | "credit_recorded" | "incomplete_logged" | "query_answered" | "none";
  sale_id?: string;
  pending_payment_id?: string;
}

export async function processChatMessage(ctx: ChatContext): Promise<ChatResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { messages, userMessage, role } = ctx;
  const sessionId = `${user.id}-${new Date().toDateString()}`;

  // ── Step 1: Extract structured data from current message ──────────────────
  const extracted = await extractSaleData(userMessage);

  // ── Step 2: Load any pending context from previous incomplete message ─────
  const pendingCtx = await loadPendingContext(user.id, sessionId);
  const hasPendingContext = !!pendingCtx?.extracted;

  let persistResult = null;
  let actionContext = "";

  // ── Step 3: Determine what to do ─────────────────────────────────────────

  const isSaleIntent = extracted.intent === "log_sale" || extracted.intent === "credit_sale";
  const isIncomplete = extracted.missing_fields.includes("item") || extracted.items.length === 0;

  if (isSaleIntent) {

    // Case A: Seller had a pending incomplete context AND now sends a new sale
    // → abandon the old pending context (send to incomplete_sales), process new sale
    if (hasPendingContext && !isIncomplete) {
      // Save the abandoned pending context as incomplete
      await supabase.from("incomplete_sales").insert({
        seller_id: user.id,
        raw_message: (pendingCtx.raw_message as string) ?? "",
        extracted_data: pendingCtx.extracted as Record<string, unknown>,
        status: "pending_admin_review",
      });
      await clearPendingContext(user.id, sessionId);

      // Now process the new complete sale
      try {
        persistResult = await persistSale(extracted, userMessage, user.id);
        actionContext = buildSaleContext(persistResult, extracted, "incomplete_sentence_abandoned");
      } catch {
        actionContext = JSON.stringify({ action: "error" });
      }
    }

    // Case B: Current message has no item name (incomplete sentence like "sold for 200")
    // → save as pending context, ask ONE gentle follow-up, do NOT persist yet
    else if (isIncomplete) {
      await savePendingContext(user.id, sessionId, {
        extracted,
        raw_message: userMessage,
        asked_followup: true,
      });
      actionContext = JSON.stringify({
        action: "incomplete_sentence_asking",
        missing_fields: extracted.missing_fields,
        known_price: extracted.total_amount ?? extracted.items[0]?.total_price,
        known_quantity: extracted.items[0]?.quantity,
      });
    }

    // Case C: Seller is answering a previous follow-up (pending context exists, current message has item)
    else if (hasPendingContext && isSaleIntent && !isIncomplete) {
      // Merge pending context with current answer
      const prevExtracted = pendingCtx.extracted as ExtractedSaleData;
      const merged: ExtractedSaleData = {
        ...prevExtracted,
        items: extracted.items.length > 0 ? extracted.items : prevExtracted.items,
        total_amount: extracted.total_amount ?? prevExtracted.total_amount,
        customer_name: extracted.customer_name ?? prevExtracted.customer_name,
        payment_status: extracted.payment_status ?? prevExtracted.payment_status,
        confidence: Math.max(extracted.confidence, prevExtracted.confidence ?? 0),
        is_complete: true,
        missing_fields: [],
      };
      await clearPendingContext(user.id, sessionId);

      try {
        persistResult = await persistSale(merged, `${pendingCtx.raw_message} / ${userMessage}`, user.id);
        actionContext = buildSaleContext(persistResult, merged, "sale_recorded");
      } catch {
        actionContext = JSON.stringify({ action: "error" });
      }
    }

    // Case D: Normal complete sale
    else {
      try {
        persistResult = await persistSale(extracted, userMessage, user.id);
        actionContext = buildSaleContext(persistResult, extracted, "sale_recorded");
      } catch {
        actionContext = JSON.stringify({ action: "error" });
      }
    }

  } else if (extracted.intent === "query") {
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
