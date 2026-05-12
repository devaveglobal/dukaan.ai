import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getIncompleteSaleReviews } from "@/actions/admin";
import { getItems } from "@/actions/items";
import ReviewsPanel from "./reviews-panel";

export const metadata: Metadata = { title: "Reviews | AI Sales" };

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [reviews, items] = await Promise.all([
    getIncompleteSaleReviews(),
    getItems(),
  ]);

  return (
    <div className="p-6">
      <ReviewsPanel reviews={reviews} items={items} />
    </div>
  );
}
