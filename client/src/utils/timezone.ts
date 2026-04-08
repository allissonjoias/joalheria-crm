/**
 * Gera timestamp local no formato 'YYYY-MM-DD HH:MM:SS'.
 * Usa a hora do navegador (que reflete o fuso do SO).
 *
 * Para mensagens otimistas (optimistic UI), use isso ao inves
 * de new Date().toISOString() que sempre retorna UTC.
 */
export function agoraLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
