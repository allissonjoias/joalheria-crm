-- Migration: Enriquecer instagram_posts com metadados (thumbnail, media_url, tipo)

ALTER TABLE instagram_posts ADD COLUMN media_product_type TEXT;
ALTER TABLE instagram_posts ADD COLUMN media_url TEXT;
ALTER TABLE instagram_posts ADD COLUMN thumbnail_url TEXT;
ALTER TABLE instagram_posts ADD COLUMN atualizado_em TEXT;

ALTER TABLE conversas ADD COLUMN instagram_media_id TEXT;

ALTER TABLE mensagens ADD COLUMN instagram_media_id TEXT;

ALTER TABLE instagram_posts ADD COLUMN thumbnail_url_local TEXT;
ALTER TABLE instagram_posts ADD COLUMN media_url_local TEXT;
