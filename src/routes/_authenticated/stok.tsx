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
import { Plus, Search, Pencil, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stok")({ component: StokPage });

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

type PartForm = {
  id?: string;
  sku: string; name: string; brand: string; category: string;
  shelf_location: string; price: string; cost: string; stock: string; min_stock: string;
  oem_code: string; barcode: string;
  vehicle_make: string; vehicle_model: string; vehicle_year_from: string; vehicle_year_to: string;
};

const empty: PartForm = {
  sku: "", name: "", brand: "", category: "", shelf_location: "",
  price: "0", cost: "0", stock: "0", min_stock: "0",
  oem_code: "", barcode: "", vehicle_make: "", vehicle_model: "", vehicle_year_from: "", vehicle_year_to: "",
};

const typeLabel: Record<string, string> = {
  satis: "Satış",
  satin_alma: "Satın Alma",
  manuel_giris: "Manuel Giriş",
  iade: "İade",
  iptal: "Satış İptali",
};

function StokPage() {
  const qc = useQueryClient();
  const businessId = useBusinessId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<PartForm>(empty);

  const { data: parts = [] } = useQuery({
    queryKey: ["parts", q],
    queryFn: async () => {
      let query = supabase.from("parts").select("*").order("name");
      if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements", selectedPart?.id],
    enabled: !!selectedPart?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("part_id", selectedPart!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("İşletme bilgisi yüklenemedi");
      const payload = {
        sku: form.sku, name: form.name, brand: form.brand || null, category: form.category || null,
        shelf_location: form.shelf_location || null,
        price: Number(form.price) || 0, cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0,
        oem_code: form.oem_code || null, barcode: form.barcode || null,
        vehicle_make: form.vehicle_make || null, vehicle_model: form.vehicle_model || null,
        vehicle_year_from: form.vehicle_year_from ? Number(form.vehicle_year_from) : null,
        vehicle_year_to: form.vehicle_year_to ? Number(form.vehicle_year_to) : null,
      };
      if (form.id) {
        const { data: old } = await supabase.from("parts").select("stock").eq("id", form.id).single();
        const { error } = await supabase.from("parts").update(payload).eq("id", form.id);
        if (error) throw error;
        if (old && old.stock !== Number(form.stock)) {
          const diff = Number(form.stock) - old.stock;
          await supabase.from("stock_movements").insert({
            business_id: businessId,
            part_id: form.id,
            type: "manuel_giris",
            qty: diff,
            note: `Manuel stok düzeltmesi (${old.stock} → ${form.stock})`,
          });
        }
      } else {
        const { data: newPart, error } = await supabase.from("parts").insert({ ...payload, business_id: businessId }).select().single();
        if (error) throw error;
        if (Number(form.stock) > 0 && newPart) {
          await supabase.from("stock_movements").insert({
            business_id: businessId,
            part_id: newPart.id,
            type: "manuel_giris",
            qty: Number(form.stock),
            note: "İlk stok girişi",
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Parça güncellendi" : "Parça eklendi");
      qc.invalidateQueries({ queryKey: ["parts"] });
      setOpen(false); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const edit = (p: any) => {
    setForm({
      id: p.id, sku: p.sku, name: p.name, brand: p.brand || "", category: p.category || "",
      shelf_location: p.shelf_location || "", price: String(p.price), cost: String(p.cost),
      stock: String(p.stock), min_stock: String(p.min_stock),
      oem_code: p.oem_code || "", barcode: p.barcode || "",
      vehicle_make: p.vehicle_make || "", vehicle_model: p.vehicle_model || "",
      vehicle_year_from: p.vehicle_year_from ? String(p.vehicle_year_from) : "",
      vehicle_year_to: p.vehicle_year_to ? String(p.vehicle_year_to) : "",
    });
    setOpen(true);
  };

  const openHistory = (p: any) => {
    setSelectedPart({ id: p.id, name: p.name });
    setHistoryOpen(true);
  };

  return (
    <AppShell title="Stok Yönetimi" action={
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogTrigger asChild>
          <Button><Plus className="size-4 mr-1" /> Yeni Parça</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Parçayı Düzenle" : "Yeni Parça Ekle"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid grid-cols-2 gap-4">
            <Field label="SKU *"><Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Ürün Adı *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="OEM Kodu"><Input value={form.oem_code} onChange={(e) => setForm({ ...form, oem_code: e.target.value })} /></Field>
            <Field label="Barkod"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
            <Field label="Marka"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
            <Field label="Kategori"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Raf Konumu"><Input value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} /></Field>
            <Field label="Satış Fiyatı (₺)"><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Alış Maliyeti (₺)"><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
            <Field label="Stok Miktarı"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
            <Field label="Min. Stok"><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Araç Uyumluluğu</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Araç Markası"><Input value={form.vehicle_make} onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })} placeholder="örn. Ford" /></Field>
                <Field label="Model"><Input value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} placeholder="örn. Transit" /></Field>
                <Field label="Yıl (Başlangıç)"><Input type="number" value={form.vehicle_year_from} onChange={(e) => setForm({ ...form, vehicle_year_from: e.target.value })} placeholder="2014" /></Field>
                <Field label="Yıl (Bitiş)"><Input type="number" value={form.vehicle_year_to} onChange={(e) => setForm({ ...form, vehicle_year_to: e.target.value })} placeholder="2020" /></Field>
              </div>
            </div>
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Kaydediliyor..." : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    }>
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="SKU, isim veya marka ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-3 md:px-6 py-4">SKU</th>
                  <th className="px-3 md:px-6 py-4">Ürün</th>
                  <th className="px-3 md:px-6 py-4 hidden sm:table-cell">Marka</th>
                  <th className="px-3 md:px-6 py-4 hidden md:table-cell">Raf</th>
                  <th className="px-3 md:px-6 py-4 text-right hidden sm:table-cell">Fiyat</th>
                  <th className="px-3 md:px-6 py-4 text-right">Stok</th>
                  <th className="px-3 md:px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parts.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-sm">Parça bulunamadı. "Yeni Parça" ile başlayın.</td></tr>
                )}
                {parts.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm hidden sm:table-cell">{p.brand || "—"}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-muted-foreground hidden md:table-cell">{p.shelf_location || "—"}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right font-semibold hidden sm:table-cell">{fmt(Number(p.price))}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      <span className={`font-mono text-sm ${p.stock <= p.min_stock ? "text-destructive font-bold" : ""}`}>{p.stock}</span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openHistory(p)} title="Stok Geçmişi">
                          <History className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => edit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stok Geçmişi – {selectedPart?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {movements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Henüz stok hareketi yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="pb-2">Tarih</th>
                      <th className="pb-2">İşlem</th>
                      <th className="pb-2 text-right">Miktar</th>
                      <th className="pb-2 hidden sm:table-cell">Not</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movements.map((m: any) => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="py-2 text-muted-foreground text-xs">
                          {new Date(m.created_at).toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.type === "satis" || m.type === "iptal" ? "bg-red-100 text-red-700" :
                            m.type === "satin_alma" || m.type === "manuel_giris" ? "bg-emerald-100 text-emerald-700" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {typeLabel[m.type] || m.type}
                          </span>
                        </td>
                        <td className={`py-2 text-right font-mono font-bold ${m.qty > 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {m.qty > 0 ? `+${m.qty}` : m.qty}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground hidden sm:table-cell">{m.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
