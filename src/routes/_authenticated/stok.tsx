import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stok")({
  component: StokPage,
});

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

type PartForm = {
  id?: string;
  sku: string; name: string; brand: string; category: string;
  shelf_location: string; price: string; cost: string; stock: string; min_stock: string;
};

const empty: PartForm = { sku: "", name: "", brand: "", category: "", shelf_location: "", price: "0", cost: "0", stock: "0", min_stock: "0" };

function StokPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
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

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: form.sku, name: form.name, brand: form.brand || null, category: form.category || null,
        shelf_location: form.shelf_location || null,
        price: Number(form.price) || 0, cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0,
      };
      if (form.id) {
        const { error } = await supabase.from("parts").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parts").insert(payload);
        if (error) throw error;
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
    });
    setOpen(true);
  };

  return (
    <AppShell title="Stok Yönetimi" action={
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogTrigger asChild>
          <Button><Plus className="size-4 mr-1" /> Yeni Parça</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Parçayı Düzenle" : "Yeni Parça Ekle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid grid-cols-2 gap-4">
            <Field label="SKU *"><Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Ürün Adı *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Marka"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
            <Field label="Kategori"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Raf Konumu"><Input value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} /></Field>
            <Field label="Satış Fiyatı (₺)"><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Alış Maliyeti (₺)"><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
            <Field label="Stok Miktarı"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
            <Field label="Min. Stok"><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
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
          <table className="w-full text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Ürün</th>
                <th className="px-6 py-4">Marka</th>
                <th className="px-6 py-4">Raf</th>
                <th className="px-6 py-4 text-right">Fiyat</th>
                <th className="px-6 py-4 text-right">Stok</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {parts.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-sm">Parça bulunamadı. "Yeni Parça" ile başlayın.</td></tr>
              )}
              {parts.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 font-mono text-xs">{p.sku}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-sm">{p.name}</p>
                    {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm">{p.brand || "—"}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{p.shelf_location || "—"}</td>
                  <td className="px-6 py-4 text-right font-semibold">{fmt(Number(p.price))}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono text-sm ${p.stock <= p.min_stock ? "text-destructive font-bold" : ""}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => edit(p)}><Pencil className="size-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
