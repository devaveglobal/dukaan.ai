"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, MessageSquare, Receipt, Settings, Users, LogOut, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/chat", label: "AI Assistant", icon: MessageSquare },
  { href: "/admin/items", label: "Items", icon: Package },
  { href: "/admin/receipts", label: "All Receipts", icon: Receipt },
  { href: "/admin/sellers", label: "Sellers", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-64 bg-background border-r border-primary/10 flex flex-col py-8 px-4 gap-2">
      <div className="px-4 mb-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutDashboard className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-gradient">AI Sales</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-1 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Admin Control</span>
        </div>
      </div>
      
      <div className="space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
              pathname === href
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Icon size={18} className={cn("transition-transform group-hover:scale-110", pathname === href ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-auto pt-6 border-t border-primary/5">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 px-4 py-6 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" 
          onClick={handleSignOut}
        >
          <LogOut size={18} /> 
          <span className="font-medium">Sign Out</span>
        </Button>
      </div>
    </aside>
  );
}
