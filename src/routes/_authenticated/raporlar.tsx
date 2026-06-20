import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/raporlar")({
  component: RaporlarPage,
});

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

function RaporlarPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);

      const [month, week, top, partsValue] = await Promise.all([
        supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()),
        supabase.from("sales").select("total").gte("created_at", weekStart.toISOString()),
        supabase.from("sale_items").select("qty, unit_price, parts(name, sku)").limit(200),
        supabase.from("parts").select("stock, cost"),
      ]);

      const monthTotal = (month.data || []).reduce((s, r) => s + Number(r.total), 0);
      const weekTotal = (week.data || []).reduce((s, r) => s + Number(r.total), 0);
      const inventoryValue = (partsValue.data || []).reduce((s, r) => s + Number(r.stock) * Number(r.cost), 0);

      // top selling parts aggregation
      const map = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
      (top.data || []).forEach((i: any) => {
        const key = i.parts?.sku || "—";
        const prev = map.get(key) || { name: i.parts?.name || "—", sku: key, qty: 0, revenue: 0 };
        prev.qty += i.qty;
        prev.revenue += i.qty * Number(i.unit_price);
        map.set(key, prev);
      });
      const topParts = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

      return { monthTotal, weekTotal, inventoryValue, topParts };
    },
  });

  return (
    <AppShell title="Raporlar">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Bu Haftaki Satış</p>
            <p className="text-3xl font-bold">{fmt(data?.weekTotal ?? 0)}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Bu Ayki Satış</p>
            <p className="text-3xl font-bold">{fmt(data?.monthTotal ?? 0)}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Depo Maliyet Değeri</p>
            <p className="text-3xl font-bold text-brand-primary">{fmt(data?.inventoryValue ?? 0)}</p>
          </Card>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-4">En Çok Satan Parçalar</h3>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Ürün</th>
                  <th className="px-6 py-4 text-right">Satılan Adet</th>
                  <th className="px-6 py-4 text-right">Toplam Ciro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!data?.topParts || data.topParts.length === 0) && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-muted-foreground">Henüz satış verisi yok.</td></tr>
                )}
                {data?.topParts.map((p) => (
                  <tr key={p.sku} className="hover:bg-muted/50">
                    <td className="px-6 py-4 font-mono text-xs">{p.sku}</td>
                    <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                    <td className="px-6 py-4 text-right font-mono">{p.qty}</td>
                    <td className="px-6 py-4 text-right font-semibold">{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
