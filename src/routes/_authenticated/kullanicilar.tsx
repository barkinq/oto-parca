import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Check, X, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, assignRole, setUserActive, createUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/kullanicilar")({
  component: AdminUsersPage,
});

const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  kasiyer: "Kasiyer",
  depocu: "Depocu",
  staff: "Personel",
};

export function AdminUsersPage() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchAssign = useServerFn(assignRole);
  const fetchActive = useServerFn(setUserActive);
  const fetchCreate = useServerFn(createUser);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "kasiyer" as "admin" | "kasiyer" | "depocu" | "staff",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setIsAdmin(false);
      const { data: ok } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      setIsAdmin(!!ok);
    })();
  }, []);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({ data: undefined as never }),
    enabled: isAdmin === true,
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "staff" | "kasiyer" | "depocu" }) =>
      fetchAssign({ data: v }),
    onSuccess: () => {
      toast.success("Rol güncellendi");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeMut = useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) => fetchActive({ data: v }),
    onSuccess: () => {
      toast.success("Durum güncellendi");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () => fetchCreate({ data: newUser }),
    onSuccess: () => {
      toast.success("Kullanıcı oluşturuldu");
      setCreateOpen(false);
      setNewUser({ email: "", password: "", fullName: "", role: "kasiyer" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isAdmin === false) {
    return (
      <AppShell title="Kullanıcı Yönetimi">
        <Card className="p-8 flex items-center gap-4">
          <ShieldAlert className="size-8 text-destructive" />
          <div>
            <h3 className="font-semibold">Erişim Reddedildi</h3>
            <p className="text-sm text-muted-foreground">
              Bu sayfa yalnızca yöneticiler içindir.
            </p>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Kullanıcı Yönetimi">
      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg">Kayıtlı Kullanıcılar</h3>
            <p className="text-sm text-muted-foreground">
              Sisteme yalnızca yöneticinin oluşturduğu hesaplar erişebilir.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="size-4" /> Yeni Kullanıcı</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Ad Soyad</Label>
                  <Input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Şifre</Label>
                  <Input type="text" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as never })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Yönetici</SelectItem>
                      <SelectItem value="kasiyer">Kasiyer</SelectItem>
                      <SelectItem value="depocu">Depocu</SelectItem>
                      <SelectItem value="staff">Personel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!newUser.email || !newUser.password || !newUser.fullName || createMut.isPending}
                >
                  {createMut.isPending ? "Oluşturuluyor..." : "Oluştur"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {isLoading || isAdmin === null ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Mevcut Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Rol Ata</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => {
                const currentRole = u.roles[0];
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {currentRole ? (
                        <Badge variant="secondary">{ROLE_LABELS[currentRole] || currentRole}</Badge>
                      ) : (
                        <Badge variant="outline">Rol yok</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge className="bg-green-600 hover:bg-green-700">Aktif</Badge>
                      ) : (
                        <Badge variant="destructive">Pasif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={currentRole ?? ""}
                        onValueChange={(role) =>
                          roleMut.mutate({ userId: u.id, role: role as never })
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Rol seç" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Yönetici</SelectItem>
                          <SelectItem value="kasiyer">Kasiyer</SelectItem>
                          <SelectItem value="depocu">Depocu</SelectItem>
                          <SelectItem value="staff">Personel</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.is_active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activeMut.mutate({ userId: u.id, isActive: false })}
                        >
                          <X className="size-4" /> Deaktif
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => activeMut.mutate({ userId: u.id, isActive: true })}
                          disabled={u.roles.length === 0}
                        >
                          <Check className="size-4" /> Onayla
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
