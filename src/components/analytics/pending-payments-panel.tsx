import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface Props {
  data: Array<{
    id: string;
    customer_name: string | null;
    amount: number;
    created_at: string;
    seller: { full_name: string; email: string } | null;
  }>;
}

export default function PendingPaymentsPanel({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-500" /> Pending Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-72 overflow-y-auto">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No pending payments.</p>}
        {data.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
            <div>
              <p className="font-medium">{p.customer_name ?? "Unknown customer"}</p>
              <p className="text-xs text-muted-foreground">
                {(p.seller as any)?.full_name ?? (p.seller as any)?.email ?? "Unknown seller"} · {new Date(p.created_at).toLocaleDateString("en-PK")}
              </p>
            </div>
            <Badge variant="outline" className="text-yellow-600 border-yellow-400 font-semibold">
              Rs {p.amount.toLocaleString()}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
