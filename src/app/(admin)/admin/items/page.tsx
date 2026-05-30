import { Metadata } from "next";
import ItemsTable from "@/components/items/items-table";

export const metadata: Metadata = { title: "Items | AI Sales" };

export default function AdminItemsPage() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold mb-4">Items</h1>
      <ItemsTable />
    </div>
  );
}
