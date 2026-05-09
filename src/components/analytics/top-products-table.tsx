import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: { name: string; units: number; revenue: number; transactions: number }[];
}

export default function TopProductsTable({ data }: Props) {
  const max = data[0]?.revenue ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Top Products — This Month</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No sales data yet.</p>}
        {data.map((p, i) => (
          <div key={p.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="font-medium truncate max-w-[160px]">{p.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{p.units} units</Badge>
                <span className="font-semibold text-xs">Rs {p.revenue.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(p.revenue / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
