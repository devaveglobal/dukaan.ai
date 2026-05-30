"use server";

import { createClient } from "@/lib/supabase/server";
import { Item } from "@/types";

export interface MatchResult {
  item: Item;
  score: number;
  matched_via: "exact" | "fuzzy" | "alias" | "substring" | "word";
}

export async function matchProduct(rawName: string): Promise<MatchResult | null> {
  const supabase = await createClient();
  const term = rawName.trim().toLowerCase();
  if (!term) return null;

  // 1. Try RPC fuzzy search first
  const { data: rpcData } = await supabase.rpc("search_items", { search_term: term });

  if (rpcData && rpcData.length > 0 && rpcData[0].similarity_score >= 0.1) {
    const top = rpcData[0];
    let matched_via: MatchResult["matched_via"] = "fuzzy";
    if (top.name.toLowerCase() === term) matched_via = "exact";
    else if (top.name.toLowerCase().includes(term) || term.includes(top.name.toLowerCase())) matched_via = "substring";
    return { item: top as unknown as Item, score: top.similarity_score, matched_via };
  }

  // 2. Fallback: direct DB substring/word match
  // This catches cases like "milk" matching "Full Cream Milk" when pg_trgm score is low
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .ilike("name", `%${term}%`)
    .limit(1);

  if (items && items.length > 0) {
    return { item: items[0] as Item, score: 0.5, matched_via: "word" };
  }

  // 3. Fallback: check if any word in the item name matches the search term
  // e.g. "milk" should match "Full Cream Milk" even if ilike fails
  const { data: allItems } = await supabase
    .from("items")
    .select("id, name, sku, unit, price, quantity, low_stock_threshold, barcode_number, barcode_image_url, cost_price, category, description, created_at, updated_at");

  if (!allItems) return null;

  const termWords = term.split(/\s+/);
  let bestMatch: { item: Item; score: number } | null = null;

  for (const item of allItems) {
    const itemWords = item.name.toLowerCase().split(/\s+/);
    // Count how many search term words appear in item name words
    const matchCount = termWords.filter((tw) =>
      itemWords.some((iw: string) => iw.includes(tw) || tw.includes(iw))
    ).length;

    if (matchCount > 0) {
      const score = matchCount / Math.max(termWords.length, itemWords.length);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item: item as Item, score };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.3) {
    return { ...bestMatch, matched_via: "word" };
  }

  return null;
}

export async function matchProducts(
  rawNames: string[]
): Promise<Map<string, MatchResult | null>> {
  const results = new Map<string, MatchResult | null>();
  await Promise.all(
    rawNames.map(async (name) => {
      results.set(name, await matchProduct(name));
    })
  );
  return results;
}
