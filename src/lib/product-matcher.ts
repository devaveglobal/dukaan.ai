"use server";

import { createClient } from "@/lib/supabase/server";
import { Item } from "@/types";

export interface MatchResult {
  item: Item;
  score: number;
  matched_via: "exact" | "fuzzy" | "alias" | "substring";
}

/**
 * Finds the best matching product for a raw name string.
 * Uses Postgres pg_trgm similarity via the search_items RPC.
 * Falls back to substring match if RPC returns nothing.
 */
export async function matchProduct(rawName: string): Promise<MatchResult | null> {
  const supabase = await createClient();
  const term = rawName.trim().toLowerCase();

  // Use the pg_trgm-powered RPC
  const { data, error } = await supabase.rpc("search_items", { search_term: term });

  if (error || !data || data.length === 0) return null;

  const top = data[0];

  // Determine match type
  let matched_via: MatchResult["matched_via"] = "fuzzy";
  if (top.name.toLowerCase() === term) matched_via = "exact";
  else if (top.name.toLowerCase().includes(term) || term.includes(top.name.toLowerCase())) matched_via = "substring";

  return {
    item: top as unknown as Item,
    score: top.similarity_score,
    matched_via,
  };
}

/**
 * Batch match multiple raw product names at once.
 */
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
