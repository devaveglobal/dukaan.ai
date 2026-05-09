import { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard | AI Sales" };

export default function SellerDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Dashboard</h1>
      <p className="text-muted-foreground">Seller KPI cards and charts will appear here — Sprint 01.</p>
    </div>
  );
}
