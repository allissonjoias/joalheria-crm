"use client";

import { useState, useRef } from "react";
import { Send, Loader2, Paperclip } from "lucide-react";

interface Props {
  conversaId: string;
}

export function MensagemInput({ conversaId }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setErro(null);

    // POST /api/enviar/mensagem — persiste + envia via canal externo
    const res = await fetch("/api/enviar/mensagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversaId, conteudo }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setErro(data.erro || "Erro ao enviar");
      setEnviando(false);
      return;
    }

    setTexto("");
    setEnviando(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="bg-wa-bg-panel border-t border-wa-border px-4 py-3">
      {erro && (
        <div className="mb-2 p-2 rounded bg-red-50 text-red-700 text-xs">
          Erro: {erro}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="p-2 rounded-full hover:bg-creme-200 text-alisson-600"
          title="Anexar (em breve)"
          disabled
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          disabled={enviando}
          className="flex-1 px-4 py-2 rounded-2xl border border-wa-border
                   bg-white text-sm resize-none max-h-32
                   focus:outline-none focus:ring-2 focus:ring-alisson-500"
        />

        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          className="p-2.5 rounded-full bg-alisson-600 text-white
                   hover:bg-alisson-700 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
        >
          {enviando ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
