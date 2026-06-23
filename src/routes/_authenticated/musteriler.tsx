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
import { Plus, Car, ChevronDown, ChevronRight, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/musteriler")({ component: MusterilerPage });

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

function MusterilerPage() {
    const qc = useQueryClient();
    const businessId = useBusinessId();
    const [open, setOpen] = useState(false);
    const [vehOpen, setVehOpen] = useState(false);
    const [tahsilatOpen, setTahsilatOpen] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [form, setForm] = useState({ full_name: "", phone: "", email: "", address: "" });
    const [vehForm, setVehForm] = useState({ customer_id: "", plate: "", make: "", model: "", year: "" });
    const [tahsilatForm, setTahsilatForm] = useState({ customer_id: "", customer_name: "", amount: "", notes: "" });

    const { data: customers = [] } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => {
            const { data } = await supabase
                .from("customers")
                .select("*, vehicles(*)")
                .order("full_name");
            return data || [];
        },
    });

    const { data: customerSales = [] } = useQuery({
        queryKey: ["customer-sales", expanded],
        enabled: !!expanded,
        queryFn: async () => {
            if (!expanded) return [];
            const { data } = await supabase
                .from("sales")
                .select("id, sale_no, total, payment_type, paid_amount, status, created_at, sale_items(qty, unit_price, parts(name))")
                .eq("customer_id", expanded)
                .order("created_at", { ascending: false })
                .limit(10);
            return data || [];
        },
    });

    const saveCustomer = useMutation({
        mutationFn: async () => {
            if (!businessId) throw new Error("İşletme bilgisi yüklenemedi");
            const { error } = await supabase.from("customers").insert({
                business_id: businessId,
                full_name: form.full_name, phone: form.phone || null,
                email: form.email || null, address: form.address || null,
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
            if (!businessId) throw new Error("İşletme bilgisi yüklenemedi");
            const { error } = await supabase.from("vehicles").insert({
                business_id: businessId,
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

    const saveTahsilat = useMutation({
        mutationFn: async () => {
            if (!businessId) throw new Error("İşletme bilgisi yüklenemedi");
            const amount = Number(tahsilatForm.amount);
            if (!amount || amount <= 0) throw new Error("Geçerli bir tutar girin");

            // Müşteri bakiyesini düşür
            const { data: cust } = await supabase
                .from("customers").select("balance").eq("id", tahsilatForm.customer_id).single();
            if (!cust) throw new Error("Müşteri bulunamadı");

            const { error: e1 } = await supabase.from("customers")
                .update({ balance: Math.max(0, Number(cust.balance) - amount) })
                .eq("id", tahsilatForm.customer_id);
            if (e1) throw e1;

            // İşlem kaydı
            const { error: e2 } = await supabase.from("customer_transactions").insert({
                business_id: businessId,
                customer_id: tahsilatForm.customer_id,
                type: "tahsilat",
                amount,
                notes: tahsilatForm.notes || "Nakit tahsilat",
            });
            if (e2) throw e2;
        },
        onSuccess: () => {
            toast.success("Tahsilat kaydedildi");
            qc.invalidateQueries({ queryKey: ["customers"] });
            setTahsilatOpen(false);
            setTahsilatForm({ customer_id: "", customer_name: "", amount: "", notes: "" });
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
                            <th className="px-6 py-4">Araç</th>
                            <th className="px-6 py-4 text-right">Veresiye Bakiye</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {customers.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">Henüz müşteri yok.</td></tr>
                        )}
                        {customers.map((c: any) => (
                            <>
                                <tr key={c.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                                    <td className="px-6 py-4">
                                        {expanded === c.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                    </td>
                                    <td className="px-6 py-4 font-medium">{c.full_name}</td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{c.phone || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{c.vehicles?.length || 0} araç</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-mono font-semibold ${Number(c.balance) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                            {fmt(Number(c.balance) || 0)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            {Number(c.balance) > 0 && (
                                                <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                    onClick={() => { setTahsilatForm({ customer_id: c.id, customer_name: c.full_name, amount: "", notes: "" }); setTahsilatOpen(true); }}>
                                                    <Wallet className="size-3 mr-1" /> Tahsilat Al
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline"
                                                onClick={() => { setVehForm({ ...vehForm, customer_id: c.id }); setVehOpen(true); }}>
                                                <Car className="size-3 mr-1" /> Araç Ekle
                                            </Button>
                                        </div>
                                    </td>
                                </tr>

                                {expanded === c.id && (
                                    <tr key={c.id + "-detail"} className="bg-muted/20">
                                        <td colSpan={6} className="px-6 py-4">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                                {/* Araçlar */}
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Araçlar</h4>
                                                    {c.vehicles?.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">Kayıtlı araç yok.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {c.vehicles.map((v: any) => (
                                                                <div key={v.id} className="bg-background border rounded-md p-3">
                                                                    <p className="font-mono font-bold text-sm">{v.plate}</p>
                                                                    <p className="text-xs text-muted-foreground">{v.make} {v.model} {v.year ? `• ${v.year}` : ""}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Satış geçmişi */}
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Son Satışlar</h4>
                                                    {customerSales.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">Satış kaydı yok.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {customerSales.map((sale: any) => (
                                                                <div key={sale.id} className="bg-background border rounded-md p-3">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-mono text-xs text-muted-foreground">#{String(sale.sale_no).padStart(5, "0")}</span>
                                                                        <span className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("tr-TR")}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm text-muted-foreground">
                                                                            {sale.sale_items?.map((i: any) => i.parts?.name).join(", ").slice(0, 40)}
                                                                            {sale.sale_items?.map((i: any) => i.parts?.name).join(", ").length > 40 ? "..." : ""}
                                                                        </span>
                                                                        <div className="text-right">
                                                                            <p className="font-semibold text-sm">{fmt(Number(sale.total))}</p>
                                                                            {sale.payment_type === "veresiye" && Number(sale.total) > Number(sale.paid_amount) && (
                                                                                <p className="text-xs text-destructive">Kalan: {fmt(Number(sale.total) - Number(sale.paid_amount))}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-1">
                                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sale.status === "tamamlandi" ? "bg-emerald-100 text-emerald-700" :
                                                                                sale.status === "iptal" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                                                            }`}>
                                                                            {sale.payment_type === "nakit" ? "Nakit" : sale.payment_type === "kart" ? "Kart" : "Veresiye"}
                                                                            {sale.status === "iptal" ? " · İptal" : ""}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* Araç ekleme dialog */}
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

            {/* Tahsilat dialog */}
            <Dialog open={tahsilatOpen} onOpenChange={setTahsilatOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Tahsilat Al — {tahsilatForm.customer_name}</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveTahsilat.mutate(); }} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tahsilat Tutarı (₺) *</Label>
                            <Input type="number" step="0.01" min="0.01" required
                                placeholder="0,00"
                                value={tahsilatForm.amount}
                                onChange={(e) => setTahsilatForm({ ...tahsilatForm, amount: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Not</Label>
                            <Input placeholder="Nakit tahsilat, banka transferi vb."
                                value={tahsilatForm.notes}
                                onChange={(e) => setTahsilatForm({ ...tahsilatForm, notes: e.target.value })} />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={saveTahsilat.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                                {saveTahsilat.isPending ? "Kaydediliyor..." : "Tahsilatı Kaydet"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
}
