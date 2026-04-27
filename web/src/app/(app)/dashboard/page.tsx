import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Teste rápido: lê funil_blocos do CRM
  const { data: blocos, error: errBlocos } = await supabase
    .from("crm_funil_blocos")
    .select("nome, ordem, cor")
    .order("ordem");

  const { data: agentes, error: errAgentes } = await supabase
    .from("crm_agentes_ia")
    .select("codigo, nome, ativo");

  const { count: contatos } = await supabase
    .from("contatos")
    .select("*", { count: "exact", head: true });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-alisson-700 mb-2">Dashboard</h1>
      <p className="text-alisson-600 mb-8">CRM Alisson Joalheria — Fase 1 ✓</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Stat label="Contatos cadastrados" value={contatos?.toLocaleString() ?? "—"} />
        <Stat label="Blocos do funil" value={blocos?.length ?? 0} />
        <Stat label="Agentes IA ativos" value={agentes?.filter(a => a.ativo).length ?? 0} />
      </div>

      <div className="card">
        <h2 className="font-semibold text-alisson-700 mb-3">
          Funil de Mensageria (seed inicial)
        </h2>
        {errBlocos && (
          <p className="text-red-600 text-sm">Erro: {errBlocos.message}</p>
        )}
        <ul className="space-y-2">
          {blocos?.map((b) => (
            <li key={b.ordem} className="flex items-center gap-3 p-2 rounded-lg bg-creme-100">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: b.cor }}
              />
              <span className="font-medium text-alisson-700">{b.ordem}.</span>
              <span className="text-alisson-800">{b.nome}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold text-alisson-700 mb-3">Agentes IA</h2>
        {errAgentes && (
          <p className="text-red-600 text-sm">Erro: {errAgentes.message}</p>
        )}
        <ul className="space-y-1">
          {agentes?.map((a) => (
            <li key={a.codigo} className="flex justify-between text-sm">
              <span>
                <code className="text-alisson-600">{a.codigo}</code> — {a.nome}
              </span>
              <span className={a.ativo ? "text-green-600" : "text-gray-400"}>
                {a.ativo ? "ativo" : "inativo"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <strong className="text-amber-700">Próximas fases:</strong>
        <ul className="list-disc ml-5 mt-1 text-amber-800">
          <li>Fase 2: Páginas de mensageria + tempo real</li>
          <li>Fase 3: API routes (webhook Unipile/Meta + chamadas IA)</li>
          <li>Fase 4: Migração de dados do SQLite</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-alisson-600">{label}</div>
      <div className="text-2xl font-bold text-alisson-700 mt-1">{value}</div>
    </div>
  );
}
