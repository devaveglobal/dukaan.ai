"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { bulkCreateItems } from "@/actions/items";
import { Loader2, Download } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function parseCSV(text: string) {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const qtyIdx = headers.indexOf("quantity");
  const priceIdx = headers.indexOf("price");
  const barcodeIdx = headers.indexOf("barcode_number");

  if (nameIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
    throw new Error("CSV must have columns: name, quantity, price (barcode_number optional)");
  }

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim());
    const name = cols[nameIdx];
    const quantity = parseFloat(cols[qtyIdx]);
    const price = parseFloat(cols[priceIdx]);
    if (!name) throw new Error(`Row ${i + 2}: name is required`);
    if (isNaN(quantity)) throw new Error(`Row ${i + 2}: invalid quantity`);
    if (isNaN(price)) throw new Error(`Row ${i + 2}: invalid price`);
    return {
      name,
      quantity,
      price,
      barcode_number: barcodeIdx !== -1 && cols[barcodeIdx] ? cols[barcodeIdx] : null,
    };
  });
}

export default function BulkUploadDialog({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof parseCSV> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string);
        setPreview(rows);
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : "Invalid CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      await bulkCreateItems(preview);
      toast.success(`${preview.length} items imported successfully.`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "name,quantity,price,barcode_number\nMilk,100,80,\nBread,50,120,8901234567890";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "items-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Items via CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" /> Download Template
          </Button>
          <Input type="file" accept=".csv,text/csv" onChange={handleFile} />
          {parseError && <p className="text-sm text-destructive">{parseError}</p>}
          {preview && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">{preview.length} rows ready to import:</p>
              <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                {preview.map((row, i) => (
                  <div key={i} className="flex gap-4 text-xs">
                    <span className="font-medium w-32 truncate">{row.name}</span>
                    <span>Qty: {row.quantity}</span>
                    <span>Price: {row.price}</span>
                    {row.barcode_number && <span className="text-muted-foreground">{row.barcode_number}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!preview || loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${preview?.length ?? 0} Items`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
