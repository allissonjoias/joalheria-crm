/**
 * Helpers pra subir mídia no Supabase Storage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_MENSAGENS = "crm-mensagens";
const BUCKET_INSTAGRAM = "crm-instagram";

interface UploadResult {
  storage_path: string;
  public_url: string;
}

/**
 * Sobe um buffer pro bucket privado de mensagens.
 * Caminho: {conversaId}/{messageId}{ext}
 */
export async function uploadMidiaMensagem(
  supabase: SupabaseClient,
  conversaId: string,
  messageIdOrFilename: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const path = `${conversaId}/${messageIdOrFilename}`;
  const { error } = await supabase.storage
    .from(BUCKET_MENSAGENS)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload: ${error.message}`);

  // Bucket privado — gera signed URL ou usa endpoint próprio
  const { data: signed } = await supabase.storage
    .from(BUCKET_MENSAGENS)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
  return {
    storage_path: `${BUCKET_MENSAGENS}/${path}`,
    public_url: signed?.signedUrl || "",
  };
}

/**
 * Sobe imagem de post Instagram pro bucket público.
 */
export async function uploadInstagramPost(
  supabase: SupabaseClient,
  igMediaId: string,
  buffer: Buffer,
  contentType: string,
  variante: "thumb" | "media",
): Promise<UploadResult> {
  const ext =
    contentType.includes("png") ? ".png" :
    contentType.includes("webp") ? ".webp" :
    contentType.includes("mp4") ? ".mp4" : ".jpg";
  const safeId = igMediaId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${safeId}_${variante}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_INSTAGRAM)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload IG: ${error.message}`);

  const { data: pub } = supabase.storage.from(BUCKET_INSTAGRAM).getPublicUrl(path);
  return {
    storage_path: `${BUCKET_INSTAGRAM}/${path}`,
    public_url: pub.publicUrl,
  };
}

/**
 * Baixa URL externa (ex: lookaside.fbsbx.com com token, IG CDN) e sobe.
 */
export async function baixarESubir(
  supabase: SupabaseClient,
  externalUrl: string,
  bucketPath: { bucket: string; path: string },
): Promise<UploadResult> {
  const res = await fetch(externalUrl);
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());

  const { error } = await supabase.storage
    .from(bucketPath.bucket)
    .upload(bucketPath.path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Upload falhou: ${error.message}`);

  const { data: pub } = supabase.storage
    .from(bucketPath.bucket)
    .getPublicUrl(bucketPath.path);
  return {
    storage_path: `${bucketPath.bucket}/${bucketPath.path}`,
    public_url: pub.publicUrl,
  };
}
