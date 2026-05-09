import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import ChatInterface from "@/components/chat/chat-interface";

export const metadata: Metadata = { title: "AI Chat | AI Sales" };

export default async function SellerChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6">
      <ChatInterface userId={user.id} role="seller" />
    </div>
  );
}
