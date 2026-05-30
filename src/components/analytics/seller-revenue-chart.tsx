"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: { name: string; revenue: number; transactions: number; pending: number }[];
}

export default function SellerRevenueChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Seller Revenue — This Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} tickFormatter={(v) => v.split(" ")[0]} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} width={40} />
            <Tooltip formatter={(v, name) => [`Rs ${Number(v)}`, name === "revenue" ? "Revenue" : "Pending"]} />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pending" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
