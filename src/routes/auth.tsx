import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/panel" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        await supabase.auth.signOut();
        toast.success(
          "Kayıt başarılı. Hesabınız yönetici onayını bekliyor. Onaylandığında giriş yapabilirsiniz.",
          { duration: 6000 },
        );
        setMode("signin");
        setPassword("");
      } else {
        const { data: sd, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const uid = sd.user?.id;
        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("is_active")
            .eq("id", uid)
            .maybeSingle();
          if (!prof?.is_active) {
            await supabase.auth.signOut();
            toast.error("Hesabınız henüz onaylanmamış. Lütfen yönetici onayını bekleyin.");
            return;
          }
        }
        navigate({ to: "/panel" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google girişi başarısız");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/panel" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-brand-surface">
      <div className="hidden lg:flex bg-brand-dark text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-brand-primary rounded grid place-items-center font-bold">OP</div>
          <span className="text-xl font-bold tracking-tight">OtoParça</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Yedek parça işinizi <br /> tek yerden yönetin.
          </h1>
          <p className="mt-4 text-white/60 max-w-md">
            Stok, satış, müşteri, araç ve tedarikçi kayıtlarını tek bir panelde tutun.
            Kritik stok uyarıları, günlük satış raporları ve daha fazlası.
          </p>
        </div>
        <div className="text-xs text-white/40">© {new Date().getFullYear()} OtoParça Sistemi</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <div className="size-9 bg-brand-primary rounded grid place-items-center text-white">
              <Wrench className="size-4" />
            </div>
            <span className="font-bold text-lg">OtoParça</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Giriş Yap" : "Hesap Oluştur"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Yönetim paneline erişin." : "Yeni bir hesap açın."}
            </p>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={loading}>
            Google ile devam et
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">veya e-posta ile</span>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : mode === "signin" ? "Giriş Yap" : "Hesap Oluştur"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === "signin" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Kayıt olun" : "Giriş yapın"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
