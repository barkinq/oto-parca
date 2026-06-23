import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, PackageCheck, ChevronDown, ChevronRight, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/siparisler")({ component: SiparislerPage });

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

type Line = { part_id: string; name: string; sku: string; qty: number; unit_cost: number };

function SiparislerPage() {
  const qc = useQueryClient();
  const businessId = useBusinessId();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [partSearch, setPartSearch] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), purchase_order_items(*, parts(name, sku))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data || [],
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts-search-po", partSearch],
    queryFn: async () => {
      if (!partSearch) return [];
      const { data } = await supabase
        .from("parts").select("id, sku, name, cost, stock")
        .or(`name.ilike.%${partSearch}%,sku.ilike.%${partSearch}%`).limit(8);
      return data || [];
    },
  });

  const total = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  const addLine = (p: any) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.part_id === p.id);
      if (i >= 0) {
        const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next;
      }
      return [...prev, { part_id: p.id, name: p.name, sku: p.sku, qty: 1, unit_cost: Number(p.cost) }];
    });
    setPartSearch("");
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("İşletme bilgisi yüklenemedi");
      if (!supplierId) throw new Error("Tedarikçi seçin");
      if (lines.length === 0) throw new Error("En az bir parça ekleyin");
      const { data: po, error } = await supabase
        .from("purchase_orders").insert({
          business_id: businessId,
          supplier_id: supplierId,
          total,
          notes: notes || null,
          status: "bekliyor",
        }).select().single();
      if (error) throw error;
      const items = lines.map((l) => ({
        business_id: businessId,
        po_id: po.id,
        part_id: l.part_id,
        qty: l.qty,
        unit_cost: l.unit_cost,
      }));
      const { error: e2 } = await supabase.from("purchase_order_items").insert(items);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Sipariş oluşturuldu");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setLines([]); setSupplierId(""); setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const receive = useMutation({
    mutationFn: async (po: any) => {
      // Stokları artır
      for (const item of po.purchase_order_items) {
        const { error } = await supabase
          .from("parts")
          .update({ stock: (item.parts?.stock ?? 0) + item.qty })
          .eq("id", item.part_id);
        if (error) throw error;
      }
      // Stok hareketi kayıtları
      const movements = po.purchase_order_items.map((item: any) => ({
        business_id: item.business_id || po.business_id,
        part_id: item.part_id,
        type: "satin_alma",
        qty: item.qty,
        note: `Satın alma #${String(po.po_no).padStart(5, "0")}`,
        ref_id: po.id,
      }));
      if (movements.length > 0) {
        await supabase.from("stock_movements").insert(movements);
      }
      // Siparişi teslim alındı yap
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "teslim_alindi" })
        .eq("id", po.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sipariş teslim alındı, stoklar güncellendi");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (s: string) => {
    if (s === "bekliyor") return "bg-amber-100 text-amber-700";
    if (s === "teslim_alindi") return "bg-emerald-100 text-emerald-700";
    return "bg-muted text-muted-foreground";
  };

  const statusLabel = (s: string) => {
    if (s === "bekliyor") return "Bekliyor";
    if (s === "teslim_alindi") return "Teslim Alındı";
    return s;
  };

  return (
    <AppShell title="Satın Alma Siparişleri" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button><Plus className="size-4 mr-1" /> Yeni Sipariş</Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Yeni Satın Alma Siparişi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tedarikçi *</Label>
              <select className="w-full border border-input rounded-md h-10 px-3 bg-background text-sm"
                value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Tedarikçi seçin —</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
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
                      <span className="text-muted-foreground">Maliyet: {fmt(Number(p.cost))} • Stok: {p.stock}</span>
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
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Adet</Label>
                    <Input type="number" min="1" value={l.qty}
                      onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))}
                      className="w-20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Birim Maliyet (₺)</Label>
                    <Input type="number" step="0.01" value={l.unit_cost}
                      onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_cost: Number(e.target.value) } : x))}
                      className="w-28" />
                  </div>
                  <span className="w-24 text-right font-semibold text-sm">{fmt(l.qty * l.unit_cost)}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            {lines.length > 0 && (
              <div className="flex justify-end text-lg font-bold pt-2 border-t">
                <span className="mr-4 text-muted-foreground">Toplam</span>
                <span>{fmt(total)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notlar</Label>
              <Input placeholder="Sipariş notu..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending || lines.length === 0 || !supplierId}>
                {create.isPending ? "Kaydediliyor..." : "Siparişi Oluştur"}
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
              <th className="px-4 py-4 w-8"></th>
              <th className="px-4 py-4">Sipariş No</th>
              <th className="px-4 py-4">Tedarikçi</th>
              <th className="px-4 py-4">Tarih</th>
              <th className="px-4 py-4 text-right">Tutar</th>
              <th className="px-4 py-4">Durum</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-16 text-center">
                <Truck className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Henüz sipariş yok.</p>
              </td></tr>
            )}
            {orders.map((o: any) => (
              <>
                <tr key={o.id} className="hover:bg-muted/50">
                  <td className="px-4 py-4">
                    <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      {expanded === o.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-4 font-mono text-sm">#{String(o.po_no).padStart(5, "0")}</td>
                  <td className="px-4 py-4 font-medium">{o.suppliers?.name || "—"}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-4 text-right font-semibold">{fmt(Number(o.total))}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusBadge(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {o.status === "bekliyor" && (
                      <Button size="sm" variant="outline"
                        onClick={() => receive.mutate(o)}
                        disabled={receive.isPending}>
                        <PackageCheck className="size-4 mr-1" /> Teslim Al
                      </Button>
                    )}
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr key={o.id + "-items"} className="bg-muted/30">
                    <td colSpan={7} className="px-8 py-4">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground uppercase">
                          <tr>
                            <th className="pb-2 text-left">SKU</th>
                            <th className="pb-2 text-left">Ürün</th>
                            <th className="pb-2 text-right">Adet</th>
                            <th className="pb-2 text-right">Birim Maliyet</th>
                            <th className="pb-2 text-right">Toplam</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {o.purchase_order_items?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-2 font-mono text-xs">{item.parts?.sku}</td>
                              <td className="py-2">{item.parts?.name}</td>
                              <td className="py-2 text-right">{item.qty}</td>
                              <td className="py-2 text-right">{fmt(Number(item.unit_cost))}</td>
                              <td className="py-2 text-right font-semibold">{fmt(item.qty * Number(item.unit_cost))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {o.notes && <p className="mt-3 text-xs text-muted-foreground">Not: {o.notes}</p>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
