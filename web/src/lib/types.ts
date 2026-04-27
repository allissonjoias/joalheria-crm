/**
 * Tipos compartilhados do CRM (espelham as views do Postgres)
 */

export type CanalConversa =
  | "instagram_dm"
  | "instagram_comment"
  | "whatsapp"
  | "telegram"
  | "email"
  | "interna";

export type StatusConversa = "aberta" | "aguardando" | "fechada" | "arquivada";

export type PapelMensagem = "user" | "assistant" | "system" | "vendedor" | "interno";

export type TipoMidia = "imagem" | "video" | "audio" | "documento" | "sticker";

export type StatusMensagem =
  | "pendente"
  | "enviando"
  | "enviada"
  | "entregue"
  | "lida"
  | "erro";

export interface ConversaCompleta {
  id: string;
  contato_id: number | null;
  lead_id: number | null;
  vendedor_id: number | null;
  canal: CanalConversa;
  canal_contato_id: string | null;
  canal_thread_id: string | null;
  status: StatusConversa;
  modo_auto: boolean;
  ultima_msg_em: string | null;
  ultima_msg_resumo: string | null;
  nao_lidas_count: number;
  etapa_atual_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_celular: string | null;
  contato_email: string | null;
  vendedor_nome: string | null;
  vendedor_foto: string | null;
  etapa_nome: string | null;
  etapa_cor: string | null;
  bloco_nome: string | null;
  bloco_cor: string | null;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  canal_message_id: string | null;
  papel: PapelMensagem;
  conteudo: string | null;
  tipo_midia: TipoMidia | null;
  midia_url: string | null;
  midia_storage_path: string | null;
  duracao_segundos: number | null;
  instagram_media_id: string | null;
  status: StatusMensagem;
  erro: string | null;
  enviado_em: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserPerfil {
  user_id: string;
  email: string;
  nome: string | null;
  role: string | null;
  vendedor_id: number | null;
  vendedor_nome: string | null;
  vendedor_foto: string | null;
  vendedor_email: string | null;
}
