"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={sair}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                 text-creme-100 hover:bg-alisson-700 transition-colors text-sm"
    >
      <LogOut size={18} />
      <span>Sair</span>
    </button>
  );
}
