"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { createItem, updateItem, uploadBarcodeImage } from "@/actions/items";
import { decodeBarcodeFromImage } from "@/lib/barcode";
import { Item } from "@/types";
import { Loader2, ScanLine, ImageIcon } from "lucide-react";
import Image from "next/image";

const UNITS = ["pcs", "kg", "g", "litre", "ml", "dozen", "box", "pack", "bottle", "bag", "metre", "pair"];
const CATEGORIES = ["Dairy", "Bakery", "Beverages", "Snacks", "Grocery", "Meat", "Vegetables", "Fruits", "Frozen", "Cleaning", "Personal Care", "Electronics", "Clothing", "Stationery", "Other"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: Item | null;
}

type FormState = {
  name: string; sku: string; category: string; description: string;
  unit: string; quantity: string; cost_price: string; price: string;
  low_stock_threshold: string; barcode_number: string; barcode_image_url: string;
};

function buildForm(item?: Item | null): FormState {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    category: item?.category ?? "",
    description: item?.description ?? "",
    unit: item?.unit ?? "pcs",
    quantity: item?.quantity?.toString() ?? "",
    cost_price: item?.cost_price?.toString() ?? "",
    price: item?.price?.toString() ?? "",
    low_stock_threshold: item?.low_stock_threshold?.toString() ?? "",
    barcode_number: item?.barcode_number ?? "",
    barcode_image_url: item?.barcode_image_url ?? "",
  };
}

export default function ItemFormDialog({ open, onClose, onSaved, item }: Props) {
  const [loading, setLoading] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(buildForm(item));

  useEffect(() => {
    if (open) {
      setForm(buildForm(item));
      setBarcodeFile(null);
      setBarcodePreview(item?.barcode_image_url ?? null);
    }
  }, [open, item]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const setSelect = (key: keyof FormState) => (v: string | null) =>
    setForm((p) => ({ ...p, [key]: v ?? p[key] }));

  const handleBarcodeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBarcodeFile(file);
    setBarcodePreview(URL.createObjectURL(file));
    setBarcodeLoading(true);
    const decoded = await decodeBarcodeFromImage(file);
    if (decoded) {
      setForm((p) => ({ ...p, barcode_number: decoded }));
      toast.success(`Barcode detected: ${decoded}`);
    } else {
      toast.warning("Could not auto-read barcode. Enter the number manually.");
    }
    setBarcodeLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let barcode_image_url = form.barcode_image_url;
      if (barcodeFile) {
        const fd = new FormData();
        fd.append("file", barcodeFile);
        barcode_image_url = await uploadBarcodeImage(fd);
      }

      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category || null,
        description: form.description.trim() || null,
        unit: form.unit,
        quantity: parseFloat(form.quantity) || 0,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        price: parseFloat(form.price),
        low_stock_threshold: form.low_stock_threshold ? parseFloat(form.low_stock_threshold) : null,
        barcode_number: form.barcode_number.trim() || null,
        barcode_image_url: barcode_image_url || null,
      };

      if (item) {
        await updateItem(item.id, payload);
        toast.success("Item updated.");
      } else {
        await createItem(payload);
        toast.success("Item created.");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh]">
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</p>
              <div className="space-y-2">
                <Label>Item Name *</Label>
                <Input required value={form.name} onChange={set("name")} placeholder="e.g. Full Cream Milk" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SKU / Item Code</Label>
                  <Input value={form.sku} onChange={set("sku")} placeholder="e.g. MLK-001" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={setSelect("category")}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={set("description")} placeholder="Optional description..." rows={2} />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing & Stock</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Select value={form.unit} onValueChange={setSelect("unit")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stock Quantity *</Label>
                  <Input required type="number" min="0" step="0.01" value={form.quantity} onChange={set("quantity")} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cost Price</Label>
                  <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price *</Label>
                  <Input required type="number" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert Threshold</Label>
                <Input type="number" min="0" step="0.01" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} placeholder="e.g. 10" />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Barcode</p>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4" /> Barcode Image (optional)
                </Label>
                <Input type="file" accept="image/*" onChange={handleBarcodeImage} />
                {barcodeLoading && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Reading barcode from image...
                  </p>
                )}
                {barcodePreview && !barcodeLoading && (
                  <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                    <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Image src={barcodePreview} alt="barcode" width={140} height={56} className="object-contain rounded" unoptimized />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Barcode Number</Label>
                <Input value={form.barcode_number} onChange={set("barcode_number")} placeholder="Auto-filled or enter manually" className="font-mono" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading || barcodeLoading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : item ? "Update Item" : "Create Item"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
