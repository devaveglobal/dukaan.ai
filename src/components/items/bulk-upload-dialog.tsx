"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { bulkCreateItems } from "@/actions/items";
import { Loader2, Download, Upload, FileText, CheckCircle2 } from "lucide-react";

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseCSV> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setPreview(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        setPreview(parseCSV(ev.target?.result as string));
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
      <DialogContent className="p-5 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Bulk Upload Items</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Import multiple items at once via CSV</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">Download the CSV format</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 shrink-0">
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upload CSV File</label>
            <label
              htmlFor="csv_file"
              className="flex items-center gap-3 h-11 w-full rounded-xl border border-dashed border-input bg-background/60 px-3.5 cursor-pointer hover:border-primary/40 hover:bg-background transition-all text-sm text-muted-foreground"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="truncate">{fileName ?? "Click to select .csv file..."}</span>
              <input id="csv_file" type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            </label>
            {parseError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-1">{parseError}</p>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{preview.length} rows ready to import</p>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-muted/20">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Price</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Barcode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-3 py-1.5 font-medium truncate max-w-[140px]">{row.name}</td>
                        <td className="px-3 py-1.5 text-right">{row.quantity}</td>
                        <td className="px-3 py-1.5 text-right">Rs {row.price}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground font-mono hidden sm:table-cell">{row.barcode_number ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={onClose} className="px-6">Cancel</Button>
            <Button onClick={handleUpload} disabled={!preview || loading} className="px-6 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {preview ? `${preview.length} Items` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
