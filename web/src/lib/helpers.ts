/**
 * Utilitários de formatação
 */

export function formatRelativeTime(date: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "agora";
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatTime(date: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getIniciais(nome: string | null | undefined): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function corCanal(canal: string): { bg: string; texto: string; label: string } {
  const map: Record<string, { bg: string; texto: string; label: string }> = {
    instagram_dm: { bg: "bg-pink-100", texto: "text-pink-700", label: "Instagram" },
    instagram_comment: { bg: "bg-purple-100", texto: "text-purple-700", label: "Comentário" },
    whatsapp: { bg: "bg-green-100", texto: "text-green-700", label: "WhatsApp" },
    telegram: { bg: "bg-sky-100", texto: "text-sky-700", label: "Telegram" },
    email: { bg: "bg-amber-100", texto: "text-amber-700", label: "Email" },
    interna: { bg: "bg-gray-100", texto: "text-gray-700", label: "Interna" },
  };
  return map[canal] || { bg: "bg-gray-100", texto: "text-gray-700", label: canal };
}
