-- Migration: Campos BANT na tabela conversas
-- Qualificação BANT adaptada para joalheria
-- N=Need, B=Budget, T=Timeline, A=Authority

ALTER TABLE conversas ADD COLUMN bant_score INTEGER DEFAULT 0;
ALTER TABLE conversas ADD COLUMN bant_budget TEXT;
ALTER TABLE conversas ADD COLUMN bant_authority TEXT;
ALTER TABLE conversas ADD COLUMN bant_need TEXT;
ALTER TABLE conversas ADD COLUMN bant_timeline TEXT;
ALTER TABLE conversas ADD COLUMN bant_qualificado INTEGER DEFAULT 0;
ALTER TABLE conversas ADD COLUMN bant_atualizado_em TEXT;
