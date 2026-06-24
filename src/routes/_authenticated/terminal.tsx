import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Terminal as TerminalIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/terminal")({
  component: TerminalPage,
});

type Row = {
  key: string;
  code: string;
  qty: string;
  status: "pending" | "found" | "notfound";
  partId?: string;
  name?: string;
  currentStock?: number;
};

function TerminalPage() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([
    { key: crypto.randomUUID(), code: "", qty: "1", status: "pending" },
  ]);
  const [mode, setMode] = useState<"add" | "set">("add");
  const codeRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastKeyRef.current && codeRefs.current[lastKeyRef.current]) {
      codeRefs.current[lastKeyRef.current]?.focus();
      lastKeyRef.current = null;
    }
  }, [rows]);

  const addRow = () => {
    const key = crypto.randomUUID();
    lastKeyRef.current = key;
    setRows((prev) => [...prev, { key, code: "", qty: "1", status: "pending" }]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const lookupCode = async (key: string, code: string) => {
    if (!code.trim()) {
      updateRow(key, { status: "pending", partId: undefined, name: undefined, currentStock: undefined });
      return;
    }
    const { data } = await supabase
      .from("parts")
      .select("id, name, sku, stock")
      .or(`sku.eq.${code},barcode.eq.${code},oem_code.eq.${code}`)
      .limit(1)
      .maybeSingle();
    if (data) {
      updateRow(key, { status: "found", partId: data.id, name: data.name, currentStock: data.stock });
    } else {
      updateRow(key, { status: "notfound", partId: undefined, name: undefined, currentStock: undefined });
    }
  };

  const onCodeKey = (e: React.KeyboardEvent<HTMLInputElement>, key: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      qtyRefs.current[key]?.focus();
      qtyRefs.current[key]?.select();
    }
  };

  const onQtyKey = (e: React.KeyboardEvent<HTMLInputElement>, key: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const idx = rows.findIndex((r) => r.key === key);
      if (idx === rows.length - 1) addRow();
      else {
        const next = rows[idx + 1];
        codeRefs.current[next.key]?.focus();
      }
    }
  };

  const valid = rows.filter((r) => r.status === "found" && Number(r.qty) > 0);
  const notFoundCount = rows.filter((r) => r.status === "notfound").length;

  const apply = useMutation({
    mutationFn: async () => {
      if (valid.length === 0) throw new Error("Geçerli satır yok");
      for (const r of valid) {
        const qty = Number(r.qty);
        const newStock = mode === "set" ? qty : (r.currentStock ?? 0) + qty;
        const { error } = await supabase
          .from("parts").update({ stock: newStock }).eq("id", r.partId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${valid.length} ürün güncellendi`);
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setRows([{ key: crypto.randomUUID(), code: "", qty: "1", status: "pending" }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Toplu Stok Girişi"
      action={
        <Button onClick={() => apply.mutate()} disabled={apply.isPending || valid.length === 0}>
          {apply.isPending ? "Kaydediliyor..." : `Stoğu Güncelle (${valid.length})`}
        </Button>
      }
    >
      <div className="space-y-4">
        <Card className="p-4 flex flex-wrap items-start gap-4">
          <div>
            <Label className="block mb-2">Mod</Label>
            <div className="inline-flex rounded-md border border-input overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("add")}
                className={`px-3 py-2 text-sm font-medium ${mode === "add" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                + Mevcut stoğa ekle
              </button>
              <button
                type="button"
                onClick={() => setMode("set")}
                className={`px-3 py-2 text-sm font-medium border-l border-input ${mode === "set" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                = Stoğu eşitle
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <TerminalIcon className="size-4 mt-0.5 shrink-0" />
            <span>
              Kod yazıp <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">Enter</kbd>, miktar yazıp tekrar
              <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">Enter</kbd> — yeni satır otomatik açılır.
            </span>
          </div>
          {notFoundCount > 0 && (
            <div className="text-sm text-amber-700 flex items-center gap-1.5">
              <AlertCircle className="size-4" /> {notFoundCount} kod bulunamadı
            </div>
          )}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-3 md:px-4 py-3 w-10">#</th>
                  <th className="px-3 md:px-4 py-3">Kod (SKU / Barkod / OEM)</th>
                  <th className="px-3 md:px-4 py-3 hidden sm:table-cell">Ürün</th>
                  <th className="px-3 md:px-4 py-3 text-right hidden sm:table-cell">Mevcut</th>
                  <th className="px-3 md:px-4 py-3 w-24">Miktar</th>
                  <th className="px-3 md:px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={r.key} className={r.status === "notfound" ? "bg-destructive/5" : ""}>
                    <td className="px-3 md:px-4 py-2 text-xs font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-3 md:px-4 py-2">
                      <Input
                        ref={(el) => { codeRefs.current[r.key] = el; }}
                        value={r.code}
                        onChange={(e) => updateRow(r.key, { code: e.target.value, status: "pending" })}
                        onBlur={(e) => lookupCode(r.key, e.target.value.trim())}
                        onKeyDown={(e) => onCodeKey(e, r.key)}
                        placeholder="Kod..."
                        className="font-mono text-sm"
                      />
                      {/* Mobilde ürün adı kod altında */}
                      {r.status === "found" && (
                        <p className="text-xs text-emerald-700 mt-1 sm:hidden flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> {r.name} ({r.currentStock ?? "—"})
                        </p>
                      )}
                      {r.status === "notfound" && (
                        <p className="text-xs text-destructive mt-1 sm:hidden">Bulunamadı</p>
                      )}
                    </td>
                    <td className="px-3 md:px-4 py-2 text-sm hidden sm:table-cell">
                      {r.status === "found" && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="size-4" /> {r.name}
                        </span>
                      )}
                      {r.status === "notfound" && (
                        <span className="text-destructive text-xs">Bulunamadı</span>
                      )}
                    </td>
                    <td className="px-3 md:px-4 py-2 text-right font-mono text-sm hidden sm:table-cell">
                      {r.currentStock ?? "—"}
                    </td>
                    <td className="px-3 md:px-4 py-2">
                      <Input
                        ref={(el) => { qtyRefs.current[r.key] = el; }}
                        type="number"
                        min="1"
                        value={r.qty}
                        onChange={(e) => updateRow(r.key, { qty: e.target.value })}
                        onKeyDown={(e) => onQtyKey(e, r.key)}
                        className="w-20"
                      />
                    </td>
                    <td className="px-3 md:px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeRow(r.key)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t bg-muted/30">
            <Button variant="outline" size="sm" onClick={addRow}>+ Satır Ekle</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
