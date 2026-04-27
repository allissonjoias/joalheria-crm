-- Migration: Adicionar bant_bonus_score na tabela sdr_lead_qualificacao
-- Necessario para armazenar o bonus contextual (max 5 pts) do BANT score

ALTER TABLE sdr_lead_qualificacao ADD COLUMN bant_bonus_score INTEGER DEFAULT 0;
