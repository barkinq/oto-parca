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
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tedarikciler")({
  component: TedarikcilerPage,
});

function TedarikcilerPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tax_no: "", address: "" });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data || [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({
        name: form.name, phone: form.phone || null, email: form.email || null,
        tax_no: form.tax_no || null, address: form.address || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tedarikçi eklendi");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false); setForm({ name: "", phone: "", email: "", tax_no: "", address: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell title="Tedarikçiler" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Yeni Tedarikçi</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Tedarikçi</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Firma Adı *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-posta</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Vergi No</Label><Input value={form.tax_no} onChange={(e) => setForm({ ...form, tax_no: e.target.value })} /></div>
            <div className="space-y-2"><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={save.isPending}>Kaydet</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    }>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Firma</th>
              <th className="px-6 py-4">Telefon</th>
              <th className="px-6 py-4">E-posta</th>
              <th className="px-6 py-4">Vergi No</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {suppliers.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-muted-foreground">Henüz tedarikçi yok.</td></tr>
            )}
            {suppliers.map((s: any) => (
              <tr key={s.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 font-medium">{s.name}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{s.phone || "—"}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{s.email || "—"}</td>
                <td className="px-6 py-4 text-sm font-mono">{s.tax_no || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
