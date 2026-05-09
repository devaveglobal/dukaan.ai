import { Metadata } from "next";
import SellerManagement from "./seller-management";

export const metadata: Metadata = { title: "Sellers | AI Sales" };

export default function AdminSellersPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-gradient mb-2">Seller Management</h1>
        <p className="text-muted-foreground text-lg">
          Onboard and manage authorized sellers for your organization.
        </p>
      </div>
      <SellerManagement />
    </div>
  );
}
