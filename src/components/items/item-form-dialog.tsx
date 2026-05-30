"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { createItem, updateItem, uploadBarcodeImage } from "@/actions/items";
import { decodeBarcodeFromImage } from "@/lib/barcode";
import { Item } from "@/types";
import { Loader2, ScanLine, ImageIcon, Package, Tag, DollarSign, BarChart3, Hash } from "lucide-react";
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

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
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
      <DialogContent className=" overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{item ? "Edit Item" : "Add New Item"}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{item ? "Update item details below" : "Fill in the details to add a new item"}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Basic Info */}
            <SectionCard icon={Tag} title="Basic Info">
              <FieldGroup>
                <Label htmlFor="name">Item Name <span className="text-destructive normal-case tracking-normal font-bold">*</span></Label>
                <Input id="name" required value={form.name} onChange={set("name")} placeholder="e.g. Full Cream Milk" />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup>
                  <Label htmlFor="sku">SKU / Code</Label>
                  <Input id="sku" value={form.sku} onChange={set("sku")} placeholder="MLK-001" />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="category">Category</Label>
                  <Select value={form.category} onValueChange={setSelect("category")}>
                    <SelectTrigger id="category"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>
              <FieldGroup>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={set("description")} placeholder="Optional description..." rows={2} className="min-h-[72px]" />
              </FieldGroup>
            </SectionCard>

            {/* Pricing & Stock */}
            <SectionCard icon={DollarSign} title="Pricing & Stock">
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup>
                  <Label htmlFor="unit">Unit <span className="text-destructive normal-case tracking-normal font-bold">*</span></Label>
                  <Select value={form.unit} onValueChange={setSelect("unit")}>
                    <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="quantity">Stock Qty <span className="text-destructive normal-case tracking-normal font-bold">*</span></Label>
                  <Input id="quantity" required type="number" min="0" step="0.01" value={form.quantity} onChange={set("quantity")} placeholder="0" />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup>
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">Rs</span>
                    <Input id="cost_price" type="number" min="0" step="0.01" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00" className="pl-9" />
                  </div>
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="price">Selling Price <span className="text-destructive normal-case tracking-normal font-bold">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">Rs</span>
                    <Input id="price" required type="number" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="0.00" className="pl-9" />
                  </div>
                </FieldGroup>
              </div>
              <FieldGroup>
                <Label htmlFor="threshold">
                  <BarChart3 className="w-3.5 h-3.5" /> Low Stock Alert
                </Label>
                <Input id="threshold" type="number" min="0" step="0.01" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} placeholder="e.g. 10" />
              </FieldGroup>
            </SectionCard>

            {/* Barcode */}
            <SectionCard icon={ScanLine} title="Barcode">
              <FieldGroup>
                <Label htmlFor="barcode_img">
                  <ImageIcon className="w-3.5 h-3.5" /> Barcode Image
                </Label>
                <label
                  htmlFor="barcode_img"
                  className="flex items-center gap-3 h-11 w-full rounded-xl border border-dashed border-input bg-background/60 px-3.5 cursor-pointer hover:border-primary/40 hover:bg-background transition-all text-sm text-muted-foreground"
                >
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{barcodeFile ? barcodeFile.name : "Click to upload image..."}</span>
                  <input id="barcode_img" type="file" accept="image/*" onChange={handleBarcodeImage} className="hidden" />
                </label>
                {barcodeLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Reading barcode...
                  </p>
                )}
                {barcodePreview && !barcodeLoading && (
                  <div className="flex items-center gap-3 p-2.5 border rounded-xl bg-muted/30 mt-1">
                    <Image src={barcodePreview} alt="barcode" width={120} height={48} className="object-contain rounded-lg" unoptimized />
                  </div>
                )}
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="barcode_num">
                  <Hash className="w-3.5 h-3.5" /> Barcode Number
                </Label>
                <Input id="barcode_num" value={form.barcode_number} onChange={set("barcode_number")} placeholder="Auto-filled or enter manually" className="font-mono tracking-wider" />
              </FieldGroup>
            </SectionCard>

            {/* Footer actions */}
            <div className="flex gap-3 justify-end pt-1 pb-1">
              <Button type="button" variant="outline" onClick={onClose} className="px-6">Cancel</Button>
              <Button type="submit" disabled={loading || barcodeLoading} className="px-6 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {item ? "Update Item" : "Create Item"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
