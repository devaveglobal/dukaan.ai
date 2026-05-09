"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Mail, Building, User, CheckCircle2, Clock3 } from "lucide-react";
import { getSellerAccounts, inviteSeller, type SellerAccount } from "@/actions/admin";

export default function SellerManagement() {
  const [loading, setLoading] = useState(false);
  const [fetchingSellers, setFetchingSellers] = useState(true);
  const [sellers, setSellers] = useState<SellerAccount[]>([]);
  const [form, setForm] = useState({ email: "", full_name: "", branch: "" });

  const fetchSellers = useCallback(async () => {
    try {
      setSellers(await getSellerAccounts());
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch sellers");
    } finally {
      setFetchingSellers(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getSellerAccounts()
      .then((accounts) => {
        if (!cancelled) setSellers(accounts);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to fetch sellers");
        }
      })
      .finally(() => {
        if (!cancelled) setFetchingSellers(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await inviteSeller(form);
      toast.success("Seller invited and pre-authorized!");
      setForm({ email: "", full_name: "", branch: "" });
      setFetchingSellers(true);
      fetchSellers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to invite seller");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="glass overflow-hidden border-none shadow-2xl">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Plus className="w-6 h-6 text-primary" />
            Invite New Seller
          </CardTitle>
          <CardDescription>
            Enter seller details to authorize them for dashboard access.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name
              </Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email Address
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="seller@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-sm font-medium flex items-center gap-2">
                <Building className="w-4 h-4" /> Branch / Location
              </Label>
              <Input
                id="branch"
                placeholder="Downtown Store"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary"
              />
            </div>
            <Button type="submit" className="md:col-span-3 h-12 text-lg font-semibold shadow-lg hover:shadow-primary/20 transition-all" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Authorize & Invite Seller"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-secondary/5 border-b border-secondary/10">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Sellers
          </CardTitle>
          <CardDescription>
            Sellers added by admins. Pending means the seller has not set a password yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Email</TableHead>
                <TableHead className="font-bold">Branch</TableHead>
                <TableHead className="font-bold">Date Invited</TableHead>
                <TableHead className="text-right font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fetchingSellers ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                    Loading sellers...
                  </TableCell>
                </TableRow>
              ) : sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                    No sellers found.
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((seller) => (
                  <TableRow key={seller.id} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="font-medium">{seller.full_name}</TableCell>
                    <TableCell>{seller.email}</TableCell>
                    <TableCell>{seller.branch}</TableCell>
                    <TableCell>{new Date(seller.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {seller.setup_status === "active" ? (
                        <Badge className="bg-emerald-600 text-white">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          <Clock3 className="w-3 h-3" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
