-- =====================================================================
-- 0007 — Seeds iniciais (funil padrão, agente SDR padrão)
-- =====================================================================

BEGIN;

-- Funil padrão de mensageria (4 blocos, 12 etapas)
INSERT INTO crm.funil_blocos (id, nome, ordem, cor) VALUES
  (gen_random_uuid(),'Topo (lead novo)',1,'#3b82f6'),
  (gen_random_uuid(),'Meio (qualificação)',2,'#f59e0b'),
  (gen_random_uuid(),'Fundo (negociação)',3,'#10b981'),
  (gen_random_uuid(),'Pós-venda',4,'#8b5cf6')
ON CONFLICT DO NOTHING;

-- Etapas padrão (linkadas aos blocos)
DO $$
DECLARE
  bl_topo uuid; bl_meio uuid; bl_fundo uuid; bl_pos uuid;
BEGIN
  SELECT id INTO bl_topo FROM crm.funil_blocos WHERE nome='Topo (lead novo)' LIMIT 1;
  SELECT id INTO bl_meio FROM crm.funil_blocos WHERE nome='Meio (qualificação)' LIMIT 1;
  SELECT id INTO bl_fundo FROM crm.funil_blocos WHERE nome='Fundo (negociação)' LIMIT 1;
  SELECT id INTO bl_pos FROM crm.funil_blocos WHERE nome='Pós-venda' LIMIT 1;

  INSERT INTO crm.funil_etapas (bloco_id, nome, ordem, cor) VALUES
    (bl_topo,'Primeiro contato',1,'#60a5fa'),
    (bl_topo,'Aguardando resposta',2,'#93c5fd'),
    (bl_meio,'SDR qualificando',3,'#fbbf24'),
    (bl_meio,'Qualificado quente',4,'#f59e0b'),
    (bl_meio,'Qualificado frio',5,'#fb923c'),
    (bl_fundo,'Cotação enviada',6,'#34d399'),
    (bl_fundo,'Negociando preço',7,'#10b981'),
    (bl_fundo,'Aguardando pagamento',8,'#059669'),
    (bl_fundo,'Venda fechada',9,'#047857'),
    (bl_pos,'Acompanhamento entrega',10,'#a78bfa'),
    (bl_pos,'Recompra',11,'#8b5cf6'),
    (bl_pos,'Fidelização',12,'#7c3aed')
  ON CONFLICT DO NOTHING;
END $$;

-- Prompt padrão do SDR
INSERT INTO crm.prompt_templates (codigo, nome, modelo, temperatura, system_prompt, ativo)
VALUES (
  'sdr.qualifier',
  'SDR — Qualificação BANT',
  'claude-3-5-sonnet-20241022',
  0.3,
  'Você é o SDR da joalheria Alisson. Analise as últimas mensagens da conversa e classifique o lead em BANT (Budget, Authority, Need, Timing) de 0-100. Retorne JSON: {budget, authority, need, timing, total, classificacao: frio|morno|quente|muito_quente, resumo, proximos_passos}.',
  true
)
ON CONFLICT (codigo) DO NOTHING;

-- Agente SDR padrão
INSERT INTO crm.agentes_ia (codigo, nome, descricao, prompt_template_id, ativo)
SELECT 'sdr', 'SDR Qualificador', 'Roda BANT nas conversas e classifica leads', id, true
FROM crm.prompt_templates WHERE codigo='sdr.qualifier'
ON CONFLICT (codigo) DO NOTHING;

-- Configs default
INSERT INTO crm.config_geral (chave, valor, descricao) VALUES
  ('mensageria.dedup_window_seconds', '60'::jsonb, 'Janela de dedup pra mensagens duplicadas (Meta vs Unipile)'),
  ('mensageria.modo_auto_default', 'false'::jsonb, 'Modo auto da IA ligado por padrão em novas conversas?'),
  ('sdr.auto_qualificar_apos_n_msgs', '3'::jsonb, 'Roda SDR automaticamente após N mensagens do cliente')
ON CONFLICT (chave) DO NOTHING;

COMMIT;
