"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Link2,
  RefreshCw,
  Webhook,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface UnipileConfig {
  id: string;
  api_key: string;
  dsn: string;
  account_id: string;
  account_username: string;
  account_provider: string;
  webhook_id: string;
  webhook_url: string;
  status: "desconectado" | "conectado" | "erro";
  ultimo_erro?: string;
}

interface ContaUnipile {
  id?: string;
  account_id?: string;
  type?: string;
  name?: string;
  username?: string;
  status?: string;
}

export default function UnipileConfigPage() {
  const [config, setConfig] = useState<UnipileConfig | null>(null);
  const [form, setForm] = useState({
    api_key: "",
    dsn: "",
    account_id: "",
    account_username: "",
    account_provider: "INSTAGRAM",
  });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [registrandoWebhook, setRegistrandoWebhook] = useState(false);
  const [contas, setContas] = useState<ContaUnipile[]>([]);
  const [msg, setMsg] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [webhookCallbackUrl, setWebhookCallbackUrl] = useState("");

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      setWebhookCallbackUrl(`${base}/api/webhook/unipile`);
    }
  }, []);

  async function carregar() {
    try {
      const res = await fetch("/api/unipile/config");
      const data = await res.json();
      if (data) {
        setConfig(data);
        setForm({
          api_key: data.api_key?.includes("...") ? "" : data.api_key || "",
          dsn: data.dsn || "",
          account_id: data.account_id || "",
          account_username: data.account_username || "",
          account_provider: data.account_provider || "INSTAGRAM",
        });
      }
    } catch {}
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const res = await fetch("/api/unipile/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg({ tipo: "sucesso", texto: "Configuração salva!" });
      await carregar();
    } else {
      setMsg({ tipo: "erro", texto: data.erro || "Erro ao salvar" });
    }
    setSalvando(false);
  }

  async function testar() {
    setTestando(true);
    setMsg(null);
    const res = await fetch("/api/unipile/testar", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setMsg({
        tipo: "sucesso",
        texto: `Conexão OK — ${data.contas?.length || 0} conta(s).`,
      });
      setContas(data.contas || []);
      await carregar();
    } else {
      setMsg({ tipo: "erro", texto: data.erro || "Falha na conexão" });
    }
    setTestando(false);
  }

  async function registrarWebhook() {
    setRegistrandoWebhook(true);
    setMsg(null);
    const res = await fetch("/api/unipile/webhook/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_url: webhookCallbackUrl, source: "messaging" }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg({ tipo: "sucesso", texto: "Webhook registrado! DMs vão cair no CRM." });
      await carregar();
    } else {
      setMsg({ tipo: "erro", texto: data.erro || "Erro ao registrar webhook" });
    }
    setRegistrandoWebhook(false);
  }

  function usarConta(c: ContaUnipile) {
    setForm({
      ...form,
      account_id: c.account_id || c.id || "",
      account_username: c.username || c.name || "",
      account_provider: (c.type || "INSTAGRAM").toUpperCase(),
    });
  }

  const isConectado = config?.status === "conectado";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1 text-sm text-alisson-600 hover:text-alisson-700 mb-4"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-alisson-700 flex items-center gap-2">
            <Link2 size={20} /> Unipile (Instagram via API)
          </h2>
          {config && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                isConectado
                  ? "bg-green-50 text-green-700"
                  : config.status === "erro"
                    ? "bg-red-50 text-red-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {isConectado ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {isConectado
                ? "Conectado"
                : config.status === "erro"
                  ? "Erro"
                  : "Desconectado"}
            </span>
          )}
        </div>

        <p className="text-sm text-alisson-600 mb-4">
          Conecte sua conta Unipile (DSN + API Key) e o ID da conta Instagram já vinculada lá.
          Quando ativo, DMs caem direto no CRM via webhook.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Field
            label="API Key (X-API-KEY)"
            type="password"
            value={form.api_key}
            placeholder={config?.api_key || "Cole sua API Key"}
            onChange={(v) => setForm({ ...form, api_key: v })}
          />
          <Field
            label="DSN (ex: api1.unipile.com:443)"
            value={form.dsn}
            onChange={(v) => setForm({ ...form, dsn: v })}
          />
          <Field
            label="Account ID"
            value={form.account_id}
            onChange={(v) => setForm({ ...form, account_id: v })}
          />
          <Field
            label="Username Instagram"
            value={form.account_username}
            onChange={(v) => setForm({ ...form, account_username: v })}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={salvar} disabled={salvando} className="btn-primary flex items-center gap-1">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
          <button onClick={testar} disabled={testando} className="btn-secondary flex items-center gap-1">
            {testando && <Loader2 size={14} className="animate-spin" />} Testar conexão
          </button>
        </div>

        {msg && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              msg.tipo === "sucesso"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {msg.texto}
          </div>
        )}

        {contas.length > 0 && (
          <div className="mb-4 border border-alisson-200 rounded-lg p-3">
            <p className="text-xs font-bold text-alisson-600 uppercase tracking-wider mb-2">
              Contas Unipile
            </p>
            <div className="space-y-1">
              {contas.map((c, i) => (
                <button
                  key={c.id || c.account_id || i}
                  onClick={() => usarConta(c)}
                  className="w-full text-left p-2 rounded hover:bg-alisson-50 flex justify-between items-center text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {c.username || c.name || c.account_id || c.id}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {c.type || c.status}
                    </span>
                  </div>
                  <span className="text-xs text-alisson-600">usar →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-alisson-200 pt-4">
          <p className="text-xs font-bold text-alisson-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Webhook size={12} /> Webhook (recebimento)
          </p>
          <Field
            label="Callback URL"
            value={webhookCallbackUrl}
            onChange={setWebhookCallbackUrl}
          />
          <p className="text-xs text-alisson-600 mt-1">
            URL pública. Em dev, use ngrok apontando pra http://localhost:3003.
          </p>
          <button
            onClick={registrarWebhook}
            disabled={registrandoWebhook}
            className="btn-primary mt-2 flex items-center gap-1"
          >
            {registrandoWebhook && <Loader2 size={14} className="animate-spin" />}
            Registrar webhook na Unipile
          </button>
          {config?.webhook_id && (
            <p className="text-xs text-alisson-600 mt-2">
              Webhook atual: <code>{config.webhook_id}</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-alisson-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </div>
  );
}
