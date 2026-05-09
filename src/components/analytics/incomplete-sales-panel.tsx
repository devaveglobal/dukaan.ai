import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface Props {
  data: Array<{
    id: string;
    raw_message: string;
    created_at: string;
    seller: { full_name: string; email: string } | null;
  }>;
}

export default function IncompleteSalesPanel({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" /> Needs Review
          {data.length > 0 && <Badge variant="destructive" className="ml-auto">{data.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-72 overflow-y-auto">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No incomplete sales.</p>}
        {data.map((s) => (
          <div key={s.id} className="border rounded-md px-3 py-2 space-y-1">
            <p className="text-sm font-medium italic text-muted-foreground">&quot;{s.raw_message}&quot;</p>
            <p className="text-xs text-muted-foreground">
              {(s.seller as any)?.full_name ?? (s.seller as any)?.email ?? "Unknown"} · {new Date(s.created_at).toLocaleString("en-PK")}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
