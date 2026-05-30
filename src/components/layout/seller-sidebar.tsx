"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, MessageSquare, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
              active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Icon size={18} className={cn("transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export default function SellerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 bg-background border-r border-primary/10 flex-col py-8 px-4 gap-2 shrink-0">
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Seller Portal</span>
          </div>
        </div>

        <NavLinks pathname={pathname} />

        <div className="mt-auto pt-6 border-t border-primary/5">
          <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-6 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" onClick={handleSignOut}>
            <LogOut size={18} />
            <span className="font-medium">Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-primary/10 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <LayoutDashboard className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-gradient">AI Sales</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>

      {/* ── Mobile Sheet sidebar ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 p-0 flex flex-col">
          {/* Sheet header */}
          <div className="px-6 pt-6 pb-4 border-b border-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                  <LayoutDashboard className="text-primary-foreground w-5 h-5" />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-gradient">AI Sales</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <Menu size={18} />
              </Button>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mt-1 block">Seller Portal</span>
          </div>

          {/* Nav links */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>

          {/* Sign out */}
          <div className="px-4 pb-6 pt-4 border-t border-primary/5">
            <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-6 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" onClick={handleSignOut}>
              <LogOut size={18} />
              <span className="font-medium">Sign Out</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
