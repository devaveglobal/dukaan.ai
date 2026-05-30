import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SellerSidebar from "@/components/layout/seller-sidebar";
import PushNotificationInit from "@/components/shared/push-notification-init";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen dashboard-bg">
      <SellerSidebar />
      <main className="flex-1 overflow-auto pt-14 pb-16 md:pt-0 md:pb-0 p-4 md:p-6">{children}</main>
      <PushNotificationInit userId={user.id} />
    </div>
  );
}
