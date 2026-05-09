import { Metadata } from "next";
import { Suspense } from "react";
import {
  getAdminKpis,
  getRevenueByDay,
  getRevenueBySellerData,
  getTopProducts,
  getAllPendingPayments,
  getAllIncompleteSales,
} from "@/actions/analytics";
import { getAllSellers } from "@/actions/admin";
import KpiCards from "@/components/analytics/kpi-cards";
import RevenueChart from "@/components/analytics/revenue-chart";
import SellerRevenueChart from "@/components/analytics/seller-revenue-chart";
import TopProductsTable from "@/components/analytics/top-products-table";
import SellersAnalyticsTable from "@/components/analytics/sellers-analytics-table";
import PendingPaymentsPanel from "@/components/analytics/pending-payments-panel";
import IncompleteSalesPanel from "@/components/analytics/incomplete-sales-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Admin Dashboard | AI Sales" };
export const revalidate = 60; // revalidate every 60s

export default async function AdminDashboardPage() {
  const [kpis, revenueByDay, revenueBySeller, topProducts, pendingPayments, incompleteSales, sellers] =
    await Promise.all([
      getAdminKpis(),
      getRevenueByDay(30),
      getRevenueBySellerData(),
      getTopProducts(10),
      getAllPendingPayments(),
      getAllIncompleteSales(),
      getAllSellers(),
    ]);

  // Build seller id list aligned with revenueBySeller order
  const sellerIdMap = new Map(sellers.map((s) => [s.full_name ?? s.email, s.id]));
  const sellerIds = revenueBySeller.map((s) => sellerIdMap.get(s.name) ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live overview of all sellers and sales activity</p>
      </div>

      {/* KPI Cards */}
      <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}>
        <KpiCards data={kpis} />
      </Suspense>

      {/* Revenue chart + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueByDay} />
        </div>
        <TopProductsTable data={topProducts} />
      </div>

      {/* Seller revenue chart + Sellers table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SellerRevenueChart data={revenueBySeller} />
        <SellersAnalyticsTable sellers={revenueBySeller} sellerIds={sellerIds} />
      </div>

      {/* Pending payments + Incomplete sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingPaymentsPanel data={pendingPayments as any} />
        <IncompleteSalesPanel data={incompleteSales as any} />
      </div>
    </div>
  );
}
