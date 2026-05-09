"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { Item } from "@/types";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") throw new Error("Forbidden");
  return { supabase, user };
}

// Service role client bypasses storage RLS — used for admin file uploads
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function uploadBarcodeImage(formData: FormData): Promise<string> {
  await requireAdmin();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const ext = file.name.split(".").pop() ?? "png";
  const path = `barcodes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const service = getServiceClient();

  // Ensure bucket exists
  const { data: buckets } = await service.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === "item-barcodes");
  if (!bucketExists) {
    const { error: bucketError } = await service.storage.createBucket("item-barcodes", { public: true });
    if (bucketError) throw new Error(`Bucket error: ${bucketError.message}`);
  }

  const { error: uploadError } = await service.storage
    .from("item-barcodes")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = service.storage.from("item-barcodes").getPublicUrl(path);
  return urlData.publicUrl;
}

export async function getItems() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Item[];
}

export async function createItem(item: {
  name: string;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  unit: string;
  quantity: number;
  cost_price?: number | null;
  price: number;
  low_stock_threshold?: number | null;
  barcode_number?: string | null;
  barcode_image_url?: string | null;
}) {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("items")
    .insert({ ...item, created_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/items");
  return data as Item;
}

export async function updateItem(id: string, item: Partial<Omit<Item, "id" | "created_at" | "updated_at">>) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("items")
    .update({ ...item, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/items");
  return data as Item;
}

export async function deleteItem(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/items");
}

export async function bulkCreateItems(items: Array<{
  name: string;
  quantity: number;
  price: number;
  barcode_number?: string | null;
}>) {
  const { supabase, user } = await requireAdmin();
  const rows = items.map((i) => ({ ...i, created_by: user.id }));
  const { data, error } = await supabase.from("items").insert(rows).select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/items");
  return data as Item[];
}

export async function getItemByBarcode(barcodeNumber: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("barcode_number", barcodeNumber)
    .single();
  if (error) return null;
  return data as Item;
}
