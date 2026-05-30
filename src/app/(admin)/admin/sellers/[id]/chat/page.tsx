import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSellerChatHistory } from "@/actions/admin";
import { Bot, User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";

export default async function SellerChatHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", id)
    .single();

  const sessions = await getSellerChatHistory(id);

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/sellers" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{profile?.full_name ?? "Seller"} — Chat History</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">No chat history found.</p>
      ) : (
        sessions.map((session) => (
          <div key={session.session_id} className="border rounded-xl overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground font-medium border-b">
              Session: {session.session_id} &nbsp;·&nbsp; {new Date(session.updated_at).toLocaleString()}
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {(session.messages as ChatMessage[]).map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-primary" />}
                  </div>
                  <div className={cn(
                    "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                    msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
