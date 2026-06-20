import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/satislar")({
  component: SatislarPage,
});

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

type Line = { part_id: string; name: string; sku: string; qty: number; unit_price: number };

function SatislarPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [partSearch, setPartSearch] = useState("");

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_no, total, status, created_at, customers(full_name), vehicles(plate)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => (await supabase.from("customers").select("id, full_name").order("full_name")).data || [],
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      return (await supabase.from("vehicles").select("id, plate, make, model").eq("customer_id", customerId)).data || [];
    },
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts-search", partSearch],
    queryFn: async () => {
      if (!partSearch) return [];
      const { data } = await supabase
        .from("parts").select("id, sku, name, price, stock")
        .or(`name.ilike.%${partSearch}%,sku.ilike.%${partSearch}%`).limit(8);
      return data || [];
    },
  });

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  const addLine = (p: any) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.part_id === p.id);
      if (i >= 0) {
        const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next;
      }
      return [...prev, { part_id: p.id, name: p.name, sku: p.sku, qty: 1, unit_price: Number(p.price) }];
    });
    setPartSearch("");
  };

  const create = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("En az bir parça ekleyin");
      const { data: sale, error } = await supabase
        .from("sales").insert({
          customer_id: customerId || null,
          vehicle_id: vehicleId || null,
          total,
          notes: notes || null,
          status: "tamamlandi",
        }).select().single();
      if (error) throw error;
      const items = lines.map((l) => ({ sale_id: sale.id, part_id: l.part_id, qty: l.qty, unit_price: l.unit_price }));
      const { error: e2 } = await supabase.from("sale_items").insert(items);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Satış kaydedildi");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["parts"] });
      setOpen(false); setLines([]); setCustomerId(""); setVehicleId(""); setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell title="Satışlar" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button><Plus className="size-4 mr-1" /> Yeni Satış</Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Yeni Satış Oluştur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Müşteri</Label>
                <select className="w-full border border-input rounded-md h-10 px-3 bg-background text-sm"
                  value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }}>
                  <option value="">— Müşteri seçin —</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Araç</Label>
                <select className="w-full border border-input rounded-md h-10 px-3 bg-background text-sm"
                  value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={!customerId}>
                  <option value="">— Araç seçin —</option>
                  {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.plate} • {v.make} {v.model}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Parça Ekle</Label>
              <Input placeholder="SKU veya isim ile ara..." value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
              {parts.length > 0 && (
                <Card className="p-2 max-h-48 overflow-auto">
                  {parts.map((p: any) => (
                    <button key={p.id} type="button" onClick={() => addLine(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted rounded text-sm flex justify-between">
                      <span><span className="font-mono text-xs text-muted-foreground">{p.sku}</span> {p.name}</span>
                      <span className="text-muted-foreground">{fmt(Number(p.price))} • {p.stock} stok</span>
                    </button>
                  ))}
                </Card>
              )}
            </div>

            <div className="border rounded-md divide-y">
              {lines.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Henüz parça eklenmedi.</div>}
              {lines.map((l, i) => (
                <div key={l.part_id} className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{l.sku}</p>
                  </div>
                  <Input type="number" min="1" value={l.qty}
                    onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))}
                    className="w-20" />
                  <Input type="number" step="0.01" value={l.unit_price}
                    onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))}
                    className="w-28" />
                  <span className="w-28 text-right font-semibold">{fmt(l.qty * l.unit_price)}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Textarea placeholder="Notlar..." value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Toplam</span>
              <span className="text-2xl font-bold">{fmt(total)}</span>
            </div>

            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending || lines.length === 0}>
                {create.isPending ? "Kaydediliyor..." : "Satışı Kaydet"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    }>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Fiş No</th>
              <th className="px-6 py-4">Tarih</th>
              <th className="px-6 py-4">Müşteri</th>
              <th className="px-6 py-4">Araç</th>
              <th className="px-6 py-4 text-right">Tutar</th>
              <th className="px-6 py-4">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sales.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-16 text-center">
                <ShoppingCart className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Henüz satış kaydı yok.</p>
              </td></tr>
            )}
            {sales.map((s: any) => (
              <tr key={s.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 font-mono text-sm">#{String(s.sale_no).padStart(5, "0")}</td>
                <td className="px-6 py-4 text-sm">{new Date(s.created_at).toLocaleString("tr-TR")}</td>
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
    </AppShell>
  );
}
