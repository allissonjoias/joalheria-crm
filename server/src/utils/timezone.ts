/**
 * Utilitarios de timezone para o CRM.
 *
 * O fuso horario e configurado em config_geral no banco e aplicado
 * em process.env.TZ ao iniciar o servidor. Todas as funcoes aqui
 * respeitam esse fuso.
 *
 * NUNCA use new Date().toISOString() para gerar timestamps de
 * armazenamento — isso sempre retorna UTC independente do TZ.
 * Use agoraLocal() ou hojeLocal() no lugar.
 */

/** Retorna datetime local no formato 'YYYY-MM-DD HH:MM:SS' */
export function agoraLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Retorna data local no formato 'YYYY-MM-DD' */
export function hojeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Retorna datetime local no formato ISO-like com offset (para expiracoes de token etc) */
export function agoraISO(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: process.env.TZ || 'America/Fortaleza' }).replace(' ', 'T');
}

/** Retorna o fuso horario configurado */
export function fusoAtual(): string {
  return process.env.TZ || 'America/Fortaleza';
}
