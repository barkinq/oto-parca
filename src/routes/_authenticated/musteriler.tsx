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
import { Plus, Car, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/musteriler")({
  component: MusterilerPage,
});

function MusterilerPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vehOpen, setVehOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", address: "" });
  const [vehForm, setVehForm] = useState({ customer_id: "", plate: "", make: "", model: "", year: "" });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*, vehicles(*)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const saveCustomer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        full_name: form.full_name, phone: form.phone || null, email: form.email || null, address: form.address || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Müşteri eklendi");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false); setForm({ full_name: "", phone: "", email: "", address: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveVehicle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicles").insert({
        customer_id: vehForm.customer_id, plate: vehForm.plate.toUpperCase(),
        make: vehForm.make || null, model: vehForm.model || null,
        year: vehForm.year ? Number(vehForm.year) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Araç eklendi");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setVehOpen(false); setVehForm({ customer_id: "", plate: "", make: "", model: "", year: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell title="Müşteriler & Araçlar" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Yeni Müşteri</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Müşteri</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveCustomer.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Ad Soyad *</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-posta</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saveCustomer.isPending}>Kaydet</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    }>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4 w-8"></th>
              <th className="px-6 py-4">Müşteri</th>
              <th className="px-6 py-4">Telefon</th>
              <th className="px-6 py-4">E-posta</th>
              <th className="px-6 py-4">Araç Sayısı</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">Henüz müşteri yok.</td></tr>
            )}
            {customers.map((c: any) => (
              <>
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                      {expanded === c.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-medium">{c.full_name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{c.email || "—"}</td>
                  <td className="px-6 py-4 text-sm">{c.vehicles?.length || 0}</td>
                  <td className="px-6 py-4 text-right">
                    <Button size="sm" variant="outline" onClick={() => { setVehForm({ ...vehForm, customer_id: c.id }); setVehOpen(true); }}>
                      <Car className="size-3 mr-1" /> Araç Ekle
                    </Button>
                  </td>
                </tr>
                {expanded === c.id && (
                  <tr key={c.id + "-v"} className="bg-muted/30">
                    <td colSpan={6} className="px-6 py-4">
                      {c.vehicles?.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Bu müşterinin kayıtlı aracı yok.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {c.vehicles.map((v: any) => (
                            <div key={v.id} className="bg-background border rounded-md p-3">
                              <p className="font-mono font-bold">{v.plate}</p>
                              <p className="text-xs text-muted-foreground">{v.make} {v.model} {v.year ? `• ${v.year}` : ""}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={vehOpen} onOpenChange={setVehOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Araç Ekle</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveVehicle.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Plaka *</Label><Input required value={vehForm.plate} onChange={(e) => setVehForm({ ...vehForm, plate: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Marka</Label><Input value={vehForm.make} onChange={(e) => setVehForm({ ...vehForm, make: e.target.value })} /></div>
              <div className="space-y-2"><Label>Model</Label><Input value={vehForm.model} onChange={(e) => setVehForm({ ...vehForm, model: e.target.value })} /></div>
              <div className="space-y-2"><Label>Yıl</Label><Input type="number" value={vehForm.year} onChange={(e) => setVehForm({ ...vehForm, year: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saveVehicle.isPending}>Kaydet</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
