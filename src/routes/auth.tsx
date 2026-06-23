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
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
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
          toast.error("Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin.");
          return;
        }
      }
      navigate({ to: "/panel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error("İşletme adı zorunludur");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            business_name: businessName,
          },
        },
      });
      if (error) throw error;
      toast.success("Kayıt başarılı! Giriş yapılıyor...");
      // Otomatik giriş yap
      const { data: sd, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) throw loginErr;
      if (sd.user) navigate({ to: "/panel" });
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
      {/* Sol panel */}
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
            Her işletme kendi verilerini güvenle yönetir.
          </p>
        </div>
        <div className="text-xs text-white/40">© {new Date().getFullYear()} OtoParça Sistemi</div>
      </div>

      {/* Sağ panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <div className="size-9 bg-brand-primary rounded grid place-items-center text-white">
              <Wrench className="size-4" />
            </div>
            <span className="font-bold text-lg">OtoParça</span>
          </div>

          {/* Sekme başlıkları */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("login")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                tab === "login"
                  ? "border-b-2 border-brand-primary text-brand-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => setTab("register")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                tab === "register"
                  ? "border-b-2 border-brand-primary text-brand-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kayıt Ol
            </button>
          </div>

          {tab === "login" ? (
            <>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Hoş geldiniz</h2>
                <p className="text-sm text-muted-foreground mt-1">Yönetim panelinize erişin.</p>
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

              <form onSubmit={onLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Hesabınız yok mu?{" "}
                <button onClick={() => setTab("register")} className="text-brand-primary hover:underline">
                  Ücretsiz kayıt olun
                </button>
              </p>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">İşletmenizi kurun</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Kayıt olduğunuzda işletmeniz otomatik oluşturulur.
                </p>
              </div>

              <form onSubmit={onRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-business">İşletme Adı *</Label>
                  <Input
                    id="reg-business"
                    placeholder="örn. Ahmet Oto Yedek Parça"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Ad Soyad</Label>
                  <Input
                    id="reg-name"
                    placeholder="Ad Soyad"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-posta *</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Şifre *</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="En az 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Kayıt yapılıyor..." : "Kayıt Ol ve Başla"}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Zaten hesabınız var mı?{" "}
                <button onClick={() => setTab("login")} className="text-brand-primary hover:underline">
                  Giriş yapın
                </button>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
