import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/raporlar")({ component: RaporlarPage });

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

type Range = "hafta" | "ay" | "yil" | "ozel";

function getRange(range: Range, start: string, end: string) {
  const now = new Date();
  if (range === "hafta") {
    const s = new Date(now); s.setDate(now.getDate() - 7); s.setHours(0,0,0,0);
    return { start: s.toISOString(), end: now.toISOString() };
  }
  if (range === "ay") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: s.toISOString(), end: now.toISOString() };
  }
  if (range === "yil") {
    const s = new Date(now.getFullYear(), 0, 1);
    return { start: s.toISOString(), end: now.toISOString() };
  }
  return {
    start: start ? new Date(start).toISOString() : new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: end ? new Date(end + "T23:59:59").toISOString() : now.toISOString()
  };
}

function RaporlarPage() {
  const [range, setRange] = useState<Range>("ay");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { start, end } = useMemo(() => getRange(range, customStart, customEnd), [range, customStart, customEnd]);

  const { data } = useQuery({
    queryKey: ["reports", start, end],
    queryFn: async () => {
      const { data: salesData } = await supabase
        .from("sales")
        .select("id, total, discount, payment_type, created_at, status, sale_items(qty, unit_price, parts(cost, name, sku))")
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("status", "tamamlandi");

      const sales = salesData || [];
      const items: any[] = sales.flatMap((s: any) => s.sale_items || []);

      const { data: partsData } = await supabase.from("parts").select("stock, cost");
      const parts = partsData || [];

      const totalSales = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
      const nakit = sales.filter((s: any) => s.payment_type === "nakit").reduce((s: number, r: any) => s + Number(r.total), 0);
      const kart = sales.filter((s: any) => s.payment_type === "kart").reduce((s: number, r: any) => s + Number(r.total), 0);
      const veresiye = sales.filter((s: any) => s.payment_type === "veresiye").reduce((s: number, r: any) => s + Number(r.total), 0);

      let totalRevenue = 0;
      let totalCost = 0;
      items.forEach((i: any) => {
        totalRevenue += i.qty * Number(i.unit_price);
        totalCost += i.qty * Number(i.parts?.cost ?? 0);
      });
      const profit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      const partMap = new Map<string, { name: string; sku: string; qty: number; revenue: number; cost: number }>();
      items.forEach((i: any) => {
        const key = i.parts?.sku || "—";
        const prev = partMap.get(key) || { name: i.parts?.name || "—", sku: key, qty: 0, revenue: 0, cost: 0 };
        prev.qty += i.qty;
        prev.revenue += i.qty * Number(i.unit_price);
        prev.cost += i.qty * Number(i.parts?.cost ?? 0);
        partMap.set(key, prev);
      });
      const topParts = [...partMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

      const dailyMap = new Map<string, number>();
      sales.forEach((s: any) => {
        const day = s.created_at.slice(0, 10);
        dailyMap.set(day, (dailyMap.get(day) || 0) + Number(s.total));
      });
      const dailySales = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

      const inventoryValue = parts.reduce((s: number, r: any) => s + Number(r.stock) * Number(r.cost), 0);

      return { totalSales, nakit, kart, veresiye, profit, margin, topParts, dailySales, inventoryValue, salesCount: sales.length };
    },
  });

  const maxDaily = Math.max(...(data?.dailySales.map(([, v]) => v) || [1]));

  return (
    <AppShell title="Raporlar">
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap gap-1">
              {(["hafta", "ay", "yil"] as Range[]).map((r) => (
                <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
                  {r === "hafta" ? "Bu Hafta" : r === "ay" ? "Bu Ay" : "Bu Yıl"}
                </Button>
              ))}
              <Button size="sm" variant={range === "ozel" ? "default" : "outline"} onClick={() => setRange("ozel")}>Özel</Button>
            </div>
            {range === "ozel" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" className="w-36" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                <span className="text-muted-foreground">—</span>
                <Input type="date" className="w-36" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 md:p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Toplam Satış</p>
            <p className="text-xl md:text-2xl font-bold">{fmt(data?.totalSales ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{data?.salesCount ?? 0} işlem</p>
          </Card>
          <Card className="p-4 md:p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Brüt Kâr</p>
            <p className={`text-xl md:text-2xl font-bold ${(data?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {fmt(data?.profit ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">%{(data?.margin ?? 0).toFixed(1)} marj</p>
          </Card>
          <Card className="p-4 md:p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Depo Değeri</p>
            <p className="text-xl md:text-2xl font-bold">{fmt(data?.inventoryValue ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Maliyet bazında</p>
          </Card>
          <Card className="p-4 md:p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ödeme Dağılımı</p>
            <div className="space-y-1 mt-1">
              <div className="flex justify-between text-xs"><span>Nakit</span><span className="font-medium">{fmt(data?.nakit ?? 0)}</span></div>
              <div className="flex justify-between text-xs"><span>Kart</span><span className="font-medium">{fmt(data?.kart ?? 0)}</span></div>
              <div className="flex justify-between text-xs text-destructive"><span>Veresiye</span><span className="font-medium">{fmt(data?.veresiye ?? 0)}</span></div>
            </div>
          </Card>
        </div>

        {(data?.dailySales.length ?? 0) > 0 && (
          <Card className="p-4 md:p-5">
            <p className="text-sm font-semibold mb-4">Günlük Satış Grafiği</p>
            <div className="flex items-end gap-1 h-32 overflow-x-auto">
              {data?.dailySales.map(([day, val]) => (
                <div key={day} className="flex flex-col items-center gap-1 min-w-[32px]">
                  <div className="w-full bg-brand-primary rounded-t"
                    style={{ height: `${Math.max(4, (val / maxDaily) * 112)}px` }}
                    title={`${day}: ${fmt(val)}`} />
                  <span className="text-[9px] text-muted-foreground">{day.slice(5)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="overflow-hidden p-0">
          <div className="px-4 md:px-6 py-4 border-b"><p className="font-semibold">En Çok Satan Parçalar</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[320px]">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-3 md:px-6 py-3 hidden sm:table-cell">SKU</th>
                  <th className="px-3 md:px-6 py-3">Ürün</th>
                  <th className="px-3 md:px-6 py-3 text-right w-20">Adet</th>
                  <th className="px-3 md:px-6 py-3 text-right hidden sm:table-cell">Ciro</th>
                  <th className="px-3 md:px-6 py-3 text-right w-28">Kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!data?.topParts || data.topParts.length === 0) && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">Henüz satış verisi yok.</td></tr>
                )}
                {data?.topParts.map((p) => (
                  <tr key={p.sku} className="hover:bg-muted/50">
                    <td className="px-3 md:px-6 py-3 font-mono text-xs hidden sm:table-cell">{p.sku}</td>
                    <td className="px-3 md:px-6 py-3 text-sm font-medium">{p.name}</td>
                    <td className="px-3 md:px-6 py-3 text-right font-mono">{p.qty}</td>
                    <td className="px-3 md:px-6 py-3 text-right font-semibold hidden sm:table-cell">{fmt(p.revenue)}</td>
                    <td className={`px-3 md:px-6 py-3 text-right font-semibold ${p.revenue - p.cost >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {fmt(p.revenue - p.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
