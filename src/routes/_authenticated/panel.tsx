import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, PackagePlus, Printer, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/panel")({
  component: PanelPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

function PanelPage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [salesToday, lowStock, pendingPo, customers, recentSales, criticalParts] =
        await Promise.all([
          supabase.from("sales").select("total").gte("created_at", today.toISOString()),
          supabase.from("parts").select("id", { count: "exact", head: true }).filter("stock", "lte", "min_stock"),
          supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "bekliyor"),
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase
            .from("sales")
            .select("id, sale_no, total, status, created_at, customers(full_name), vehicles(plate)")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("parts")
            .select("id, sku, name, stock, min_stock, shelf_location")
            .order("stock", { ascending: true })
            .limit(5),
        ]);

      const dailyTotal = (salesToday.data || []).reduce((s, r) => s + Number(r.total || 0), 0);
      return {
        dailyTotal,
        lowStockCount: lowStock.count ?? 0,
        pendingPoCount: pendingPo.count ?? 0,
        customersCount: customers.count ?? 0,
        recentSales: recentSales.data || [],
        criticalParts: criticalParts.data || [],
      };
    },
  });

  return (
    <AppShell title="Yönetim Paneli">
      <div className="space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Günlük Toplam Satış</p>
            <span className="text-3xl font-bold tracking-tight">{fmt(data?.dailyTotal ?? 0)}</span>
          </Card>
          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Kritik Stok</p>
            <span className="text-3xl font-bold tracking-tight text-destructive">
              {data?.lowStockCount ?? 0}
            </span>
            <p className="text-xs text-muted-foreground mt-2">Min. stok altındaki ürünler</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Bekleyen Siparişler</p>
            <span className="text-3xl font-bold tracking-tight text-brand-primary">
              {data?.pendingPoCount ?? 0}
            </span>
          </Card>
          <Card className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Toplam Müşteri</p>
            <span className="text-3xl font-bold tracking-tight">{data?.customersCount ?? 0}</span>
          </Card>
        </section>

        <section>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Hızlı İşlemler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild size="lg" className="h-auto py-4 justify-start gap-3 shadow-md shadow-primary/20">
              <Link to="/satislar"><Plus className="size-5" /> Yeni Satış Oluştur</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-auto py-4 justify-start gap-3">
              <Link to="/stok"><PackagePlus className="size-5" /> Stok Girişi Yap</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-auto py-4 justify-start gap-3">
              <Link to="/raporlar"><Printer className="size-5" /> Raporları Görüntüle</Link>
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Son Satışlar</h3>
              <Link to="/satislar" className="text-brand-primary text-sm font-medium hover:underline flex items-center gap-1">
                Tümünü Gör <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden p-0">
              <table className="w-full text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Fiş No</th>
                    <th className="px-6 py-4">Müşteri</th>
                    <th className="px-6 py-4">Araç</th>
                    <th className="px-6 py-4 text-right">Tutar</th>
                    <th className="px-6 py-4">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.recentSales.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">Henüz satış kaydı yok.</td></tr>
                  )}
                  {data?.recentSales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm">#{String(s.sale_no).padStart(5, "0")}</td>
                      <td className="px-6 py-4 text-sm">{s.customers?.full_name || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{s.vehicles?.plate || "—"}</td>
                      <td className="px-6 py-4 text-right font-semibold">{fmt(Number(s.total))}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          s.status === "tamamlandi" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-4">Kritik Stok</h3>
            <Card className="divide-y divide-border p-0">
              {data?.criticalParts.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">Tüm stoklar yeterli seviyede.</div>
              )}
              {data?.criticalParts.map((p) => (
                <div key={p.id} className="p-4 flex items-center gap-4">
                  <div className="size-12 bg-muted rounded-lg grid place-items-center text-xl shrink-0">⚙️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {p.sku} {p.shelf_location ? `• ${p.shelf_location}` : ""}</p>
                  </div>
                  <span className={`text-xs font-bold ${p.stock <= (p.min_stock || 0) ? "text-destructive" : "text-amber-500"}`}>
                    {p.stock} adet
                  </span>
                </div>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
