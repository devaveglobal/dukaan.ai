import { Metadata } from "next";
import ItemsTable from "@/components/items/items-table";

export const metadata: Metadata = { title: "Items | AI Sales" };

export default function AdminItemsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Items</h1>
      <ItemsTable />
    </div>
  );
}
