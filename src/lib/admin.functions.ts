import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type AppRole = "admin" | "staff" | "kasiyer" | "depocu";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: Admin required");
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;

    const ids = users.users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, is_active").in("id", ids);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);

    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      full_name: profiles?.find((p) => p.id === u.id)?.full_name ?? null,
      is_active: profiles?.find((p) => p.id === u.id)?.is_active ?? false,
      roles: roles?.filter((r) => r.user_id === u.id).map((r) => r.role as AppRole) ?? [],
    }));
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "staff", "kasiyer", "depocu"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw error;
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.isActive) {
      throw new Error("Kendi hesabınızı deaktif edemezsiniz");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_active, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return {
      isActive: profile?.is_active ?? false,
      fullName: profile?.full_name ?? null,
      roles: (roles ?? []).map((r) => r.role as AppRole),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });
