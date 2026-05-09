"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getSellerDetail } from "@/actions/analytics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface SellerRow {
  name: string;
  revenue: number;
  transactions: number;
  pending: number;
}

interface Props {
  sellers: SellerRow[];
  sellerIds: string[];
}

export default function SellersAnalyticsTable({ sellers, sellerIds }: Props) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getSellerDetail>> | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDrillDown = async (sellerId: string) => {
    setLoadingId(sellerId);
    try {
      const data = await getSellerDetail(sellerId);
      setDetail(data);
      setOpen(true);
    } catch {
      toast.error("Failed to load seller details");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Seller Performance — This Month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sales this month.</TableCell>
                </TableRow>
              )}
              {sellers.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right font-semibold">Rs {s.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.transactions}</TableCell>
                  <TableCell className="text-right">
                    {s.pending > 0
                      ? <Badge variant="outline" className="text-yellow-600 border-yellow-400">Rs {s.pending.toLocaleString()}</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDrillDown(sellerIds[i])}
                      disabled={loadingId === sellerIds[i]}
                    >
                      {loadingId === sellerIds[i]
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <ChevronRight className="w-3 h-3" />
                      }
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{detail.profile?.full_name ?? detail.profile?.email}</SheetTitle>
                <p className="text-sm text-muted-foreground">{detail.profile?.email} · {detail.profile?.branch ?? "No branch"}</p>
              </SheetHeader>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Total Revenue", value: `Rs ${detail.totalRevenue.toLocaleString()}` },
                  { label: "Transactions", value: detail.totalTransactions.toString() },
                  { label: "Pending Amount", value: `Rs ${detail.pendingAmount.toLocaleString()}` },
                  { label: "Pending Count", value: detail.pendingCount.toString() },
                ].map((k) => (
                  <div key={k.label} className="border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-xl font-bold mt-0.5">{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Daily revenue chart */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Daily Revenue — Last 14 Days</p>
              <ResponsiveContainer width="100%" height={160} className="mb-6">
                <LineChart data={detail.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => new Date(v).toLocaleDateString("en-PK", { day: "numeric", month: "short" })} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs ${v}`} />
                  <Tooltip formatter={(v) => [`Rs ${Number(v)}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>

              {/* Top items */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Items Sold</p>
              <div className="space-y-2 mb-6">
                {detail.topItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                    <span className="font-medium">{item.name}</span>
                    <div className="flex gap-3 text-muted-foreground text-xs">
                      <span>{item.units} units</span>
                      <span className="font-semibold text-foreground">Rs {item.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {detail.topItems.length === 0 && <p className="text-sm text-muted-foreground">No items data.</p>}
              </div>

              {/* Recent sales */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Sales</p>
              <div className="space-y-2">
                {detail.recentSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                    <div>
                      <p className="font-medium">Rs {s.total_amount?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("en-PK")}</p>
                    </div>
                    <Badge variant={s.payment_status === "paid" ? "default" : "outline"}
                      className={s.payment_status === "pending" ? "text-yellow-600 border-yellow-400" : ""}>
                      {s.payment_status}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
