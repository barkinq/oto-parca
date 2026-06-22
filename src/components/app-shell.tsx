import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  BarChart3,
  Bell,
  Search,
  LogOut,
  Wrench,
  Terminal,
  Barcode,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard, adminOnly: false },
  { to: "/stok", label: "Stok Yönetimi", icon: Package, adminOnly: false },
  { to: "/terminal", label: "Toplu Stok Girişi", icon: Terminal, adminOnly: false },
  { to: "/barkod", label: "Barkod Yazdır", icon: Barcode, adminOnly: false },
  { to: "/satislar", label: "Satışlar", icon: ShoppingCart, adminOnly: false },
  { to: "/musteriler", label: "Müşteriler", icon: Users, adminOnly: false },
  { to: "/tedarikciler", label: "Tedarikçiler", icon: Truck, adminOnly: false },
  { to: "/raporlar", label: "Raporlar", icon: BarChart3, adminOnly: false },
  { to: "/kullanicilar", label: "Kullanıcılar", icon: ShieldCheck, adminOnly: true },
] as const;


export function AppShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, is_active")
          .eq("id", data.user.id)
          .maybeSingle();

        // Force sign-out if deactivated
        if (prof && prof.is_active === false) {
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
          return;
        }

        const { data: adminCheck } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });
        setIsAdmin(!!adminCheck);

        setUser({
          name: prof?.full_name || data.user.email || "Kullanıcı",
          email: data.user.email || "",
        });
      }
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-surface text-brand-dark flex">
      <aside className="w-64 bg-brand-dark text-white flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/panel" className="flex items-center gap-3">
            <div className="size-8 bg-brand-primary rounded grid place-items-center font-bold text-white">
              <Wrench className="size-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">OtoParça</h1>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.filter((i) => !i.adminOnly || isAdmin).map((item) => {
            const active = pathname === item.to || (item.to !== "/panel" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                )}
              >
                <Icon className="size-4 opacity-80" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-brand-primary/20 grid place-items-center text-brand-primary font-semibold">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium truncate">{user?.name || "..."}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-md"
              title="Çıkış"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ara..."
                className="bg-brand-surface border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
              />
            </div>
            <button className="relative p-2 text-muted-foreground hover:bg-brand-surface rounded-full">
              <Bell className="size-5" />
            </button>
            {action}
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
