"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getItems, deleteItem } from "@/actions/items";
import { Item } from "@/types";
import { Plus, Upload, MoreHorizontal, Pencil, Trash2, ScanLine, Search, Loader2 } from "lucide-react";
import ItemFormDialog from "@/components/items/item-form-dialog";
import BulkUploadDialog from "@/components/items/bulk-upload-dialog";

export default function ItemsTable() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getItems());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await deleteItem(deleteId);
      toast.success("Item deleted.");
      setDeleteId(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.barcode_number?.includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2 flex-1 sm:flex-none">
            <Upload className="w-4 h-4" /> <span className="sm:inline">Bulk Upload</span>
          </Button>
          <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="gap-2 flex-1 sm:flex-none">
            <Plus className="w-4 h-4" /> <span className="sm:inline">Add Item</span>
          </Button>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {search ? "No items match your search." : "No items yet. Add your first item."}
          </div>
        ) : filtered.map((item) => (
          <div key={item.id} className="border rounded-xl p-3 flex items-start justify-between gap-2 bg-background">
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.category ?? "—"} · {item.unit}</p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs font-medium">Rs {item.price.toFixed(0)}</span>
                <span className={`text-xs ${item.low_stock_threshold && item.quantity <= item.low_stock_threshold ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  Stock: {item.quantity}
                </span>
                {item.barcode_number && (
                  <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                    <ScanLine className="w-2.5 h-2.5 mr-1" />{item.barcode_number}
                  </Badge>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditItem(item); setShowForm(true); }}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">SKU</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="hidden md:table-cell">Cost</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="hidden lg:table-cell">Barcode</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  {search ? "No items match your search." : "No items yet. Add your first item."}
                </TableCell>
              </TableRow>
            ) : filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">{item.sku ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{item.category ?? "—"}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>
                  <span className={item.low_stock_threshold && item.quantity <= item.low_stock_threshold ? "text-destructive font-semibold" : ""}>
                    {item.quantity}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{item.cost_price != null ? `Rs ${item.cost_price.toFixed(2)}` : "—"}</TableCell>
                <TableCell>Rs {item.price.toFixed(2)}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {item.barcode_number ? (
                    <Badge variant="secondary" className="font-mono text-xs">
                      <ScanLine className="w-3 h-3 mr-1" />{item.barcode_number}
                    </Badge>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditItem(item); setShowForm(true); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ItemFormDialog open={showForm} onClose={() => setShowForm(false)} onSaved={load} item={editItem} />
      <BulkUploadDialog open={showBulk} onClose={() => setShowBulk(false)} onSaved={load} />

      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm p-5">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this item? This action cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
