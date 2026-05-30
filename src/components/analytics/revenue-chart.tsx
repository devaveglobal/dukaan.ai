"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: { date: string; revenue: number; transactions: number }[];
}

export default function RevenueChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Revenue — Last 30 Days</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={formatted} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} width={40} />
            <Tooltip formatter={(v, name) => [name === "revenue" ? `Rs ${Number(v)}` : v, name === "revenue" ? "Revenue" : "Transactions"]} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="transactions" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
