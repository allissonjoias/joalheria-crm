import Link from "next/link";
import { Link2, Bot, Brain, KeyRound } from "lucide-react";

export default function ConfiguracoesPage() {
  const cards = [
    {
      href: "/configuracoes/unipile",
      titulo: "Unipile (Instagram/WhatsApp)",
      descricao: "Conecte sua conta Unipile pra receber DMs do Instagram",
      icon: <Link2 size={24} />,
      cor: "bg-pink-100 text-pink-700",
    },
    {
      href: "/configuracoes/meta",
      titulo: "Meta API",
      descricao: "Tokens da Meta pra Instagram comments e webhook fallback",
      icon: <KeyRound size={24} />,
      cor: "bg-blue-100 text-blue-700",
      disabled: true,
    },
    {
      href: "/configuracoes/agentes",
      titulo: "Agentes IA",
      descricao: "SDR, atendimento, brechas — prompts e modelos",
      icon: <Bot size={24} />,
      cor: "bg-purple-100 text-purple-700",
      disabled: true,
    },
    {
      href: "/configuracoes/automacoes",
      titulo: "Automações",
      descricao: "Regras gatilho → ação (resposta auto, follow-up, etc.)",
      icon: <Brain size={24} />,
      cor: "bg-green-100 text-green-700",
      disabled: true,
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-alisson-700 mb-2">Configurações</h1>
      <p className="text-alisson-600 mb-8">Integrações e configurações do CRM</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) =>
          c.disabled ? (
            <div
              key={c.href}
              className="card opacity-50 cursor-not-allowed"
              title="Disponível em breve"
            >
              <CardConteudo {...c} />
              <div className="mt-2 text-xs text-amber-700">em breve (Fase 4+)</div>
            </div>
          ) : (
            <Link key={c.href} href={c.href} className="card hover:shadow-md transition-shadow">
              <CardConteudo {...c} />
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

function CardConteudo({
  titulo,
  descricao,
  icon,
  cor,
}: {
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  cor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${cor}`}>{icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-alisson-700">{titulo}</h3>
        <p className="text-sm text-alisson-600 mt-1">{descricao}</p>
      </div>
    </div>
  );
}
