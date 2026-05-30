import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Clock, AlertCircle, Users, DollarSign, BarChart2, Percent } from "lucide-react";

interface Props {
  data: {
    todayRevenue: number;
    monthRevenue: number;
    weekRevenue: number;
    weekTransactions: number;
    pendingTotal: number;
    pendingCount: number;
    incompleteCount: number;
    activeSellers: number;
    avgSaleValue: number;
  };
}

export default function KpiCards({ data }: Props) {
  const cards = [
    { label: "Today's Revenue", value: `Rs ${data.todayRevenue.toLocaleString()}`, icon: DollarSign, color: "text-green-500" },
    { label: "This Month", value: `Rs ${data.monthRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-blue-500" },
    { label: "This Week", value: `Rs ${data.weekRevenue.toLocaleString()}`, icon: BarChart2, color: "text-violet-500" },
    { label: "Weekly Transactions", value: data.weekTransactions.toString(), icon: ShoppingCart, color: "text-orange-500" },
    { label: "Avg Sale Value", value: `Rs ${data.avgSaleValue.toFixed(0)}`, icon: Percent, color: "text-cyan-500" },
    { label: "Pending Payments", value: `Rs ${data.pendingTotal.toLocaleString()}`, sub: `${data.pendingCount} unpaid`, icon: Clock, color: "text-yellow-500" },
    { label: "Needs Review", value: data.incompleteCount.toString(), sub: "incomplete sales", icon: AlertCircle, color: "text-red-500" },
    { label: "Active Sellers", value: data.activeSellers.toString(), icon: Users, color: "text-emerald-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 px-4 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{c.label}</CardTitle>
            <c.icon className={`w-4 h-4 shrink-0 ${c.color}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl sm:text-2xl font-bold truncate">{c.value}</p>
            {c.sub && <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
