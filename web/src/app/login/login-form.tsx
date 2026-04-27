"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const LS_EMAIL = "crm.login.email";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pré-preenche email do último login
  useEffect(() => {
    const salvo = typeof window !== "undefined" ? localStorage.getItem(LS_EMAIL) : null;
    if (salvo) setEmail(salvo);
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro(
        error.message === "Invalid login credentials"
          ? "Email ou senha inválidos"
          : error.message,
      );
      setCarregando(false);
      return;
    }

    // Lembra o email pra próxima vez
    if (lembrar) localStorage.setItem(LS_EMAIL, email);
    else localStorage.removeItem(LS_EMAIL);

    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-creme-200 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-2 bg-alisson-600 text-white rounded-lg font-bold tracking-wide">
            ALISSON CRM
          </div>
          <p className="mt-3 text-sm text-alisson-700">Entrar com sua conta</p>
        </div>

        <form onSubmit={entrar} className="card space-y-4" autoComplete="on">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-alisson-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={!email}
              autoComplete="username email"
              className="input-field"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-xs font-medium text-alisson-700 mb-1">
              Senha
            </label>
            <input
              id="senha"
              name="password"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoFocus={!!email}
              autoComplete="current-password"
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-alisson-700 select-none">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              className="rounded border-alisson-300 text-alisson-600 focus:ring-alisson-500"
            />
            Lembrar meu login neste dispositivo
          </label>

          {erro && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {carregando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            Entrar
          </button>
        </form>

        <p className="text-center text-xs text-alisson-600 mt-6">
          Esqueceu a senha? Pede pro admin.
        </p>
      </div>
    </div>
  );
}
