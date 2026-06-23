import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ayarlar")({ component: AyarlarPage });

function AyarlarPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", address: "", tax_no: "" });

  const { data: business } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id, businesses(id, name, phone, address, tax_no)")
        .eq("id", user.user.id)
        .single();
      return (profile as any)?.businesses || null;
    },
  });

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || "",
        phone: business.phone || "",
        address: business.address || "",
        tax_no: business.tax_no || "",
      });
    }
  }, [business]);

  const save = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error("İşletme bulunamadı");
      const { error } = await supabase
        .from("businesses")
        .update({
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
          tax_no: form.tax_no || null,
        })
        .eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("İşletme bilgileri kaydedildi");
      qc.invalidateQueries({ queryKey: ["business-profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell title="Ayarlar">
      <div className="max-w-xl space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 bg-brand-primary/10 rounded-lg grid place-items-center">
              <Building2 className="size-5 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-semibold">İşletme Bilgileri</h3>
              <p className="text-sm text-muted-foreground">Fiş ve raporlarda görünür</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>İşletme Adı *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="örn. Ahmet Oto Yedek Parça"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0532 123 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label>Adres</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Mahalle, Cadde, No, İlçe / İl"
              />
            </div>
            <div className="space-y-2">
              <Label>Vergi No</Label>
              <Input
                value={form.tax_no}
                onChange={(e) => setForm({ ...form, tax_no: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <Button type="submit" disabled={save.isPending} className="w-full">
              {save.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-1">Fiş Önizlemesi</h3>
          <p className="text-sm text-muted-foreground mb-4">Fişin üstünde şu şekilde görünür</p>
          <div className="border rounded-lg p-4 font-mono text-sm bg-muted/30">
            <p className="font-bold text-base">{form.name || "İşletme Adı"}</p>
            {form.phone && <p className="text-muted-foreground">{form.phone}{form.address ? ` · ${form.address}` : ""}</p>}
            {form.tax_no && <p className="text-muted-foreground text-xs">Vergi No: {form.tax_no}</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
