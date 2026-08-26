import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (location.pathname.startsWith("/admin")) {
        throw redirect({ to: "/admin-login" });
      }
      throw redirect({ to: "/auth" });
    }

    // Se estiver tentando acessar /admin, validar se o usuário é admin ou gestor
    if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile && profile.role !== "admin" && profile.role !== "gestor") {
        throw redirect({ to: "/" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
