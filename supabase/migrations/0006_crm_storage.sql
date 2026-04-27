-- =====================================================================
-- 0006 — Buckets do Supabase Storage
-- =====================================================================
-- Buckets:
--   crm-instagram   → cache de stories/posts (público)
--   crm-mensagens   → áudios/imagens de DM (privado, RLS)
--   crm-anexos      → anexos diversos (privado, RLS)
-- =====================================================================

BEGIN;

-- Cria buckets (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('crm-instagram', 'crm-instagram', true, 50000000,
   ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('crm-mensagens', 'crm-mensagens', false, 50000000,
   ARRAY['image/jpeg','image/png','image/webp','image/gif',
         'audio/ogg','audio/mpeg','audio/mp4','audio/aac',
         'video/mp4','video/quicktime',
         'application/pdf']),
  ('crm-anexos', 'crm-anexos', false, 100000000, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies de Storage
-- Bucket público crm-instagram: leitura aberta, escrita só admin
DROP POLICY IF EXISTS "crm_instagram_read" ON storage.objects;
CREATE POLICY "crm_instagram_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'crm-instagram');

DROP POLICY IF EXISTS "crm_instagram_write" ON storage.objects;
CREATE POLICY "crm_instagram_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'crm-instagram' AND crm.user_eh_admin())
  WITH CHECK (bucket_id = 'crm-instagram' AND crm.user_eh_admin());

-- Bucket crm-mensagens: leitura/escrita autenticada
DROP POLICY IF EXISTS "crm_mensagens_auth" ON storage.objects;
CREATE POLICY "crm_mensagens_auth" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'crm-mensagens')
  WITH CHECK (bucket_id = 'crm-mensagens');

-- Bucket crm-anexos: igual
DROP POLICY IF EXISTS "crm_anexos_auth" ON storage.objects;
CREATE POLICY "crm_anexos_auth" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'crm-anexos')
  WITH CHECK (bucket_id = 'crm-anexos');

COMMIT;
