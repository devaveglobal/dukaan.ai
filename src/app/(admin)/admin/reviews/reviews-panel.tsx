"use client";

import { useState } from "react";
import { IncompleteSaleReview, Item } from "@/types";
import { resolveIncompleteSale, dismissIncompleteSale } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, XCircle, Loader2, ClipboardList } from "lucide-react";

interface Props {
  reviews: IncompleteSaleReview[];
  items: Item[];
}

const statusBadge = (status: string) => {
  if (status === "resolved") return <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="w-3 h-3" />Resolved</Badge>;
  if (status === "dismissed") return <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3" />Dismissed</Badge>;
  return <Badge variant="outline" className="border-amber-400 text-amber-700 gap-1"><AlertCircle className="w-3 h-3" />Pending</Badge>;
};

export default function ReviewsPanel({ reviews: initial, items }: Props) {
  const [reviews, setReviews] = useState(initial);
  const [selected, setSelected] = useState<IncompleteSaleReview | null>(null);
  const [form, setForm] = useState({ item_id: "", item_name: "", quantity: "", price: "", admin_comment: "" });
  const [loading, setLoading] = useState(false);

  const pending = reviews.filter((r) => r.status === "pending_admin_review");
  const resolved = reviews.filter((r) => r.status !== "pending_admin_review");

  const openResolve = (review: IncompleteSaleReview) => {
    setSelected(review);
    // Pre-fill price/quantity from extracted data if available
    const ext = review.extracted_data as Record<string, unknown>;
    const extItems = ext?.items as Array<Record<string, unknown>> | undefined;
    setForm({
      item_id: "",
      item_name: "",
      quantity: String(extItems?.[0]?.quantity ?? ""),
      price: String(extItems?.[0]?.unit_price ?? ext?.total_amount ?? ""),
      admin_comment: "",
    });
  };

  const handleResolve = async () => {
    if (!selected || !form.item_id || !form.quantity || !form.price) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      await resolveIncompleteSale({
        id: selected.id,
        item_id: form.item_id,
        quantity: Number(form.quantity),
        price: Number(form.price),
        admin_comment: form.admin_comment,
        seller_id: selected.seller_id,
      });
      setReviews((prev) => prev.map((r) => r.id === selected.id
        ? { ...r, status: "resolved", admin_comment: form.admin_comment }
        : r
      ));
      toast.success("Sale resolved and recorded!");
      setSelected(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissIncompleteSale(id);
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: "dismissed" } : r));
      toast.success("Dismissed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to dismiss");
    }
  };

  const ReviewTable = ({ rows }: { rows: IncompleteSaleReview[] }) => (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="font-bold">Seller</TableHead>
          <TableHead className="font-bold">Message</TableHead>
          <TableHead className="font-bold hidden md:table-cell">Date</TableHead>
          <TableHead className="font-bold">Status</TableHead>
          <TableHead className="text-right font-bold">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No items</TableCell>
          </TableRow>
        ) : rows.map((r) => (
          <TableRow key={r.id} className="hover:bg-primary/5 transition-colors">
            <TableCell>
              <p className="font-medium text-sm">{r.seller?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground hidden sm:block">{r.seller?.branch}</p>
            </TableCell>
            <TableCell className="max-w-[140px] sm:max-w-xs">
              <p className="text-sm truncate">{r.raw_message}</p>
              {r.admin_comment && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">Admin: {r.admin_comment}</p>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
              {new Date(r.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>{statusBadge(r.status)}</TableCell>
            <TableCell className="text-right">
              {r.status === "pending_admin_review" && (
                <div className="flex gap-1 justify-end">
                  <Button size="sm" onClick={() => openResolve(r)}>Resolve</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(r.id)} className="hidden sm:inline-flex">Dismiss</Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="glass border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-amber-500/5 border-b border-amber-500/10">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Pending Reviews
            {pending.length > 0 && (
              <Badge className="bg-amber-500 text-white ml-1">{pending.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Incomplete seller messages that need your attention.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ReviewTable rows={pending} />
        </CardContent>
      </Card>

      <Card className="glass border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-secondary/5 border-b border-secondary/10">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Resolved / Dismissed
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ReviewTable rows={resolved} />
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle>Resolve Incomplete Sale</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">Seller said:</p>
                <p>&quot;{selected.raw_message}&quot;</p>
                <p className="text-xs text-muted-foreground mt-1">— {selected.seller?.full_name}</p>
              </div>

              <div className="space-y-2">
                <Label>Item</Label>
                <Select value={form.item_id} onValueChange={(v: string | null) => {
                  if (!v) return;
                  const item = items.find((i) => i.id === v);
                  setForm((f) => ({ ...f, item_id: v, item_name: item?.name ?? "", price: item?.price != null ? String(item.price) : f.price }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item from catalog">
                      {form.item_name || undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} — Rs {item.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="e.g. 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (Rs)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              {form.quantity && form.price && (
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">Rs {Number(form.quantity) * Number(form.price)}</span>
                </p>
              )}

              <div className="space-y-2">
                <Label>Admin Comment</Label>
                <Input
                  value={form.admin_comment}
                  onChange={(e) => setForm((f) => ({ ...f, admin_comment: e.target.value }))}
                  placeholder="e.g. Seller sold Pepsi 500ml"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Resolve & Record Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
