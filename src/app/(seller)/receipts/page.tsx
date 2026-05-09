import { Metadata } from "next";

export const metadata: Metadata = { title: "My Receipts | AI Sales" };

export default function SellerReceiptsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Receipts</h1>
      <p className="text-muted-foreground">Receipts list with filters will appear here — Sprint 01.</p>
    </div>
  );
}
