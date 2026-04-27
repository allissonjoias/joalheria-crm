import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, MessageSquare, KanbanSquare, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Pega perfil completo (nome ERP + vendedor + role) via view criada na 0009
  const { data: perfil } = await supabase
    .from("crm_user_perfil")
    .select("nome, role, vendedor_nome")
    .eq("user_id", user.id)
    .maybeSingle();

  const nome = perfil?.nome || perfil?.vendedor_nome || user.email?.split("@")[0] || "Usuário";
  const role = perfil?.role;

  return (
    <div className="flex h-screen bg-creme-200">
      <aside className="w-64 bg-alisson-600 text-white flex flex-col">
        <div className="p-4 border-b border-alisson-700">
          <div className="font-bold tracking-wide">ALISSON CRM</div>
          <div className="text-xs text-creme-200/70 mt-1">
            {nome}
            {role && <span className="ml-1 opacity-60">· {role}</span>}
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />}>Dashboard</NavLink>
          <NavLink href="/mensageria" icon={<MessageSquare size={18} />}>Mensageria</NavLink>
          <NavLink href="/pipeline" icon={<KanbanSquare size={18} />}>Pipeline</NavLink>
          <NavLink href="/configuracoes" icon={<Settings size={18} />}>Configurações</NavLink>
        </nav>

        <div className="p-2 border-t border-alisson-700">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg
                 text-creme-100 hover:bg-alisson-700 transition-colors text-sm"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
