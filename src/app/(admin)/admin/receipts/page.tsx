import { Metadata } from "next";

export const metadata: Metadata = { title: "All Receipts | AI Sales" };

export default function AdminReceiptsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">All Receipts</h1>
      <p className="text-muted-foreground">Global receipts table with TanStack Table will appear here — Sprint 01.</p>
    </div>
  );
}
