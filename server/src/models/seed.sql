-- Admin user (senha: admin123)
INSERT INTO usuarios (id, nome, email, senha_hash, papel) VALUES
  ('admin-001', 'Administrador', 'admin@alisson.com', '$2a$10$lRLboX5tWUblc.lL5rbKius1Nviq3dLJWW4/F/ksjbgEFYAe9cz2u', 'admin');

-- Vendedor exemplo (senha: vendedor123)
INSERT INTO usuarios (id, nome, email, senha_hash, papel) VALUES
  ('vendedor-001', 'Maria Silva', 'maria@alisson.com', '$2a$10$KYNRqBLpwSA4RouHTtkyuuDnjHypqQUTBAlvqnTJlz.67pEheUe1S', 'vendedor');

-- Produtos exemplo
INSERT INTO produtos (id, nome, descricao, categoria, material, pedra, preco, estoque) VALUES
  ('prod-001', 'Alianca Classica Lisa', 'Alianca em ouro 18k com acabamento polido', 'aliancas', 'Ouro 18k', NULL, 2800.00, 15),
  ('prod-002', 'Alianca Anatomica', 'Alianca anatomica em ouro 18k, conforto perfeito', 'aliancas', 'Ouro 18k', NULL, 3200.00, 10),
  ('prod-003', 'Anel Solitario Diamante', 'Anel solitario em ouro 18k com diamante de 15 pontos', 'aneis', 'Ouro 18k', 'Diamante', 4500.00, 8),
  ('prod-004', 'Anel Aparador', 'Aparador em ouro 18k com zirconias', 'aneis', 'Ouro 18k', 'Zirconia', 1800.00, 12),
  ('prod-005', 'Colar Corrente Cartier', 'Corrente modelo Cartier em ouro 18k, 45cm', 'colares', 'Ouro 18k', NULL, 3800.00, 6),
  ('prod-006', 'Colar Pingente Coracao', 'Colar com pingente de coracao em ouro 18k', 'colares', 'Ouro 18k', NULL, 2200.00, 9),
  ('prod-007', 'Brinco Argola Medio', 'Brinco argola media em ouro 18k', 'brincos', 'Ouro 18k', NULL, 1500.00, 20),
  ('prod-008', 'Brinco Ponto de Luz', 'Brinco ponto de luz com zirconia em ouro 18k', 'brincos', 'Ouro 18k', 'Zirconia', 980.00, 25),
  ('prod-009', 'Pulseira Elos', 'Pulseira de elos em ouro 18k, 19cm', 'pulseiras', 'Ouro 18k', NULL, 4200.00, 5),
  ('prod-010', 'Anel Formatura', 'Anel de formatura personalizado em ouro 18k', 'aneis', 'Ouro 18k', NULL, 3500.00, 0);

-- Clientes exemplo
INSERT INTO clientes (id, nome, telefone, email, tipo_interesse, material_preferido, ocasiao, vendedor_id) VALUES
  ('cli-001', 'Ana Beatriz Costa', '(11) 99876-5432', 'ana.costa@email.com', 'aliancas', 'Ouro 18k', 'Casamento', 'vendedor-001'),
  ('cli-002', 'Carlos Eduardo Lima', '(11) 98765-4321', 'carlos.lima@email.com', 'aneis', 'Ouro 18k', 'Noivado', 'vendedor-001'),
  ('cli-003', 'Patricia Mendes', '(21) 99654-3210', NULL, 'colares', 'Ouro 18k', 'Presente', 'vendedor-001');

-- Pipeline exemplo
INSERT INTO pipeline (id, cliente_id, vendedor_id, titulo, valor, estagio, produto_interesse) VALUES
  ('pipe-001', 'cli-001', 'vendedor-001', 'Aliancas de Casamento - Ana', 6400.00, 'negociacao', 'Alianca Classica Lisa'),
  ('pipe-002', 'cli-002', 'vendedor-001', 'Anel Noivado - Carlos', 4500.00, 'interessado', 'Anel Solitario Diamante'),
  ('pipe-003', 'cli-003', 'vendedor-001', 'Colar Presente - Patricia', 2200.00, 'lead', 'Colar Pingente Coracao');
